# CAT WALK 營運管理

本次 scope 已在根目錄 `CONTEXT.md` 確認。CMS 使用 Angular **20.3.24** 與行內
rootNgV2（`cub-lib-view-rootng` **2.2.1**）。最新版 kit 宣告 Angular `^20.3.0` peers，
因此採用使用者明確允許的 Angular 20 例外；用戶端維持 Angular 22.1.4。
介面完全使用 rootNgV2 元件與官方 utilities，不加入自訂視覺樣式或替代元件。
Layout 對照 CRD 的 `layouts/components/container` 與 `topbar`：標準 header logo、
`cub-collapsible-menu` 側欄、桌面收合／小螢幕 overlay、breadcrumb、預設內容間距及
`cubLayoutFooter`。`styles.scss` 只載入 Cathay green 主題（已包含官方 utilities）。

## 前端結構

- `src/app/app.component.*`：共用 CRD Layout、登入、側欄與頁面資訊卡片。
- `src/app/app.routes.ts`：七個獨立、延遲載入的功能 route。
- `src/app/pages/`：`dashboard`、`merchants`、`trees`、`rewards`、`scenes`、
  `budget`、`ai` 各自的頁面元件與模板。
- `src/app/shared/`：發布操作、資料表、種子匯入、編輯與發布彈窗。
- `src/app/cms-workspace.service.ts`：跨頁共用草稿、修訂、命令與頁面狀態；
  切換 route 保留未儲存修改，重新整理則維持原本的離頁提醒。
- `src/app/cms.service.ts`：Firebase 身分驗證、資料訂閱與 callable 存取。

各功能內容、工具列、匯入與統計提示均使用 `cub-card` 包裝。網址可直接開啟，
瀏覽器上一頁／下一頁會同步選單與頁面；Hosting 的 `/cms/**` rewrite 支援深層網址。

## 本機啟動

```powershell
cd cms
npm ci
npm start
```

瀏覽 `http://localhost:4200`。npm 使用既有行內 registry 設定，請勿把認證寫入 repo。
預設使用現有 Firebase Demo project。登入不等於獲得管理權限。

## 站點、任務與商品 CRUD

- 商家與站點、種樹點：新增、搜尋、編輯、移除與角色／啟用設定；編輯視窗可用 Google Maps 選位置。
- 任務管理 `/tasks`：每日／每週／活動任務，設定板橋或西湖、台北時間起訖、目的地與地圖座標。
  每日／每週發水滴，活動發肥料；此處是有起訖時間的單期任務，不會自動排程產生下一期。
  AI 所選的額外補給目標仍屬站點路線規劃，與這個任務功能分開。
- 商品與兌換：新增、搜尋、編輯、移除、啟停商品／公益項目，設定小樹點價格與兌換成本。
- 所有變更先套用草稿，再儲存及發布。正常範圍發布會同步既有 `/tasks`；停用／移除會封存
  該 CMS 任務，保留玩家完成紀錄與已發獎快照，不會更動其他未納管任務。
  正常範圍可按「載入既有 Firebase 任務到草稿」先讀取、檢查後再接管；此動作本身不修改線上任務。
- Demo 任務從 Demo 發布設定讀取，完成紀錄與獎勵留在原有本機展示流程，絕不寫入正常 `/tasks`。
  種子中包含既有任務範例，其起日為 2026-10-21，匯入時請檢查活動期間；不要把過期範例當成有效任務。
  匯入完整種子會替換目前草稿，已有編輯時請先確認是否要覆蓋。

## Google Maps 選點設定

將 `cms/public/maps-config.example.json` 複製為 `cms/public/maps-config.json`，填入瀏覽器專用 API key。
實際設定檔已列入 Git ignore；Google Maps key 會由瀏覽器使用，必須限制網站來源與允許 API。
正式地圖可設定自己的 Map ID；`DEMO_MAP_ID` 僅供開發展示。

啟用 Maps JavaScript API；地址搜尋另需 Geocoding API。網址限制應包含實際使用來源，例如：

```text
http://localhost:4200/*
http://127.0.0.1:4200/*
https://cathay-ai-hackathon-team-03.web.app/*
```

如使用其他 Hosting 網域，也要加入對應來源。保留既有來源，無須取消網站限制。
參考 [Google Maps 載入方式](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)、
[Geocoding 設定](https://developers.google.com/maps/documentation/javascript/geocoding)、
[網站限制錯誤](https://developers.google.com/maps/documentation/javascript/error-messages#referer-not-allowed-map-error)。

可搜尋地址後挑選結果，或點擊地圖、拖曳標記，同步緯度與經度。只有選定搜尋結果才帶入地址，
單純移動座標不會聲稱已查證店家地址。地圖設定缺少／授權失敗時仍可手動輸入座標。
部署前確認設定檔被複製至 CMS build；建置成功不代表金鑰來源限制已允許網站。

## 管理員與 Gemini 設定

1. 指定 Google 帳號先登入一次，讓 Firebase Auth 建立身分。
2. 具 IAM 權限的操作人員在 `functions/` 以 Application Default Credentials 執行：

   ```powershell
   node scripts/grant-cms-admin.mjs cathay-ai-hackathon-team-03 USER_GOOGLE_EMAIL grant
   ```

   撤銷用 `revoke`。此工具保留其他 custom claims，不會自行授權任何帳號。
   更新後登出再登入，刷新 token。伺服器和 Rules 都檢查 `cmsAdmin`、驗證過的信箱與 Google provider。

3. 啟用 Vertex AI API，給 **Functions 執行身分** `roles/aiplatform.user`，設定允許的模型與配額。
   Gemini 使用 GCP 執行身分呼叫 Vertex AI，瀏覽器不持有模型金鑰。
   Functions 參數 `CMS_GEMINI_MODEL` 預設 `gemini-2.5-flash`、`CMS_GEMINI_LOCATION` 預設 `global`；
   部署前確認專案實際可用模型，必要時設定其他模型。正式測試必須確認回傳 `source: gemini`。
   `source: rules` 表示備援，不能宣稱完成實際 Gemini 驗證。
4. 建置並部署此次 CMS callable Functions、排程清理與 Firestore Rules。
   從 repo 根目錄執行以下指令，只部署 CMS 函式與規則：

   ```powershell
   firebase.cmd deploy --only functions:cmsCommand,functions:cmsTrack,functions:cmsDashboard,functions:cmsWallet,functions:cmsRedeem,functions:cmsHarvest,functions:cmsResetDemo,functions:cmsRecommend,functions:cmsValidateStation,functions:cmsCleanup,firestore:rules --project cathay-ai-hackathon-team-03 --non-interactive
   ```

   `functions/.env.cathay-ai-hackathon-team-03` 明確提供上述兩個公開模型參數，
   讓 CLI 可非互動部署；檔案不可放入憑證或模型金鑰。首次部署排程會啟用 Cloud Scheduler API。
   管理員 custom claim、Vertex AI IAM、種子匯入與獎勵預算仍須分別設定。

Vertex AI REST 介面依據 [Google 官方 quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)。
AI 僅取得商家名稱、優惠、允許角色及四捨五入距離，不接收或儲存玩家起點座標。
它只能選擇六公里內最多 20 個已發布有效候選中的最多六站；輸出須通過 ID 與角色驗證。
  最多等待十五秒模型回應，關閉簡單推薦任務的思考模式；出錯時使用規則備援，CMS 可檢視來源，首頁不顯示模型狀態訊息。每個身分每小時最多 20 次推薦。
用戶端仍須使用既有 Mapbox Directions 驗證實際步行道路，不能聲稱路線安全。

## 既有 mock 資料搬移

從 repo 根目錄執行：

```powershell
node scripts/build-cms-seed.mjs
```

產生 `firebase/seed/cms-demo.json` 與 `cms/public/cms-demo.json`。生成器讀取現有 mock，
不改動 `environment-dev.ts`。原補給站沒有固定店址，種子明確使用「板橋展示區模擬位置」，
保留原名稱、優惠、補給與視覺；這些座標不是經查證的店家地址。
商城改為收成直接入帳小樹點，再以小樹點兌換模擬商品，原成熟樹換點數流程已被新決策取代。
商品採既有產品脈絡的飲品 30 點、交通 50 點及公益 50 點基線，可於 CMS 修改。

登入 CMS → 選 **Demo** → 內容頁下載／匯入種子 → **儲存草稿** → 檢查修改摘要 → **發布**。
這才會建立 Firebase 設定；本機 JSON 的存在不表示已寫入雲端。
另在成本頁設定每月獎勵預算與帳單來源。未設定時顯示未設定，不會捏造預算。

## 資料與發行規則

- `cmsDrafts/{demo|normal}`：管理員草稿，以 revision 檢查多人修改衝突。
- `cmsPublished/{demo|normal}`：只有可公開的站點、優惠、樹種、場景與商品設定；公開讀取、禁止直接寫入。
- `cmsAudit`：伺服器記錄操作人、時間、版本及設定內容。
- `cmsPlayers/{scope}/players/{uid}`：帳號錢包與交易摘要，所有命令在伺服器交易執行。
- `cmsRedemptions/{scope}/entries`：不可由用戶端修改的兌換紀錄，保留當時商品價格、成本與版本。
- `cmsPointLedger/{scope}/entries`：初始展示種子、收成、兌換與重設的點數異動帳本。
- `cmsEvents/{scope}/events`：去識別 actor、事件名稱、實體 ID、伺服器時間，不含步行軌跡或住家座標。
- `cmsBudgets/{scope}`：每月 NT$ 獎勵預算、US$500 雲端總預算、人工帳單累計與來源。

用戶端透過 Firestore listener 接收發布，目標在線五秒內更新，不是斷線 SLA。
已種植的樹保留地點；已確認路線不自動改道。下架阻止新增加入及尚未領取補給。
設定改價後，待提交的兌換必須重新確認；伺服器再檢查版本、餘額、價格與 idempotency key。
重試同一筆不會重複扣點。Demo 錢包用獨立 Firebase 匿名身分，與正常 Google 身分隔離。
Demo 初始 2,680 點與 56 棵成熟樹為既有展示種子，並非實際使用成效。
重設僅處理目前 Demo UID，不會清除正常帳號或共同設定。

走路與收成仍屬原型的用戶端回報資料；正常帳號收成會比對已儲存 progress，
Demo 收成可模擬，不宣稱防作弊或真實健康資料。所有商品與交易均不具真實支付效力。
分析最多讀取每類 10,000 筆資料，超過會明確報錯，避免截斷後顯示失真比例。
新增 CMS 玩家、事件與兌換資料以 `cmsCleanup` 於展示結束七天後清理；現有使用者照片／
進度的原定清理流程仍由原 runbook 負責。展示結束後停用不再需要的排程與服務。

## 建置與 Hosting

```powershell
cd cms
npm run build -- --base-href /cms/
cd ../client
npm run build -- --configuration production,preview
cd ..
node scripts/prepare-cms-hosting.mjs
```

根目錄 `firebase.json` 在既有站台新增 `/cms/**` rewrite。CMS 放在 `/cms/`，
不另建站台、不覆蓋用戶端入口。以上只準備 build；review 後再執行既有 Firebase 部署流程。
Hosting 每次部署前都要重建並複製 CMS，否則新用戶端 build 不含 CMS。

本機測試 CMS Emulator：`http://localhost:4200/?emulators=1`；啟動根目錄
Firebase Auth 9099、Firestore 8080、Functions 5001。此開關僅接受 localhost。
現有 CAT WALK 用戶端仍沿用它原本的 Firebase 環境設定，CMS 的 emulator 開關不會改它。

## 現場驗收

1. 匯入／發布 Demo，新增模擬 TWQR 商家、座標、優惠與允許角色，再發布。
2. 保持用戶端開啟，確認地圖出現新種植點；種植畫面只呈現養成資訊與即時天氣／台北時段。
3. 選擇並確定終點後，才呼叫 Gemini 推薦額外補給站並顯示優惠。超過 60 分鐘的步行路線先詢問，取消不得呼叫 Gemini；CMS 可查看實際來源與理由。
4. 確認 Mapbox 道路成功後出發、模擬互動與收成，錢包只入帳一次。
5. 以小樹點兌換商品；重送同一 request ID 不會再次扣點。
6. 檢查 CMS 的導流、完成率、兌換成本，與不同帳號／Demo 資料隔離。
7. 下架站點或改價，確認不自動改道，舊交易保留版本，新提交被要求重新確認。
8. 關閉模型存取或模擬逾時，確認明確顯示「規則備援」。

導航僅表示意願，不可當作到店或消費證據。雲端費用不是自動讀取帳單。

## 驗證紀錄（2026-10-21）

- CRUD 擴充：站點、任務、商品的本機瀏覽器新增／編輯／移除檢查通過，390px 無水平溢出。
  `localhost:4200` 實際 Google Maps SDK 載入、點選與拖曳座標同步通過；金鑰目前拒絕 Geocoding API，
  地址搜尋未完成實際驗收。SDK 測試替身已驗證搜尋結果帶入，不能將此稱為實際 Geocoding 成功。
  CMS 與 client production+preview build 通過；Windows 持久快取損壞已備份重建，預設 build 再次通過。
  Functions 45 項測試通過，另有 Demo 任務 5 項測試通過。
  本次 `cmsCommand`、`completeTask` 與 Firestore Rules 已部署；九個 CMS callable 加 `completeTask`
  已從 4200 來源驗證 OPTIONS 204、未登入 POST 401。CLI 部署完成後仍有收尾逾時，
  兩個函式更新均回報成功。尚未自動匯入／發布任何任務，登入後的雲端 CRUD 仍須管理員驗收。
- 修復 CMS callable 尚未部署造成的 OPTIONS 404：十個 CMS 函式、Firestore Rules
  與每日清理排程已部署。九個 callable 的實際 OPTIONS 均為 204，未登入 POST 均為 401。
  CLI 在顯示 Deploy complete 後收尾逾時；部署紀錄為十項成功、零項失敗，且已獨立驗證 HTTP 回應。
  此檢查不代表已完成登入後資料查詢、種子發布或實際 Gemini 呼叫驗收。
- CMS production build、client production+preview build、Functions TypeScript build 通過。
- Functions 29 項測試通過，包含權限、衝突、交易重試、併發餘額、收成改價確認與 Gemini 輸出／備援。
- 相關 client 測試 235 項通過、3 項原有 skip；另有 14 項培育 modal 掛載測試失敗，
  使用 Git 中變更前的元件與模板副本也能重現同樣 14 項失敗，未宣稱全專案測試通過。
- Headless Chrome 使用本機資料檢查六個後台頁面、編輯表單與 390px 窄螢幕，無 Runtime exception，
  無整頁橫向溢出。此視覺檢查沒有授予雲端管理權限或寫入 Firebase。
- UI kit 有原始 bundle 大小、Moment CommonJS 與一項套件 CSS selector 的建置警告；未阻擋建置。
- 尚未部署、匯入雲端種子、指定管理員或完成實際 Vertex AI 呼叫驗收。
# Current data workflow (2026-10-21)

## Adding a CMS administrator

1. Ask the person to open the CMS and sign in once with their Google account.
   An unauthorized message is expected until the account is granted access.
2. From the repository root, use the authorized Firebase CLI login:

   ```powershell
   $env:HTTPS_PROXY='http://pxoawcg:8080'
   $env:HTTP_PROXY='http://pxoawcg:8080'
   $env:NO_PROXY='localhost,127.0.0.1'
   $env:NODE_USE_ENV_PROXY='1'
   $env:NODE_USE_SYSTEM_CA='1'
   $firebaseCliRoot = Join-Path (npm.cmd root -g) 'firebase-tools'
   node functions/scripts/grant-cms-admin.mjs cathay-ai-hackathon-team-03 person@gmail.com grant $firebaseCliRoot
   ```

   Replace `person@gmail.com` with the intended verified Google account. The CLI
   identity must be authorized to update Firebase Auth users. Without the last
   argument, the script uses Application Default Credentials instead.
3. Ask the person to sign out and sign in again to refresh their ID token.

The script preserves other claims and reads the resulting account back to
verify the requested role. Replace `grant` with `revoke` to remove access and
revoke refresh tokens. Existing ID tokens may remain valid until expiry.

The custom login component is an explicit presentation exception; the signed-in
CMS continues to use rootNgV2.

All content is simulated and shared by both client login modes. The CMS no
longer has a Demo/normal selector. `cmsDrafts/demo` and `cmsPublished/demo`
are the shared content documents; the `demo` suffix is a legacy storage key.
This replaces the older scope-selection instructions below. Player balances,
progress and transactions retain their account ownership.

Rebuild the package from the client fixtures:

```powershell
node scripts/build-cms-seed.mjs
npm.cmd --prefix functions run build
node functions/scripts/import-cms-seed.mjs cathay-ai-hackathon-team-03
```

The import uses Application Default Credentials. Alternatively, pass the
installed Firebase CLI package directory as a third argument to use its
existing login. It initializes and publishes only when both shared content
documents are absent; reruns preserve CMS edits. It never imports player
inventory or historical transactions into another account.

Manage merchants/stations/offers, tree presets/species, rewards, scenes and tasks
in their CMS pages. Save the draft, then publish to update the client. Task
publication also synchronizes CMS-owned `/tasks` entries for signed-in players.
Removing tasks disables future completions and preserves existing history.

## 2026-10-27 站點與即時天氣

本機種子目前有 92 個商家及 51 個種植點，包含板橋與台北市全部 12 個行政區；
其中新增的 65 個補給商家為明確標記的虛構展示資料。可在種子匯入頁按
「合併台北市／板橋擴充站點與種子機率池」，保留目前草稿中相同 ID 的營運編輯，
再儲存與發布。`firebase/seed/cms-expanded-2026-10-27.json` 保留 10/22 本機匯出中的
編輯並合併新站點，並非本次即時雲端匯出；完整檔案匯入會替換草稿，已有新編輯時優先使用合併按鈕。

Gemini 的候選走廊跟隨起終點與實際路線，推薦數量不再固定最多六站；回應仍須通過
已發布、有效、允許 supply 角色及既有 CUBE 偏好的檢查。CMS 模擬可自行輸入起終點，
管理預覽採直線走廊，實際玩家路線由 Mapbox 驗證。多於 25 個途經座標的路線分批銜接。

推薦與種植場景共用 [Open-Meteo current API](https://open-meteo.com/en/docs) 的天氣解析：
WMO code 及降水對應晴／陰／雨，包含氣溫和資料時間；過舊或查詢失敗時視為未知。
查詢座標僅取小數兩位且不保存。場景五分鐘更新天氣，時段每分鐘按 Asia/Taipei 更新，
05–07 清晨、07–17 白日、17–19 黃昏，其餘夜晚（素材切換的實作預設）。未知天氣使用中性陰天素材並顯示資料不可用。

本次尚未部署 Functions／Hosting 或更新雲端站點。`CONTEXT.md` 已記錄企業代理阻擋
Firestore 寫入的情況；限制解除前不可繞過政策重試寫入。新推薦協定需要同步部署
`cmsRecommend` 與前端後再驗收；既有種植進度不在匯入範圍內。

