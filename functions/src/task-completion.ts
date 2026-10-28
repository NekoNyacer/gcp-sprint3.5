import { randomUUID, randomInt } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  DEFAULT_TASK_STEPS,
  DEFAULT_TASK_RADIUS,
  freshTaskLocation,
  taskDistance,
  taskSteps,
  type TaskCadence,
  type TaskRewardType,
} from "./task-domain.js";
import {
  DEFAULT_SEED_TYPES,
  drawSpecies,
  type MysterySeed,
  type SeedType,
} from "./planting-catalog.js";

const id = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
export const completeTask = onCall(
  { region: "asia-east1", invoker: "public", enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "必須先登入");
    const input = request.data ?? {};
    const action = input.action ?? "claim";
    if (
      !id(input.taskId) ||
      !id(input.idempotencyKey) ||
      !["join", "qualify", "claim"].includes(action)
    )
      throw new HttpsError("invalid-argument", "任務操作格式錯誤");
    if (input.isDemo)
      throw new HttpsError("failed-precondition", "Demo 任務不得寫入正常資料");
    const db = getFirestore();
    const userPath = `users/${request.auth.uid}`;
    const taskRef = db.doc(`tasks/${input.taskId}`);
    const enrollmentRef = db.doc(`${userPath}/taskEnrollments/${input.taskId}`);
    const readyRef = db.doc(`${userPath}/taskQualifications/${input.taskId}`);
    const completionRef = db.doc(`${userPath}/taskCompletions/${input.taskId}`);
    const progressRef = db.doc(`${userPath}/progress/current`);
    const inventoryRef = db.doc(`${userPath}/inventory/current`);
    const commandRef = db.doc(`${userPath}/commands/${input.idempotencyKey}`);
    return db.runTransaction(async (tx) => {
      const prior = await tx.get(commandRef);
      if (prior.exists) {
        const command = prior.data()!;
        if (
          command.command !== "completeTask" ||
          command.taskId !== input.taskId ||
          command.action !== action
        )
          throw new HttpsError("invalid-argument", "請求識別碼已用於其他操作");
        return command.result;
      }
      const [
        taskDoc,
        enrollment,
        qualification,
        completion,
        progress,
        inventory,
        publication,
      ] = await Promise.all([
        tx.get(taskRef),
        tx.get(enrollmentRef),
        tx.get(readyRef),
        tx.get(completionRef),
        tx.get(progressRef),
        tx.get(inventoryRef),
        tx.get(db.doc("cmsPublished/demo")),
      ]);
      if (!taskDoc.exists) throw new HttpsError("not-found", "找不到任務");
      const task = taskDoc.data()!;
      const now = Timestamp.now();
      const at = now.toMillis();
      if (task.enabled === false)
        throw new HttpsError("failed-precondition", "任務已停用或下架");
      if (
        action !== "join" &&
        task.cmsVersion !== undefined &&
        task.cmsVersion !== input.expectedVersion
      )
        throw new HttpsError(
          "failed-precondition",
          "任務設定已更新，請重新查看任務內容後確認",
        );
      if (task.startsAt.toMillis() > at || task.endsAt.toMillis() <= at)
        throw new HttpsError("failed-precondition", "任務尚未開始或已過期");
      const state = progress.data()?.state ?? {};
      let result: Record<string, unknown>;
      if (action === "join") {
        if (task.cadence !== "event")
          throw new HttpsError("failed-precondition", "每日與每週任務自動加入");
        if (!enrollment.exists)
          tx.create(enrollmentRef, {
            taskId: input.taskId,
            joinedAt: now,
            joinedBaseline: state.totalTaskWalkingSteps ?? 0,
          });
        result = { taskId: input.taskId, joined: true };
      } else {
        if (task.cadence === "event" && !enrollment.exists)
          throw new HttpsError("failed-precondition", "請先參加活動");
        if (action === "qualify") {
          const location = input.location;
          if (
            !location ||
            typeof location.observedAt !== "string" ||
            !freshTaskLocation(
              { ...location, observedAt: Date.parse(location.observedAt) },
              at,
            )
          )
            throw new HttpsError(
              "failed-precondition",
              "定位精確度不足或位置已過期，請更新位置",
            );
          const distance = taskDistance(location, task.destination);
          const radius = task.radiusMeters ?? DEFAULT_TASK_RADIUS;
          const required =
            task.requiredSteps ??
            DEFAULT_TASK_STEPS[task.cadence as TaskCadence];
          if (!count(radius) || radius < 1 || !count(required) || required < 1)
            throw new HttpsError("data-loss", "任務條件設定無效");
          if (distance > radius)
            throw new HttpsError(
              "failed-precondition",
              `距目的地尚有 ${Math.ceil(distance)} 公尺`,
            );
          const steps = taskSteps(
            {
              cadence: task.cadence,
              startsAt: task.startsAt.toMillis(),
              joinedBaseline: enrollment.data()?.joinedBaseline,
            },
            state.taskWalkingDays ?? {},
            state.totalTaskWalkingSteps ?? 0,
            at,
          );
          if (steps < required)
            throw new HttpsError("failed-precondition", "路線步數尚未達標");
          const ready = qualification.data();
          if (!ready || ready.cmsVersion !== (task.cmsVersion ?? 0))
            tx.set(readyRef, {
              taskId: input.taskId,
              readyAt: now,
              cmsVersion: task.cmsVersion ?? 0,
              calculatedDistanceMeters: Math.round(distance * 10) / 10,
              reportedAccuracyMeters: location.accuracy,
              qualifiedSteps: steps,
              isDemo: false,
            });
          result = { taskId: input.taskId, ready: true };
        } else {
          if (completion.exists)
            throw new HttpsError("already-exists", "任務已領取獎勵");
          const ready = qualification.data();
          if (!ready || ready.cmsVersion !== (task.cmsVersion ?? 0))
            throw new HttpsError(
              "failed-precondition",
              "任務尚未達標或設定已變更",
            );
          const reward = task.reward as {
            type: TaskRewardType;
            amount: number;
          };
          if (
            !reward ||
            !["waterDrops", "fertilizer", "seeds"].includes(reward.type) ||
            !count(reward.amount) ||
            reward.amount < 1 ||
            reward.amount > 1000000
          )
            throw new HttpsError("data-loss", "任務獎勵設定無效");
          const balances = Object.fromEntries(
            ["lightEnergy", "waterDrops", "fertilizer", "seeds"].map((k) => [
              k,
              inventory.data()?.[k] ?? 0,
            ]),
          );
          balances[reward.type] += reward.amount;
          if (!Object.values(balances).every(count))
            throw new HttpsError("data-loss", "資源餘額無效");
          result = {
            taskId: input.taskId,
            completedAt: now.toDate().toISOString(),
            reward,
            inventory: balances,
          };
          if (reward.type === "seeds") {
            const config = publication.data()?.config;
            const pools = (config?.seedTypes ??
              DEFAULT_SEED_TYPES) as SeedType[];
            const pool = pools.find((p) => p.enabled);
            if (!pool || reward.amount > 100)
              throw new HttpsError(
                "failed-precondition",
                "種子機率池或數量設定無效",
              );
            const seeds: MysterySeed[] = Array.from(
              { length: reward.amount },
              () => ({
                id: randomUUID(),
                species: drawSpecies(pool, randomInt(4294967296) / 4294967296),
                seedTypeId: pool.id,
                version: task.cmsVersion ?? 0,
                origin: {
                  routeId: `task:${input.taskId}`,
                  place: task.destination.name,
                  acquiredAt: at,
                },
              }),
            );
            const mysterySeeds = [...(state.mysterySeeds ?? []), ...seeds];
            const revision = (progress.data()?.revision ?? 0) + 1;
            tx.set(
              progressRef,
              { state: { ...state, mysterySeeds }, revision, updatedAt: now },
              { merge: true },
            );
            result.mysterySeeds = mysterySeeds;
            result.progressRevision = revision;
          }
          tx.create(completionRef, {
            taskId: input.taskId,
            completedAt: now,
            readyAt: ready.readyAt,
            reward,
            isDemo: false,
            calculatedDistanceMeters: ready.calculatedDistanceMeters,
            taskSnapshot: {
              title: task.title,
              description: task.description ?? "",
              areaId: task.areaId,
              cadence: task.cadence,
              startsAt: task.startsAt,
              endsAt: task.endsAt,
              destination: task.destination,
              reward,
              requiredSteps:
                task.requiredSteps ??
                DEFAULT_TASK_STEPS[task.cadence as TaskCadence],
              radiusMeters: task.radiusMeters ?? DEFAULT_TASK_RADIUS,
            },
          });
          tx.set(
            inventoryRef,
            { ...balances, updatedAt: now },
            { merge: true },
          );
          tx.create(db.doc(`${userPath}/ledger/${input.idempotencyKey}`), {
            type: "taskReward",
            resource: reward.type,
            amount: reward.amount,
            sourceId: input.taskId,
            isDemo: false,
            idempotencyKey: input.idempotencyKey,
            createdAt: now,
          });
        }
      }
      tx.create(commandRef, {
        command: "completeTask",
        taskId: input.taskId,
        action,
        result,
        createdAt: now,
      });
      return result;
    });
  },
);
