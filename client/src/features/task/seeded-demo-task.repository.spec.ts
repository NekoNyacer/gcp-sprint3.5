import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SeededDemoTaskRepository } from './seeded-demo-task.repository';
import { ProgressStore } from '../../shared/stores/progress-store';
import type { CmsTask } from '../../../../functions/src/cms-domain';
describe('Demo Task qualification and shared inventory', () => {
  afterEach(() => TestBed.resetTestingModule());
  const definition = (overrides: Partial<CmsTask> = {}): CmsTask => ({
    id: 'cms-task',
    name: '綠行任務',
    description: '',
    areaId: 'banqiao',
    cadence: 'daily',
    enabled: true,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    destinationName: '廣場',
    address: '',
    latitude: 25,
    longitude: 121,
    rewardAmount: 4,
    requiredSteps: 100,
    radiusMeters: 100,
    ...overrides,
  });
  async function setup(overrides: Partial<CmsTask> = {}) {
    const repo = TestBed.inject(SeededDemoTaskRepository),
      progress = TestBed.inject(ProgressStore);
    repo.setPublishedTasks([definition(overrides)], 2);
    const task = (await firstValueFrom(repo.watchTasks('')))[0];
    return { repo, progress, task, near: repo.locationFor(task, 'eligible') };
  }
  it('requires eligible route steps as well as proximity and grants nothing at ready', async () => {
    const { repo, progress, task, near } = await setup();
    const before = { ...progress.inventory() };
    progress.addSteps(1000);
    await expect(repo.qualifyTask(task.taskId, near)).rejects.toThrow('步數尚未達標');
    progress.addSteps(100, true);
    await repo.qualifyTask(task.taskId, near);
    expect((await firstValueFrom(repo.watchTasks('')))[0].status).toBe('ready');
    expect(progress.inventory().waterDrops).toBe(before.waterDrops);
  });
  it('adds rewards to the existing shared inventory and credits once across retries', async () => {
    const { repo, progress, task, near } = await setup();
    progress.addSteps(100, true);
    await repo.qualifyTask(task.taskId, near);
    const before = { ...progress.inventory() };
    await repo.completeTask(task.taskId);
    await repo.completeTask(task.taskId);
    expect(progress.inventory()).toEqual({ ...before, waterDrops: before.waterDrops + 4 });
    repo.setPublishedTasks([definition({ rewardAmount: 99 })], 3);
    expect((await firstValueFrom(repo.watchHistory('')))[0].reward.amount).toBe(4);
    repo.setPublishedTasks([]);
    expect((await firstValueFrom(repo.watchHistory('')))[0].taskId).toBe(task.taskId);
  });
  it('freezes event enrollment baseline and supports seeds with task provenance', async () => {
    const { repo, progress, task, near } = await setup({
      cadence: 'event',
      rewardType: 'seeds',
      rewardAmount: 1,
    });
    progress.addSteps(2000, true);
    await expect(repo.qualifyTask(task.taskId, near)).rejects.toThrow('請先參加活動');
    await repo.joinEvent(task.taskId);
    progress.addSteps(99, true);
    await repo.joinEvent(task.taskId);
    await expect(repo.qualifyTask(task.taskId, near)).rejects.toThrow('步數尚未達標');
    progress.addSteps(1, true);
    await repo.qualifyTask(task.taskId, near);
    const before = progress.inventory().seeds;
    await repo.completeTask(task.taskId);
    expect(progress.inventory().seeds).toBe(before + 1);
    expect(progress.mysterySeeds()).toMatchObject([
      { origin: { routeId: 'task:cms-task', place: '廣場' } },
    ]);
  });
  it('rejects stale positions, poor accuracy and out-of-range observations', async () => {
    const { repo, progress, task, near } = await setup();
    progress.addSteps(100, true);
    await expect(
      repo.qualifyTask(task.taskId, { ...near, observedAt: new Date(Date.now() - 31000) }),
    ).rejects.toThrow('位置已過期');
    await expect(
      repo.qualifyTask(task.taskId, repo.locationFor(task, 'poor-accuracy')),
    ).rejects.toThrow('精確度不足');
    await expect(
      repo.qualifyTask(task.taskId, repo.locationFor(task, 'not-arrived')),
    ).rejects.toThrow('距目的地');
  });
  it('keeps ready qualification after leaving but refuses an expired claim', async () => {
    const { repo, progress, task, near } = await setup();
    progress.addSteps(100, true);
    await repo.qualifyTask(task.taskId, near);
    await expect(repo.completeTask(task.taskId)).resolves.toMatchObject({ reward: { amount: 4 } });
    const next = await setup({ id: 'second-task' });
    next.progress.addSteps(100, true);
    await next.repo.qualifyTask(next.task.taskId, next.near);
    vi.spyOn(Date, 'now').mockReturnValue(next.task.endsAt.getTime());
    await expect(next.repo.completeTask(next.task.taskId)).rejects.toThrow('已過期');
    vi.restoreAllMocks();
  });
});
