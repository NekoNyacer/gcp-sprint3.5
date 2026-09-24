# 兌換 Firebase／GCP 導入指南

更新日期：2026-09-16

## 目前實作狀態

- `/shop` 與 `/shop/history` 已使用 `ShopRepository` 的 seeded in-memory 實作完成可操作 Demo。
- Demo 資料目前只保存在 App 執行期間的記憶體；重新整理頁面會回到初始值。
- 本階段不需要先建立新的 GCP 服務，也不需要手動建立 Cloud Run。
- 專案 Client 已設定 Firebase 專案 `cathay-ai-hackathon-team-03`，並已有 Firebase Authentication 與 Cloud Firestore provider。
- Repository 尚未有 `firebase.json`、`.firebaserc`、`functions/`、Firestore Rules 或 Emulator 設定。

## 何時需要接 Firebase 後端

若要讓不同裝置共用資料、重新整理後保留交易、以伺服器時間驗證 365 天期限，或正式展示防重送與原子扣除，就需要建立以下項目：

1. Firebase Authentication：識別使用者。
2. Cloud Firestore：儲存 mock wallet、兌換資格、交易紀錄與 idempotency command。
3. TypeScript Cloud Functions for Firebase：由可信後端驗證並執行兌換。
4. Firestore Security Rules：Client 可讀自己的資料，但不可直接改寫餘額、資格或交易。
5. Firebase Local Emulator Suite：本機整合測試 Auth、Functions 與 Firestore。
6. Firebase Hosting：部署 Angular 靜態檔案；黑客松若已有其他部署方式可暫緩。
7. App Check：正式對外前再啟用，降低非官方 Client 濫用 callable function 的風險。

## Firebase Console 一次性設定

1. 開啟 Firebase Console，選擇 `cathay-ai-hackathon-team-03`。
2. 到 **Authentication → Sign-in method**，啟用 Google 登入。
3. 到 **Firestore Database** 建立 `(default)`、Native mode 資料庫。資料庫位置建立後不能任意更改，請先與團隊確認再選擇鄰近台灣且符合公司規範的位置。
4. 如果要部署 Cloud Functions，將專案升級為 Blaze 計費方案並在 Google Cloud 設定預算通知。Emulator 本機測試不需要 Blaze；部署 Functions 才需要。
5. 正式對外前，到 **App Check** 為 Web App 設定 reCAPTCHA Enterprise，先觀察流量再啟用強制執行。

## 本機初始化

在 `CUB-CAT_WALK_APP` 根目錄執行：

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
firebase init firestore
firebase init functions
firebase init emulators
firebase init hosting
```

互動選項建議：

- Functions 語言：TypeScript。
- Functions runtime：Node.js 22。
- Emulator：Authentication、Functions、Firestore、Hosting。
- Hosting public directory：`client/dist/client/browser`。
- Hosting single-page app rewrite：Yes。
- 不要覆寫 Angular build 產生的 `index.html`。

本機啟動：

```powershell
firebase emulators:start --only auth,firestore,functions,hosting
```

## 建議後端合約

建立單一 callable function `redeemReward`：

```ts
type RedeemRewardRequest =
  | { type: 'TREE_POINTS'; optionId: string; idempotencyKey: string }
  | { type: 'CHARITY'; campaignId: string; idempotencyKey: string };
```

Function 必須：

- 驗證 `request.auth.uid`，不得信任 Client 傳入的點數、金額或所需樹數。
- 由後端版本化設定查出兌換方案。
- 使用 Firestore transaction 取得未到期資格，依最早到期優先（FEFO）標記使用。
- 同一 `idempotencyKey` 重送時回傳第一次結果，不可重複扣除或入點。
- 原子更新 mock 小樹點餘額、資格與交易紀錄。
- 公益投入不修改小樹點餘額。
- 可預期但已受理的失敗需留下失敗紀錄；網路未送達不建立紀錄。
- 技術錯誤只寫入 Cloud Logging，不把內部原因顯示給使用者。

## 建議 Firestore 權限

- 使用者只能讀取自己 UID 下的兌換摘要與交易紀錄。
- Client 禁止直接建立或更新 wallet、entitlement、transaction、command result。
- 所有有金錢價值的寫入只由 Cloud Functions Admin SDK 執行。
- Rules 與 Functions 必須先在 Emulator 測試，再部署到共用專案。

## Client 切換方式

保留目前 `ShopRepository` 公開介面，新增 `FirebaseShopRepository`：

- `loadRedemptionData()`：讀取使用者成果摘要與交易。
- `loadTreePointsBalance()`：讀取 mock wallet。
- `redeemTreePoints()`／`donateToCharity()`：呼叫 `redeemReward` callable function。
- 接 GCP 時建議把目前實作重新命名為 `SeededDemoShopRepository`，再依 Demo／整合模式注入 seeded 或 Firebase 實作。

這樣可以保留目前畫面與 Store，不必在接 GCP 時重寫 UI。

## 部署指令

```powershell
cd client
npm run build
cd ..
firebase deploy --only firestore:rules,functions,hosting
```

部署前必須先在 Emulator 驗證：同一請求重送、資格不足、資格到期、兩個請求同時兌換、公益不入點，以及失敗不扣資格。

## 新對話交接方式

新開的 AI 對話不保證會自行讀取本文件。目前 repository 的 `AGENTS.md` 只強制先讀 `CONTEXT.md`，而本功能依產品負責人要求沒有修改 `CONTEXT.md`。

開始新的 GCP 串接對話時，請在第一句明確提供：

```text
請先閱讀 CONTEXT.md、docs/product/outcome-redemption-spec.md、
docs/product/outcome-redemption-gcp-setup.md，然後接續實作 shop 的 Firebase/GCP 串接。
不要直接修改 CONTEXT.md。
```
