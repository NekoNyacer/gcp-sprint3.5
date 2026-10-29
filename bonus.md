# Bonus：Firebase 即時連線遊戲實驗

> [!IMPORTANT]
> 本文件描述的是 CAT WALK 專案之外、為測試 Firebase／GCP 功能而規劃的額外 bonus 開發。
>
> 其他 agent 不得將本文件內容加入 CAT WALK 的產品方向、主線規格、`CONTEXT.md`、正式 Azure Boards backlog、容量估算或既有架構參考。除非使用者明確要求處理本 bonus，否則請忽略本文件。
>
> 本 bonus 的決策不得反向修改 `CONTEXT.md`。本文件檔名為 `bonus.md`。

## 文件狀態

- 性質：額外測試開發，不是 CAT WALK 主產品功能。
- 目的：測試 Firebase 即時資料同步、Firebase Authentication、Cloud Firestore、Firebase AI Logic，以及 Firebase App Hosting。
- 規劃方式：依 `grill-me`／`grilling` 設計訪談逐輪確認。
- 狀態：核心方向與第 1～8 輪決策已確認；共享理解已確認，以下為執行規劃。
- 本文件不代表 production-ready 的安全性、可靠性或反作弊能力。

## 遊戲概念

製作一個 5～10 人、類似 Kahoot 的即時推理遊戲：

1. 主持人建立房間並取得 QR Code、房間碼與分享連結。
2. 玩家掃碼或輸入房間碼，以暱稱加入房間。
3. 主持人同時是本局玩家，也負責手動推進遊戲流程。
4. 每局隨機分配一位猜題人、一位老實人，其餘為唬爛人。
5. AI 產生一道以冷知識名詞為核心的題目。
   - 題目 AI 必須使用專門提示詞，優先產生低知名度、較少人知道的冷知識名詞；例如避免「水熊蟲」這類可能過於常見的答案，並可偏向「拿撒路現象」等冷門名詞。
   - 正式開始本局前，主持人可以要求重新生成題目，以避免已有玩家知道答案而降低唬爛樂趣。
6. 所有玩家看到相同的冷知識名詞與公開題目。
7. 老實人收到正確詳細說明；唬爛人收到預先準備、長度相近的靜態提示。
8. 除猜題人以外，其他玩家依隨機順序輪流解釋該名詞。
9. 猜題人選擇自己認為的老實人。
10. 揭露答案、計算本局分數，並在指定局數或提前結束時顯示總結算。

## 已確認的產品決策

### 房間與玩家

- 遊戲放在現有 Ionic／Angular app 內，新增 `/party-game` 路由。
- 主產品以額外入口或選單進入；玩家 QR Code 直接進入加入頁。
- 不新增第五個底部 Tab。
- 房間總玩家數為 5～10 人，包含主持人。
- 主持人建立房間後也算一名玩家，會被分配角色並依規則參與遊戲。
- 玩家使用 Firebase Anonymous Auth，不要求 Google Sign-In。
- 玩家輸入房間內唯一暱稱。
- 房間提供：
  - QR Code
  - 6 位數房間碼
  - 可複製的加入連結
  - 手機原生分享按鈕
- 未滿 5 人時，主持人的開始按鈕不可用。
- 主持人可查看玩家清單與人數、移除玩家、鎖定房間及關閉房間。
- 遊戲開始後禁止新玩家加入。
- 玩家短暫斷線或重新整理時，Anonymous UID 可在 5 分鐘內恢復原本身份。
- 房間資料約保留 24 小時，之後清理。

### 回合設定

- 每場可設定 1～5 局，預設 3 局。
- 主持人可以提前結束整場遊戲。
- 若主持人在回合中途提前結束，該未完成回合不計分，只結算已完成回合。
- 題目預覽期間不分配角色。
- 主持人確認題目並按「開始本局」時，才進行一次角色分配：猜題人依公平排程選擇，老實人與唬爛人再以隨機方式分配。
- 猜題人抽選採公平排程：優先從尚未當過猜題人的玩家中選擇；其他角色仍以隨機方式分配。若設定局數少於玩家數，無法保證每位玩家在該場都實際當過猜題人。
- 發言順序隨機決定。
- 每位玩家沒有固定發言倒數時間，由主持人手動結束或跳過。
- 發言採現場口頭進行；App 只顯示目前發言者與流程，不錄音、不傳送音訊，也不提供遊戲內文字聊天。

### 主持人手動流程

主持人使用手機瀏覽器建立房間與控制遊戲。控制介面採「目前階段、目前玩家、下一步大按鈕」的手機優先設計。

每局預計由主持人依序控制：

1. 準備本局。
2. 等待 AI 題目生成完成或載入 fallback。
3. 將名詞、公開題目與三個領域提示提供所有玩家確認；若有人已知道答案，主持人可重新生成。
4. 主持人確認題目後按「開始本局」。
5. 進入 3、2、1 倒數；角色在倒數結束後才顯示給各玩家。
6. 公布猜題人身分與公開題目，並提供各玩家自己的私有角色資訊。
7. 開始／結束目前玩家的發言。
8. 依序推進下一位發言者。
9. 開放猜題人選擇老實人。
10. 公布答案、正確領域與本局結果。
11. 進入下一局或結束整場遊戲。

主持人只能看到自己的角色與自己的私有說明，不應在一般 UI 中看到其他玩家角色。題目預覽與「是否有人知道」採現場口頭確認，不另外建立玩家逐一確認按鈕。
- 房間顯示連線狀態；玩家短暫斷線時保留房間階段，主持人可以暫停或繼續遊戲，玩家重新連線後恢復目前狀態。

### 角色與資訊可見性

- 全部玩家可以知道誰是猜題人。
- 猜題人身分公開，但猜題人不能看到正確詳細說明，也不參與名詞解釋發言。
- 老實人身分對其他玩家隱藏，只看到自己的詳細正確說明。
- 唬爛人身分對其他玩家隱藏，只看到自己的靜態提示。
- 全部玩家在答案揭露前都不能看到老實人或唬爛人的身份。
- 所有玩家看到相同的名詞與公開題目。
- 公開提示包含三個與名詞相關的領域，其中一個是真實符合該名詞的領域，另外兩個是干擾領域；三個領域不標示正誤。
- 公開題目不是選擇題；畫面顯示冷知識名詞與一句請玩家解釋該名詞的公開提示。
- 唬爛人的靜態訊息直接寫在程式內，不交給 AI 生成。
- 唬爛人的靜態訊息必須與詳細說明使用相近的畫面結構與文字長度，避免玩家靠近觀看手機時，從字數差異猜出角色。
- 靜態訊息預先寫入 3～5 則，實際內容與當局題目完全無關；不需要為了避免玩家記憶而依題目變化。
- 靜態訊息文案由使用者自行撰寫；agent 不需要特別設計或生成這部分內容。

### 計分

- 猜題人選中真正的老實人：
  - 猜題人 +1 分
  - 老實人 +1 分
- 猜題人選錯，選到唬爛人：
  - 被選中的唬爛人 +3 分
- 沒有被選中的玩家不因本次猜測得分。
- 主持人若被分配到任何角色，依同一規則計分。
- 每局結束揭露本局得分。
- 整場結束顯示所有玩家的總分與工殺毀統計。

### 工殺毀卡牌

- 每位玩家每局有 3 張工殺毀卡牌。
- 每局結束後，每位玩家的卡牌數量重置為 3 張。
- 任一玩家都可以在他人發言期間使用工殺毀。
- 不可對自己使用。
- 同一位發言者可以收到多張工殺毀。
- 工殺毀事件即時公開顯示「誰對誰使用工殺毀」。
- 卡牌送出後立即扣除，不可撤回。
- 工殺毀不影響本局正確答案與分數。
- 系統統計每位玩家：
  - 使用張數
  - 收到張數
  - 整場總張數

## 已確認的技術決策

### 不建立自訂後端

本 bonus 不建立：

- Cloud Functions
- Genkit flow
- Cloud Run API
- Java backend
- .NET backend
- 自訂 WebSocket server

App Hosting 的「backend」在此處只代表 App Hosting 的部署單位與執行環境，不代表需要自行撰寫商業 API 後端。它只負責建置與服務 Angular 前端；既有 Firebase Hosting 可作為 fallback。

### 部署

- 使用現有 repository 的 Angular app。
- 建立獨立的 Firebase App Hosting backend，部署同一個前端 app。
- 既有 Firebase Hosting 保留，不進行主產品遷移。
- App Hosting 驗證目標是：連接指定 repository branch，測試 commit 後自動 rollout。
- 若 GitHub／Developer Connect 尚未可用，先以可行的手動部署方式完成 App Hosting spike。
- 目前 repository 尚未配置 App Hosting 或 Firebase deploy 檔案，需列入實作前置工作。

### Firebase 服務

- Firebase Anonymous Auth：建立玩家 UID。
- Cloud Firestore：保存房間狀態、玩家資料、回合資料、工殺毀事件與結果。
- Firestore realtime listeners：將主持人手動推進的狀態即時同步給所有玩家。
- Firebase AI Logic：從主持人的瀏覽器呼叫 Gemini，生成每局內容。
- Firebase App Check：作為 AI Logic 與 Firebase 資源的基本保護措施。
- Firebase Hosting：保留為 fallback，不取代既有 CAT WALK 主產品部署。

### AI 生成策略

- 主持人按下「準備本局」後，主持人瀏覽器呼叫 Firebase AI Logic。
- AI 生成：
  - 冷知識名詞
  - 公開題目
  - 三個公開領域選項，其中一個正確、兩個干擾
  - 老實人詳細說明
- AI 不生成唬爛人的訊息；唬爛訊息由程式內建的靜態內容提供。
- 出題 prompt 必須明確要求低知名度、非一般常識、適合口頭解釋且不應從名詞字面直接推知答案。
- 出題 prompt 必須要求三個領域選項：一個正確領域與兩個合理但錯誤的干擾領域，且不得標示哪一個正確。
- AI 回應需使用固定結構，預計包含：

```text
term
question
domainOptions
correctDomain
truthfulExplanation
sourceNote
```

- 題目產生完成後，主持人將名詞、公開題目與三個領域選項預覽給現場玩家確認。
- 主持人在正式開始前可以按「重新生成題目」，重新取得名詞、公開題目與三個領域選項；確認後主持人按「開始本局」，才分配角色並進入倒數，角色在倒數結束後顯示。
- AI 失敗、逾時或配額不足時，改用版本化靜態冷知識題庫。
- 使用約 30 個預審、低知名度冷知識名詞作為安全候選與 fallback；AI 也可以依提示詞提出新的冷門名詞，由主持人預覽確認。
- 重新生成不自動增加遊戲局數；題目確認後按「開始本局」才分配該回合角色，每個已接受的題目只分配一次。
- 重新生成不限固定次數；只有主持人明確按下重新生成按鈕時才發出一次 AI 請求，不進行自動重試，並在畫面顯示本局已呼叫次數與配額／錯誤提示。
- `sourceNote` 可只提供給 debug 面板或內部檢查使用，不一定展示給玩家。
- 題目預覽時公開顯示三個未標示正誤的領域選項；答案揭露時才顯示正確領域。

### Firestore 初步資料結構

```text
rooms/{roomId}
rooms/{roomId}/players/{playerId}
rooms/{roomId}/players/{playerId}/private/profile
rooms/{roomId}/rounds/{roundId}
rooms/{roomId}/rounds/{roundId}/cardEvents/{eventId}
```

資料責任初步定義：

- `rooms/{roomId}`：房主、目前階段、目前回合、公開名詞、公開題目、房間狀態。
- `players`：暱稱、在線狀態、總分、當局剩餘工殺毀。
- `private`：自己的角色、老實人說明、個人操作狀態。
- `rounds`：發言順序、目前發言者、猜題結果、角色揭露與回合分數。
- `cardEvents`：公開的工殺毀使用紀錄。

### 信任模型

- 主持人瀏覽器是遊戲流程的權威來源。
- 主持人端負責角色隨機分配、AI 結果寫入、流程推進、回合揭露與分數寫入。
- Firestore Security Rules 防止普通玩家任意修改主持人控制的房間欄位。
- 玩家只能修改自己的暱稱、在線狀態、發言完成狀態及允許的卡牌操作。
- 因為主持人同時也是玩家，主持人的瀏覽器技術上可能取得完整 AI 回應或角色資料。
- 這是內部 bonus demo 的可接受限制，不宣稱具備 production-grade anti-cheat。
- 遊戲預設為所有玩家面對面實體遊玩；App 負責房間同步、流程提示、私有資訊、卡牌事件與計分，不負責語音或遠端社交。

## 手機驗收情境

- 主持人使用手機瀏覽器建立房間。
- 玩家使用手機瀏覽器加入，不依賴 Android APK。
- 主持人手機提供 QR Code、房間碼、複製連結與分享按鈕。
- 正式驗收至少使用 5 個獨立 browser session，目標測試 5～10 個 session。
- 必須驗證：
  - 多人加入與人數限制
  - QR／分享連結加入
  - Anonymous Auth 身份維持
  - 房間狀態即時同步
  - 3、2、1 倒數畫面
  - 主持人手動推進
  - 玩家發言狀態
  - 工殺毀即時廣播
  - 猜題選擇與答案揭露
  - 每局計分
  - 多局重置卡牌
  - 提前結束與最終結算
  - 斷線後 5 分鐘內恢復身份

## 明確不屬於本 bonus 的內容

- 不將遊戲規則併入 CAT WALK 主產品。
- 不修改 CAT WALK 的產品名稱、產品方向或主線功能優先級。
- 不修改 `CONTEXT.md`。
- 不新增正式 Azure Boards 主線 work item，除非使用者另行要求。
- 不建立 production 環境或正式商業資料。
- 不建立長期玩家帳號、跨場排行榜或正式社交關係。
- 不做 production-grade 反作弊。
- 不做 Android 原生 App 依賴；瀏覽器是主要驗收平台。

## 參考文件

- [Firebase App Hosting framework support](https://firebase.google.com/docs/app-hosting/frameworks-tooling)
- [Firebase App Hosting getting started](https://firebase.google.com/docs/app-hosting/get-started)
- [Cloud Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/get-data)
- [Firebase AI Logic](https://firebase.google.com/docs/ai-logic)

## 執行規劃

### 實作原則

- 這是 Firebase／GCP 功能驗證用的額外 bonus，不納入 CAT WALK 主線排程、主線 backlog 或 `CONTEXT.md`。
- 以「能讓 5～10 支手機完成一場遊戲」為完成標準，不追求 production-grade 反作弊、正式社交或長期玩家資料。
- 不建立自訂後端。App Hosting 只服務 Angular 前端；Firestore 直接由主持人與玩家瀏覽器讀寫並透過 listener 同步。
- 所有會影響遊戲流程的操作都集中在主持人手機的控制介面；一般玩家只能修改自己的允許欄位。
- AI 只在主持人明確按下「準備題目」或「重新生成」時呼叫，不做背景自動重試。
- 每一階段先以 Firebase Emulator Suite 驗證，再連到共用 Demo Firebase project。

### 建議程式碼邊界

```text
client/src/features/party-game/
  party-game-entry.component.*
  party-game-room.component.*
  party-game-host.component.*
  party-game-player.component.*
  party-game-store.ts
  party-game.models.ts
  party-game-rules.ts
  services/
    party-game-auth.service.ts
    party-game-room.repository.ts
    party-game-ai.service.ts
    party-game-qr.service.ts
    party-game-share.service.ts
  data/
    fallback-trivia.ts
    bluff-messages.ts       # 文案由使用者提供
```

- 在 `client/src/app/app.routes.ts` 增加獨立 `/party-game` 路由，放在現有 `AppShell` 路由之外，避免主產品四個底部 Tab 出現在遊戲控制畫面。
- 主產品選單增加 bonus 入口；QR／分享連結直接進入加入流程。
- 新增服務依現有 Angular 22 專案慣例優先使用 `@Service()`；Signal Store 使用現有 NgRx Signal Store 22。
- 不新增 `functions/` 或其他 server application directory。

### 建議 Firestore 狀態模型

```text
rooms/{roomId}
rooms/{roomId}/players/{playerId}
rooms/{roomId}/players/{playerId}/private/profile
rooms/{roomId}/rounds/{roundId}
rooms/{roomId}/rounds/{roundId}/cardEvents/{eventId}
```

`rooms/{roomId}` 的公開欄位建議包含：

- `ownerUid`
- `status`: `lobby | active | finished | closed`
- `phase`: `topicPreview | countdown | roleReveal | speaking | guessing | reveal | paused`
- `roundNumber`、`roundLimit`
- `currentSpeakerUid`
- `publicTerm`
- `publicQuestion`
- `domainOptions`：三個未標示正誤的領域
- `publicGuesserUid`：倒數結束後才填入或公開
- `playerCount`
- `generationCount`
- `expiresAt`
- `updatedAt`

`players/{playerId}` 建議包含：

- `uid`、`nickname`
- `isHost`
- `isOnline`、`lastSeenAt`
- `score`
- `cardsRemaining`
- `cardsUsedTotal`、`cardsReceivedTotal`
- `guesserCount`

`players/{playerId}/private/profile` 建議包含：

- `role`: `guesser | honest | bluffer`
- `truthfulExplanation`：只有老實人存入實際說明
- `hasSeenRole`
- `hasFinishedSpeaking`

`rounds/{roundId}` 建議包含：

- `speakerOrder`
- `completedSpeakerIds`
- `selectedPlayerUid`
- `truthfulPlayerUid` 與 `correctDomain`：答案揭露前不可讓一般玩家讀取
- `scoreDeltas`
- `revealedAt`

若 Firestore Rules 難以在同一文件中實現欄位級隱藏，將答案與角色資料放入受限制的 private 文件，不把它們放進公開 room／round 文件。

### 遊戲狀態機

以純 TypeScript 函數集中定義合法狀態轉換：

```text
lobby
  -> topicPreview
  -> countdown
  -> roleReveal
  -> speaking
  -> guessing
  -> reveal
  -> next round / finished

any active phase -> paused -> previous active phase
```

主持人按鈕只允許下列操作：

- 建立／關閉房間
- 準備題目
- 重新生成題目
- 開始本局
- 結束倒數並揭露角色
- 開始／結束／跳過目前發言者
- 暫停／繼續
- 開放猜題
- 公布結果
- 進入下一局／結束遊戲

每個主持人操作以 Firestore transaction 寫入，至少檢查 `roomId`、`ownerUid`、目前 `phase` 與預期的下一階段，避免手機重複點擊造成狀態倒退。由於沒有自訂後端，這是 Demo 的一致性保護，不是不可破解的安全邊界。

### 角色分配演算法

題目預覽期間不分配角色。主持人確認題目並按下「開始本局」後：

1. 取得目前仍在房間中的 5～10 名玩家。
2. 找出 `guesserCount` 最少的玩家。
3. 若有多人並列，從並列者中隨機選出猜題人。
4. 從剩餘玩家中隨機選出一位老實人。
5. 其餘玩家全部標記為唬爛人。
6. 更新猜題人的 `guesserCount`，並在倒數結束後才讓玩家看見自己的角色。

重新生成題目只發生在角色尚未分配的預覽階段，因此不增加局數、不影響公平計數，也不會造成已知角色突然改變。

### AI 出題流程

1. 主持人按「準備題目」。
2. Firebase AI Logic 呼叫 Gemini。
3. Prompt 要求：
   - 產生低知名度、非一般常識的冷知識名詞。
   - 避免「水熊蟲」等可能過於常見的題目。
   - 名詞不能從字面直接猜出解釋。
   - 適合現場口頭解釋與唬爛。
   - 回傳三個領域，其中一個正確、兩個合理干擾項。
   - 三個領域不可在公開結果中標記正誤。
   - 避免政治、醫療建議、成人、暴力、宗教爭議與需專業判斷的內容。
4. 前端驗證 JSON 結構、欄位完整性、三個領域數量、`correctDomain` 是否屬於 `domainOptions`、字數與禁止詞。
5. 題目預覽公開顯示名詞、題目與三個領域。
6. 現場玩家口頭確認是否有人知道答案。
7. 若有人知道，主持人手動按「重新生成」。
8. 題目接受後主持人按「開始本局」，才進行角色分配與倒數。
9. AI 逾時、配額不足、格式錯誤或安全限制失敗時，使用 `fallback-trivia.ts` 的預審題目。
10. `bluff-messages.ts` 完全由使用者提供，不使用 AI。

AI debug 區只對主持人顯示：模型名稱、生成耗時、呼叫次數、fallback 狀態、錯誤訊息與 `sourceNote`。`sourceNote` 僅是 AI／內部檢查資訊，不宣稱已完成事實查證。

### Lobby、QR 與分享

1. 主持人進入 `/party-game`，匿名登入並建立 6 位數房間碼。
2. 產生包含加入路由與房間碼的 QR Code。
3. 主持人手機顯示 QR、房間碼、複製連結及手機分享按鈕。
4. 玩家掃描、開啟分享連結或手動輸入房間碼。
5. 玩家輸入唯一暱稱後加入 `players`。
6. 主持人看到人數與玩家清單；少於 5 人時禁止開始，超過 10 人時拒絕加入。
7. 開始本局後鎖定房間，不接受新玩家。
8. `onSnapshot` 或等效 listener 中斷時顯示連線狀態；重新進入時依 Anonymous UID 恢復玩家資料。

### 工殺毀與計分

- 發言階段顯示目前發言者與「使用工殺毀」操作。
- 非本人皆可出牌；每次出牌建立 `cardEvents/{eventId}`，事件包含使用者、目標、回合與時間。
- 事件公開即時顯示；不可撤回；同一發言者可收到多張。
- 每局開始時將每位玩家的 `cardsRemaining` 設為 3；使用後遞減，下一局重新設為 3。
- 猜中老實人：猜題人與老實人各 +1。
- 猜錯並選中唬爛人：被選中的唬爛人 +3。
- 回合揭露時寫入 `scoreDeltas`，並更新玩家總分。
- 提前結束未完成回合時，不寫入該回合分數。

### Firestore Rules 與資料清理

先建立最小可用 Rules，再用 Emulator Rules tests 驗證：

- 未登入者不能加入或讀取房間。
- 房間成員只能讀取該房間公開資料。
- 玩家只能讀取自己的 private profile。
- 普通玩家不能修改 room phase、角色、答案、總分或其他玩家資料。
- 只有房主能推進 phase、開始／結束回合及寫入揭露結果。
- 玩家只能寫入自己的暱稱、presence、發言完成狀態，以及符合當前階段的工殺毀事件。
- 不能對自己出工殺毀。
- 不能在非發言階段出工殺毀。

所有文件都寫入 `expiresAt`，並為需要清理的 collection group 分別設定 Firestore TTL：

- `rooms`
- `players`
- `private`
- `rounds`
- `cardEvents`

房主關閉房間只標記 `closed`，不依賴前端立即刪除；TTL 作為最終清理機制。

### App Hosting 設定步驟

1. 確認既有 Firebase project 的 Blaze billing、Firestore、Anonymous Auth、AI Logic 與 App Check 權限。
2. 設定 budget alert、Gemini quota 與 Firestore 使用量監控。
3. 在現有 repository 連接 GitHub／Developer Connect；目前 repository 尚未配置 Git remote，需由 Ops 處理。
4. 建立獨立 App Hosting backend，root directory 指向目前 Angular app 的 `client/`。
5. 先用現有 app 建立最小 rollout，確認 App Hosting 能建置 Angular 22 client-side app。
6. 若 App Hosting rollout 受現有 `start` script 或 Angular builder 影響，再調整 `client/package.json`／`apphosting.yaml`；不引入自訂 API server。
7. 啟用指定 branch 的自動 rollout，並保留 Firebase Hosting 作 fallback。
8. 在 App Hosting URL 上執行：建立房間 → 手機加入 → Firestore 同步 → AI 題目預覽。
9. 將 App Hosting URL、Firebase Hosting fallback URL、Firebase project、測試房間清理方式寫入 bonus runbook；不寫入 CAT WALK 主線文件。

### 建議執行順序與估時

估時單位：1 person-day = 8 小時；以下為 bonus 額外工作量，不併入 CAT WALK 已核准容量。估算假設一位主要實作者搭配 Ops 與一位 reviewer，並保留約 20% 風險緩衝。

| 階段 | 主要工作 | 產出 | 估計 |
| --- | --- | --- | ---: |
| 0 | Bonus scope、branch、Firebase project 與權限確認 | 需求與環境檢查表 | 4h |
| 1 | App Hosting／Auth／Firestore／AI Logic spike | 最小前端 rollout | 10h |
| 2 | `/party-game` 路由、匿名身份與手機 shell | 可開啟的遊戲入口 | 8h |
| 3 | 建房、加入、QR、分享、Lobby | 5～10 人 Lobby | 14h |
| 4 | Firestore model、listener、Rules、Emulator tests | 可同步且可測試的資料層 | 18h |
| 5 | 狀態機、主持人控制、玩家流程與角色私有資料 | 可完成單局遊戲 | 30h |
| 6 | Firebase AI Logic、prompt、schema、fallback、reroll | 可預覽與重新生成題目 | 16h |
| 7 | 工殺毀、計分、回合揭露、最終排名 | 可完成多局與結算 | 12h |
| 8 | 斷線恢復、暫停、TTL、錯誤狀態 | Demo 韌性 | 8h |
| 9 | 單元測試、Rules tests、5～10 手機驗收 | 測試紀錄與缺陷清單 | 20h |
| 10 | 手機 UI polish、App Hosting rollout、Demo runbook | 可展示版本與 fallback | 10h |
|  | **基準合計** |  | **150h／18.75 pd** |
|  | **20% 風險緩衝** | App Hosting、AI、多人同步整合風險 | **30h／3.75 pd** |
|  | **建議預留總量** |  | **180h／22.5 pd** |

若實際可用容量不足，優先保留階段 1、3、4、5、6、7、9；先刪除 debug 視覺 polish、複雜動畫與非必要房間管理功能。

### 測試關卡

#### 單元測試

- 猜題人公平選擇：未擔任過者優先、同次數隨機打散。
- 老實人與唬爛人分配數量正確。
- 1～5 局與玩家數不一致時的公平提示。
- 題目 JSON parser 與三領域驗證。
- 公開資料與 private 資料的映射。
- 合法／非法狀態轉換。
- 工殺毀不能對自己、不能超過每局 3 張、不能在錯誤階段使用。
- 正確猜測 +1／+1，錯誤猜測 +3。
- 未完成回合不計分。
- 題目重新生成不增加局數、不提前分配角色。

#### Firebase Emulator Rules tests

- 匿名玩家只能讀自己的 private profile。
- 普通玩家不能修改房主控制的 room phase。
- 普通玩家不能修改其他玩家分數或角色。
- 房主可以控制目前房間，但不能透過一般 UI 讀取其他玩家 private 資料。
- 房間已鎖定或已滿時不能新增玩家。
- 工殺毀寫入符合當前發言狀態與目標限制。

#### 真人多人驗收

至少準備主持人手機加 4 支玩家手機，最後以 5～10 個獨立 browser session 驗證：

1. 手機主持人建立房間。
2. 其他手機用 QR／分享連結／房間碼加入。
3. 測試 5 人下限、10 人上限與第 11 人拒絕。
4. 完成題目預覽、重新生成、現場確認與開始倒數。
5. 驗證倒數結束前看不到角色，結束後才看到角色。
6. 完成多位玩家發言與工殺毀。
7. 猜題人選擇玩家並公布答案。
8. 完成至少兩局，確認卡牌重置、分數累計與總結算。
9. 暫時關閉一支手機網路，確認恢復身份與房間狀態。
10. 模擬 AI 失敗，確認 fallback；測試 App Hosting 不可用時切到 Firebase Hosting。

### Demo 展示腳本

1. 主持人手機開啟 `/party-game` 並建立房間。
2. 主持人分享連結或展示 QR，4～9 支手機加入。
3. 顯示 Lobby 人數、暱稱與開始按鈕。
4. 主持人按「準備題目」，展示 AI debug 摘要與題目預覽。
5. 若有人知道答案，按「重新生成」；否則現場確認後開始本局。
6. 所有人看到 3、2、1；倒數結束後顯示猜題人與每個人的私有角色。
7. 玩家依序面對面發言，其他人視情況使用工殺毀。
8. 猜題人選擇老實人，主持人公布正確領域、角色與分數。
9. 進入第二局，展示猜題人公平輪替與工殺毀重新變成 3 張。
10. 提前結束或完成設定局數，展示總分、排名、使用數與收到數。

### Definition of Done

- `/party-game` 可從現有 app 進入，且不破壞主產品四個底部 Tab。
- App Hosting 可部署前端；Firebase Hosting fallback 仍可使用。
- 5～10 名手機瀏覽器可加入同一房間，主持人包含在總人數內。
- Firestore listener 可同步 Lobby、倒數、階段、發言、工殺毀、猜題與結算。
- Firebase AI Logic 至少成功生成一題低知名度冷知識，並可手動重新生成。
- AI 題目失敗時，fallback 題庫仍可完成遊戲。
- 三個領域選項中只有一個正確，且答案揭露前不標示正誤。
- 角色在倒數結束前不可由一般 UI 看見。
- 工殺毀每局 3 張、事件即時公開、下一局重置。
- 分數規則、多局累計、提前結束與最終統計正確。
- 斷線恢復、房間鎖定、滿房、重複暱稱與錯誤提示可操作。
- Firestore Rules tests 與核心單元測試通過。
- App Hosting、Firestore、AI Logic 使用量與成本提醒已設定。
- 所有 bonus 變更維持在本文件與 bonus 程式碼範圍，不修改 `CONTEXT.md` 或主線規劃。
