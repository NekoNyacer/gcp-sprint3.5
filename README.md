# CAT WALK｜國泰健走去（CAT-WALK）

## 專案簡介

CAT WALK 是一個面向大眾的健走互動 Demo，工作名稱為「Cathay Walk｜國泰健走去」。產品希望鼓勵上班族在下班後多走一段路，將每日步行累積的資源投入地點型大樹，逐步培養個人專屬的私人回憶林。

使用者可以透過步行取得 `光能`，完成種樹、取水與營養配送任務取得其他資源，再回到已種植的大樹附近進行培育。大樹會持續成長，並在成長里程碑提供模擬的 `小樹點` 回饋、兌換與 ESG 捐樹體驗。

`CAT` 是 Cathay 的專案前綴，產品不是貓咪主題；樹木種植與成長才是本專案的核心意象。

## 專案目標

本專案以兩個月內完成一條完整、可靠的互動展示流程為目標，優先確保瀏覽器 Demo 可以展示：

- Google 登入、首頁與漸進式導覽
- 模擬步數與三種資源累積
- 六個策劃任務點、路線推薦與照片打卡
- 大樹種植、培育、成長、回憶林與里程碑收穫
- 模擬 `小樹點` 錢包、兌換目錄與 ESG 捐樹

Android APK、Gemini、Health Connect、真實 GPS 與 Three.js 等功能，只有在不影響主要展示流程時才加入。所有獎勵、好友、天氣與健康資料均以 Demo、模擬或種子資料呈現，不代表正式商業服務。

## 技術方向

- `client/`：Ionic 9、Angular 22、TypeScript 6 前端
- Firebase Hosting：前端託管
- Firebase Authentication、Firestore、Cloud Storage：登入、資料與照片
- TypeScript Firebase Functions：處理步數、任務、樹木培育、獎勵與路線推薦等受信任操作
- Firebase Emulator Suite 與 Demo Mode：本機開發、展示與資料復原

## Repository 結構

- `client/`：前端應用程式
- `docs/`：產品規格、系統設計、專案規劃與 Azure Boards 匯入資料
- `skills-main/`：專案共用的 Matt Pocock skills，除非明確要求，請勿修改其第三方內容
- `CONTEXT.md`：產品、技術、交付與未決事項的唯一事實來源
- `AGENTS.md`：協作者與 AI agent 的專案工作約定

## 開發協作與決策依據

當開發、設計或技術實作遇到疑慮時，請先請 AI agent 查看 [`CONTEXT.md`](./CONTEXT.md)，確認目前已決定的產品方向、範圍、技術架構與展示優先順序，讓開發過程不會偏離目前的共識。

任何可能改變產品、技術、交付或專案管理方向的作法，都不應直接視為既定決策。請先提出疑慮與影響；確認後再更新 [`CONTEXT.md`](./CONTEXT.md)，並同步調整相關規格或規劃文件。

## 重要文件

- [`CONTEXT.md`](./CONTEXT.md)：專案完整背景與決策紀錄
- [`docs/product/product-spec.md`](./docs/product/product-spec.md)：產品規格與驗收界線
- [`docs/architecture/system-design.md`](./docs/architecture/system-design.md)：系統架構與資料邊界
- [`docs/project/capacity-and-sprints.md`](./docs/project/capacity-and-sprints.md)：團隊容量與 Sprint 規劃
- [`docs/azure-boards/backlog.md`](./docs/azure-boards/backlog.md)：Azure Boards backlog 摘要

## 展示成功定義

在 2026-11-09 的展示中，能以瀏覽器穩定完成五分鐘主流程；若外部服務或裝置整合不可用，則使用預先準備的 Demo Mode 與種子資料完成展示。
