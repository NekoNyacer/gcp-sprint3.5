# CAT WALK｜專案入口與 Onboarding

> 最後更新：2026-09-03  
> 專案代碼：CAT-WALK  
> Demo 工作名稱：**Cathay Go｜大樹同行**

## 先看這裡

CAT WALK 是一個面向一般大眾的下班健走 Demo。使用者透過走路、任務與公共地點打卡，取得資源來培育與自己回憶連結的大樹，並在成長里程碑示範 mock `小樹點` 回饋。

本頁是新成員的快速入口。完整且需版本控管的內容，請以 repository 中的下列文件為準：

- `CONTEXT.md`：產品方向、已確認決策、限制與未決事項的來源文件
- `docs/product/product-spec.md`：產品規格與使用者流程
- `docs/architecture/system-design.md`：Firebase/GCP Serverless 架構與資料邊界
- `docs/project/capacity-and-sprints.md`：容量、Sprint 與交付計畫
- `docs/azure-boards/backlog.md`：可讀的工作項目清單
- `docs/azure-boards/import-guide.md`：Azure Boards 匯入說明

## 專案目標

### 我們要解決的問題

許多上班族下班後會直接回家，缺少「再多走一段」的動機。CAT WALK 將步行轉化為看得見的樹木成長、地點記憶與獎勵，讓使用者有理由探索熟悉通勤路線之外的一小段路。

### Demo 要證明的價值

- 讓管理者在五分鐘內理解「走路 → 資源 → 樹木成長 → 回饋」的完整循環。
- 透過公共地點與私人回憶林，建立持續回訪與品牌連結。
- 向一般大眾介紹 `小樹點` 的概念，而不是只服務既有壽險 App 使用者。
- 以瀏覽器完成可操作 Demo；若政策與時間允許，再提供 Android APK。

`CAT` 是 Cathay 的專案前綴，不代表產品要使用貓咪主題。視覺與互動的核心意象是國泰大樹。Pikmin Bloom 只是動機迴路的參考，不使用其角色、素材、名稱或照搬其呈現方式。

## 核心產品循環

```text
下班多走一段
    ↓
取得光能／水滴／肥料
    ↓
完成任務、在公共地點拍照打卡
    ↓
靠近自己的樹，投入資源培育
    ↓
樹木成長並留下地點與步行回憶
    ↓
達到里程碑，領取 mock 小樹點
    ↓
兌換目錄或 ESG 捐贈
```

產品支援兩種活動模式：

1. **主動任務**：使用者選擇種植、取水或養分配送任務，查看路線與安全提醒，步行並拍照打卡。
2. **被動累積**：目標產品可讀取 Android 日步數；本次 Demo 以網頁步數模擬器完成，Health Connect 列為 Could。

所有有效步數每天只計一次。主動任務中的步數已包含在當日步數，不會重複計算；任務完成會另外發放該任務的資源。

## Demo 範圍

### Must：本次必須完成

- Web Google Sign-In、漸進式 onboarding 與準備好的 Demo 身份退路
- 首頁、任務、森林、`小樹點` 四個主要頁籤
- Web 模擬步數、每日資源計算與多棵樹的成長
- 六個人工審核的公共任務點，以及種植、取水、養分配送三種任務
- 規則式路線推薦、地圖、安全提醒與模擬到達退路
- 相機或既有圖片選擇的照片打卡流程
- 資源投入預覽、持續樹木成長、里程碑收成
- mock `小樹點` 錢包、兌換目錄與 ESG 捐贈
- 私人回憶林、Firebase Hosting/Auth/Firestore/Storage
- 五個 TypeScript Firebase callable commands、Security Rules、Demo Mode 與必要失敗退路

### Should：有餘裕再完成

- 簽署 Android APK、原生 Google Sign-In、原生相機
- Android 本機下班提醒
- Gemini 將自由文字轉換成受限的路線偏好
- 以 seeded data 呈現排行榜與一筆好友貢獻

### Could：不影響主流程

- Health Connect 真實背景步數
- Android 真實 GPS 到達
- Three.js 樹木展示、粒子效果與 seeded 鳥巢效果
- 更多任務、樹種、目錄商品或視覺細節

### 明確不在本次範圍

真實 `小樹點`、真實商家與付款、正式會員資料、好友邀請與資源轉移、任意地點任務生成、正式反作弊、健康醫療用途、iOS、AR、3D 地圖、AI 照片辨識、Weather API、FCM 推播、CMS，以及獨立 production Firebase/GCP 環境。

## 重要業務規則

### 資源與樹木

- `光能` 是步數產生的資源名稱，目前仍是工作名稱；每 1 光能可轉成 1 點樹木成長值。
- 每日 0–5,000 步：每完成 500 步得 3 光能，共 30 光能。
- 每日 5,001–7,500 步：每再完成 500 步得 4 光能，最高共 50 光能。
- 超過 7,500 步仍顯示步數，但本 Demo 不再增加光能。
- `水滴`：完成指定取水任務，每個水源每天最多取得 1 個；1 水滴提供 10 點成長值。
- `肥料`：完成養分配送任務；一次讓本次投入增加 20% 成長值，每棵樹每天最多使用一次。
- 樹木階段為：0 種子、500 幼苗、1,500 小樹、3,000 成樹、5,000 大樹。
- 每累積 5,000 點樹木成長，可收成 50 mock `小樹點`；樹木不會被消耗或重置。
- 每個帳號每天最多收成一次 `小樹點`。樹木可持續成長，後續以圓環、星星、季節裝飾或動物呈現，不無限放大模型。

### 任務與種樹

- 種樹需要 1 顆種子、完成主動種植任務，並在人工審核的公共地點完成照片打卡。
- 新使用者得到 1 顆起始種子；後續種子來自週目標、成就或特殊配送任務。
- 取水與養分配送任務依每日規則發放 `水滴` 或 `肥料`。
- Demo 僅使用六個人工審核的公共任務點，不支援任意地點生成任務。
- 同一地標可以有多棵歷史樹，集中顯示為一個私人回憶林；同一路線可以重玩，但每天只給一次符合規則的任務獎勵。

### 路線、位置與隱私

- 路線推薦依目前位置、下一個通勤目的地、可接受的額外步行時間與單程／回到起點偏好，從版本化路線模板中進行規則式排名。
- 住家／公司精確座標只保存在裝置本機，僅於 `recommendRoute` 呼叫時暫時傳送，不寫入 Firestore 或 log。
- 樹木位置使用 Place ID、地標名稱與模糊化座標；私人森林預設為私人，不公開精確 GPS 點。
- 資源投入與 `小樹點` 收成需在樹木約 150 公尺內；Demo Mode 可模擬距離。
- 養分投入在確認前必須顯示扣除資源、基本成長、加成與結果；確認後為整數交易且不可撤銷。

## 五分鐘 Demo 流程

1. 使用 Google 登入 `Cathay Go｜大樹同行`。
2. 展示首頁的今日步數、三種資源與多棵樹。
3. 選擇 15 分鐘下班繞行，查看規則式路線推薦與安全提醒。
4. 以 Demo Mode 模擬步行，完成取水照片打卡並取得 `水滴`。
5. 完成養分配送任務並取得 `肥料`。
6. 抵達樹木附近，預覽並確認光能／水滴投入。
7. 展示樹木成長與里程碑收成。
8. 收成 50 mock `小樹點`，展示交通兌換或 ESG 捐贈。
9. 最後展示私人回憶林、seeded 好友貢獻與排行榜。

兩分鐘版本從預先接近里程碑的帳號開始；若線上服務不可用，改用 seeded Demo Mode 或預錄影片。

## 技術方向

### Client

- Ionic 9、Angular 22、TypeScript 6、Angular Signals
- Web 優先，支援 Windows 上的 Chrome／Edge 與至少 360×800 的響應式版面
- Demo 步數模擬、Demo seed/cache、拍照／選檔與待上傳重試由 Client 處理

### Firebase/GCP

- Firebase Hosting：Preview Channel 作為 PR／Demo 驗收點
- Firebase Authentication：Google provider
- Cloud Firestore：資料與 read model
- Cloud Storage：照片
- Firebase Functions Gen 2：五個 TypeScript callable commands
- Firebase Emulator Suite：Auth、Functions、Firestore、Storage 與 Rules tests
- App Check、Security Rules、命令端驗證、idempotency key 與不可變 ledger 保護會改變資源或獎勵的操作

五個 callable commands：

| Command | 責任 |
| --- | --- |
| `syncDailySteps` | 合併每日步數並發放光能 |
| `completeTask` | 驗證限時定點 Task 並原子發放水滴或肥料 |
| `nurtureTree` | 原子扣除資源並增加樹木成長 |
| `redeemReward` | 里程碑收成、目錄兌換與 ESG 捐贈 |
| `recommendRoute` | 從核可路線模板中進行推薦 |

本專案不建立 Java 或 .NET 應用後端。所有會改變步數、資源、樹木成長或 mock `小樹點` 價值的操作，都必須經過可信任的 Firebase command 層。

## 失敗時的 Demo 退路

| 情況 | 退路 |
| --- | --- |
| Gemini 失敗 | 使用規則式路線推薦 |
| Routes／路線服務失敗 | 載入人工審核的預設路線模板 |
| GPS 被拒絕 | 手動或模擬到達 |
| 相機被拒絕 | 選擇既有圖片 |
| 照片上傳失敗 | 保留本機待上傳狀態並提供重試 |
| GCP／網路失敗 | 切換 seeded Demo Mode |
| Google 登入失敗 | 使用準備好的 Demo 身份 |
| WebGL 失敗 | 使用 2D 樹木畫面 |

## 交付時程

| Sprint | 日期 | 主要目標 |
| --- | --- | --- |
| Sprint 0 | 09/03–09/09 | UX、Firebase 基礎、風險技術 spike |
| Sprint 1 | 09/10–09/23 | 登入、首頁、步數、資源、樹木核心 |
| Sprint 2 | 09/24–10/07 | 路線、地圖、任務、照片打卡 |
| Sprint 3 | 10/08–10/21 | 森林、回憶、錢包、Android 整合 |
| Sprint 4 | 10/22–11/05 | 剩餘 Must、品質、錄影、彩排與修正 |

- 開發窗口：2026-09-03 至 2026-11-05
- 2026-11-06 至 2026-11-08：Feature freeze，只處理彩排與 Demo-blocking 問題
- 正式展示：2026-11-09，Google 板橋辦公室
- 目前容量校正建議：10/21 先達成五分鐘核心路徑 feature complete，11/05 完成剩餘 Must；此排程調整仍待產品負責人確認。

## 團隊協作方式

- .NET 全端工程師兼任產品負責人、主要 UI 實作者、整合與後端協調者。
- 三位 Java 全端工程師以支援貢獻者角色協作；不要以四位全職工程師估算容量。
- Operations 負責 GCP 服務申請與整合支援。
- UI/UX 設計師以顧問角色參與。
- Azure Boards 使用 `Epic → Feature → User Story → Task` 層級。
- Feature 以跨職能人日估算；User Story／Task 以小時與 Story Points 管理。
- 任何改變產品方向、架構、交付日期或協作規則的決定，都要同步更新 `CONTEXT.md`。
- Must 工作項目完成前，需通過驗收條件、適當測試、Preview 驗收、失敗退路、至少一位隊友 PR review，以及產品負責人的 happy path 驗證。

## 目前未決事項

以下事項尚未確認，請不要自行當成定案：

1. Firebase App Distribution 與個人 S22+ 測試機的公司政策及安裝方式。
2. `光能` 與 `Cathay Go｜大樹同行` 是否沿用工作名稱。
3. Three.js spike 通過後是否納入 Demo。
4. 10/21 核心路徑、11/05 全 Must 的容量校正排程。
5. 六個公共 POI 的最終選點與現場確認。

產品設計的 discovery 已完成。後續若要改變目前基準，請先在團隊內確認，再將決定記錄到 `CONTEXT.md`、產品規格與 Azure Boards。

## 新成員加入後的建議順序

1. 先讀本頁，理解產品故事與 Must 範圍。
2. 再讀 `CONTEXT.md`，確認目前決策與不可踩的限制。
3. 依負責工作閱讀產品規格或系統設計。
4. 到 Azure Boards 查看目前 Sprint、Feature、User Story 與負責人。
5. 開發前先確認自己處理的是既有範圍；若需要改方向，先提出討論，不要直接默默擴大 scope。
