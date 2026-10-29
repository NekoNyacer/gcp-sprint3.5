# Mapbox 健走／任務地圖可行性研究

日期：2026-10-05  
狀態：研究結論；尚未做產品或技術選型決定  
範圍：Ionic 9、Angular 22、Capacitor 8 的 CAT WALK Demo。僅採用 Mapbox 官方一手文件與目前程式碼盤點。

## 結論

**可行，且適合把地圖升級為主線 Demo 的沉浸式「世界地圖」。** 建議以 **Mapbox GL JS 3.x 跑在既有 Ionic WebView／瀏覽器中**，而非先導入 Android 原生 Maps 或 Navigation SDK。這條路能以 GeoJSON source + Style Layers 做出任務路線、玩家位置、可採集／任務點、私人樹叢與自訂精靈圖示；Mapbox Standard 本身也有 3D 建築與動態光照。Mapbox GL JS 以 WebGL canvas 繪製，地圖資料 layer 比 HTML markers 更適合同屏的大量圖徵。 [Mapbox GL JS：Style Layers](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/style-layers/) [Mapbox Styles](https://docs.mapbox.com/map-styles/guides/)

這是**呈現與路線預覽的替換**，不是任務驗證機制的替換：目前 `TaskLocationService` 取得座標／精確度，`completeTask` 在 server 端重新驗證距離與期限的設計仍應原封不動。Mapbox 的 GeolocateControl 同樣只使用瀏覽器 Geolocation；在 HTTPS、裝置與使用者授權不足時會停用，不能作為 Demo 或反作弊依據。 [GeolocateControl](https://docs.mapbox.com/mapbox-gl-js/api/markers/)

## 目前專案相容性盤點

| 面向 | 現況 | 對 Mapbox 的意義 |
| --- | --- | --- |
| 前端 | Ionic 9 / Angular 22 / TypeScript 6；Angular standalone component | Mapbox GL JS 是一般 npm JavaScript library，官方支援 `npm install mapbox-gl` 的現代 framework 整合方式；不必等 Angular 專屬 wrapper。 [官方安裝指南](https://docs.mapbox.com/mapbox-gl-js/guides/get-started/) |
| 現行地圖 | `HomeMapComponent` 依賴 `@angular/google-maps`，只顯示一棵樹與 demo map ID；`index.html` 直接載入 Google Maps JS | 遷移面積小：以一個 framework-agnostic `MapSceneComponent`/map port 取代首頁呈現；移除 Google script 與套件要留到 Mapbox spike 驗收後才做。 |
| 任務 | Task 詳情頁是 map placeholder；路線／導航在 Task spec 明定為獨立模組 | 可先做「地圖 + 任務 route preview + 到達狀態」，不需要改 Task Store、repository、Functions 或 Firestore contract。 |
| 定位 | 已封裝 `TaskLocationService`，透過 `navigator.geolocation.getCurrentPosition` 產生 `LocationEvidence` | 可新增可取消的 `watchPosition`/location port 供地圖藍點使用，但將原始點只留在記憶體；完成任務仍只送現有 evidence 給 command。 |
| Android | Capacitor 8 將 Angular build 裝入 Android WebView；真 GPS 是 Could | GL JS 可用同一套 Web 內容同時服務 browser 和 WebView。原生 Mapbox Maps／Navigation SDK 需要 Kotlin、Gradle、Mapbox Maven repository，以及 native Capacitor bridge；不適合本次兩個月 Demo 主路線。 [Android Navigation 安裝要求](https://docs.mapbox.com/android/navigation/guides/install/) |

## 為何它能接近 Pikmin Bloom／Pokémon GO 的地圖語言

### 能直接運用的能力

- **視覺底圖。** Mapbox Style 可自訂資料來源、layers 與繪製方式；Mapbox Standard 是官方推薦的新專案底圖，提供 landmark 3D 建築、動態光照與 POI。 [Mapbox Styles](https://docs.mapbox.com/map-styles/guides/)
- **遊戲圖徵。** 將已核可 Task、樹／memory grove、玩家與任務 route 各做一個 GeoJSON source，再用 `symbol`、`circle`、`line`、`fill` 等 layer 和資料驅動 expression 呈現。Style layer 直接走 canvas，官方指出它比 HTML marker 更適合大量 points/lines/polygons。 [Style Layers](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/style-layers/) [Style expressions](https://docs.mapbox.com/mapbox-gl-js/guides/styles/style-layers/)
- **自訂圖示／精靈。** 可將品牌樹、種子、水滴、肥料、任務完成狀態用 Mapbox sprite 或 runtime image 放入 symbol layer；Style Spec 的 `background-pattern` 也可取 sprite image。 [Style Spec：Layers](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/)
- **路線與鏡頭。** Directions 回傳 GeoJSON 或 polyline route geometry，可用 line layer 顯示；進入任務時以 `fitBounds`/camera 取景、抵達時切換任務圖徵狀態。Mapbox GL JS 的 layer/source 是非同步，必須在 `load`/`style.load` 後建立。 [Directions API](https://docs.mapbox.com/api/navigation/directions/) [GL JS Layers](https://docs.mapbox.com/mapbox-gl-js/)
- **有限度的 3D。** Standard 已有 3D building；需要地形時可加入 DEM source 後呼叫 `setTerrain`，亦可用 `fill-extrusion` 做建物。較新的 Style Spec 也有 `model` layer，可從 GeoJSON/vector source 放 3D model。這些是視覺增強，不應阻擋 2D 主線。 [Terrain 範例](https://docs.mapbox.com/mapbox-gl-js/example/add-terrain/) [3D building 範例](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/) [Style Spec：model](https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/)

### 不應假設它自動提供的能力

- Mapbox GL JS 的定位控制項不是背景定位、反作弊或 App-native GPS；它依賴 Web Geolocation／HTTPS／使用者授權。 [GeolocateControl](https://docs.mapbox.com/mapbox-gl-js/api/markers/)
- Web 可用 Directions API 或 GL Directions plugin 做「路線預覽 + 文字轉向」，但官方將 web 的即時導航描述為較少見的情境；完整 turn-by-turn、re-route、離線與 voice guidance 屬 Android/iOS Navigation SDK 的範圍。 [Mapbox Navigation 產品概覽](https://docs.mapbox.com/help/getting-started/navigation/) [Android Navigation SDK](https://docs.mapbox.com/android/navigation/guides/)
- 因此 Demo 應把「開始健走」定義為**地圖上顯示建議步行線、目的地與距離**；不能承諾原生級 turn-by-turn、背景持續追蹤或離線導航。使用者仍可自由走其他實際路徑，抵達依既有 10m 規則驗證。

## 路線服務選項

1. **Demo 預設（推薦）：沿用版本化 seed polyline。** 現有 `recommendRoute` 的設計本來就從人工核可模板選擇 route。將 polyline 轉為 GeoJSON line 交給地圖畫出即可：可離線展示、成本固定、保留現有隱私與 8 秒 fallback，且不讓外部 API 改寫受控任務範圍。
2. **受控 live route enhancement：由 Cloud Function 呼叫 Directions API。** Directions API 支援 `mapbox/walking`（人行道／步道）、turn-by-turn steps、最多 25 coordinates、替代路線、`walking_speed` 和 `walkway_bias`。讓 callable 只接收暫時位置與目的地、回傳 geometry/instructions、不記錄 raw anchor，符合現有 `recommendRoute` 邊界；**不要把可濫用的 secret token 放前端**。 [Directions API](https://docs.mapbox.com/api/navigation/directions/)
3. **不列入本次主線：原生 Navigation SDK。** Android SDK 能提供 route line、navigation camera、voice 等，卻要加 native Kotlin dependencies、Mapbox Maven 憑證與 Capacitor bridge，且其 Android 安裝需要 public token 加具 `DOWNLOADS:READ` scope 的 private token 才能抓 Maven artifacts。這是第二期 Android native spike，不是 Web Demo 的前置條件。 [Android Navigation 安裝指南](https://docs.mapbox.com/android/navigation/guides/install/)

## 建議實作步驟（不在本研究中執行）

### Phase 0：先做 1–2 人日相容性 spike，通過再選型

1. 申請獨立 **Demo Mapbox account/project**、預算警示與兩種 token（web public、server secret）。以 Firebase Hosting preview URL、正式 Demo URL 加到 web public token 的 URL restrictions；public token 可暴露於 client，secret token 僅留在 Secret Manager／Functions。 [Access Tokens](https://docs.mapbox.com/help/dive-deeper/access-tokens/)
2. 在 feature branch 只安裝 `mapbox-gl` 與其 CSS，做一張 isolated route/page：Mobile Chrome、Firebase Hosting preview、Android WebView 各載一次圖。
3. 驗收：首圖在測試手機流暢；三種 Demo 定位狀態可切換；切換路由和重入頁面不殘留 WebGL canvas/listener；無 token、定位拒絕與 WebGL 不可用時顯示可操作的任務文字 fallback。
4. 成功才確認「Mapbox GL JS 是 Demo map renderer」這項決策並更新 `CONTEXT.md`、Task spec 與架構文件；失敗則保留 Google Maps/靜態 route card 作 fallback。

### Phase 1：建立可替換的地圖邊界

1. 定義 client-only `MapScenePort`（初始 camera、任務／樹／玩家 features、route geometry、事件），UI 只能依賴此 port，不直接讓 Task Store 知道 Mapbox type。
2. 實作 `MapboxSceneComponent`：在 Angular 的 browser-only lifecycle 建立 map，於 `load` 建 sources/layers；`ngOnDestroy` 呼叫 `map.remove()` 並取消定位 watcher。不要把 map instance 放入 Signal Store／Firestore。
3. 將任務／樹資料轉為單一 `FeatureCollection`，每筆的 `kind`、`state`、`rewardType`、`growthStage` 讓 layer expression 決定顏色、大小、icon。選點事件只回傳 domain ID，由既有 router/Task Store 導到詳情。
4. 先維持 `TaskLocationService` 的單次定位給完成驗證；另建 `LocationDisplayPort` 供**前景頁面**顯示玩家位置與 accuracy halo。未授權、無資料、Demo Mode 均顯示明確狀態與現有模擬入口。

### Phase 2：完成可講故事的地圖主線

1. 首頁世界地圖：樹／grove、六個受控任務點、可採集狀態和 map legend；任務 detail：聚焦目標、顯示 seed route、預估步行距離／時間。
2. 以 seed polyline 作 route source；任務開始後畫出 route progress（只作視覺，不作完成證明），進入 10m 且 accuracy 合格時啟用現有完成按鈕。
3. 為 Demo Mode 建固定、可重播的 player coordinates 和到達進度；絕不將模擬座標混入正常 Firebase 資料。
4. 最後才加入 Standard theme（綠／夜／雨的 light setting）、適度 3D buildings 和品牌 icon；小螢幕或低階機偵測退回 2D/少 layer。地形、custom 3D models、即時導航一律排在核心路徑之後。

### Phase 3：可選的 Directions live routing

1. 先確認台灣的實際 walking route 品質：針對六個 POI 各測兩個起點，人工核對人行道、路口、入口位置與 ETA；不合格即持續使用人工核可 seed routes。
2. 若接入，Cloud Function 對請求設 debounce、每 session 快取和 timeout；回傳 `geometries=geojson`、`steps=true`、`language=zh`（須先以官方支援語言實測確認）、`overview=full`。Directions API 的請求與地圖初始化要分別計量。
3. 仍以 server 的距離／accuracy／期限判定完成；Directions response 不保存使用者 exact current position。

## 成本、安全與維運判斷

- Mapbox GL JS Web 的 map load 是每次 map 初始化計一次；定價頁目前列出每月前 50,000 map loads 免費，之後為每 1,000 loads US$5 起。Directions API 目前前 100,000 monthly requests 免費，之後為每 1,000 US$2 起（依 tier）。這足以涵蓋內部 Demo，但帳號啟用時仍需以當下 pricing page、公司採購／條款審核為準。 [Mapbox Pricing](https://www.mapbox.com/pricing)
- Web 使用 `pk` public token 是設計用途，但必須分環境、最小 scopes、限制 Hosting URLs、定期輪換與看 token statistics；`sk` secret token 不可打包進 Angular、Android resource 或 Git。官方明確說 public token 可用於 browser/mobile，而 URL restrictions 能限制來源。 [Access Tokens](https://docs.mapbox.com/help/dive-deeper/access-tokens/)
- 現有 `client/src/index.html` 的 Google key 是直接寫入版本庫的 client key。即使 Mapbox 改用 public token，也應在選型／遷移時和 platform owner 一起盤點、限制或輪換舊 Google key，避免離線遺留；這是憑證衛生工作，不是本研究授權的程式碼變更。
- 畫面必須保留 Mapbox attribution，並在低 WebGL 能力／網路失敗時呈現 route/task text fallback。Mapbox Static Images 是官方提供給無互動地圖函式庫或不支援 WebGL device 的替代，不過本 Demo 可先用現有文字卡。 [Static Images API pricing 說明](https://www.mapbox.com/pricing)

## 風險、未決事項與建議決策

| 項目 | 評估 | 建議 |
| --- | --- | --- |
| Demo 時程 | 中：renderer 很可行，但自訂 icon、動畫、資料層與真機效能都會吃時間 | 將 Phase 0 gate 設在 1–2 人日；先交 2D 路線/任務 loop，3D 是 enhancement。 |
| 台灣步行路線品質 | 未驗證 | 不以 live routing 作 Must；六條經人工核對的 seed route 是可靠主線。 |
| 原生導航 | 高風險、超出 Web demo 範圍 | 暫不做 Capacitor native bridge／Navigation SDK。 |
| 隱私與驗證 | 現有設計足夠且不應退化 | 顯示位置僅前景記憶體；不記錄 anchor／track；server 為唯一發獎判定者。 |
| 視覺方向 | Mapbox 能達成遊戲化地圖，但不能直接複製 Pikmin Bloom/Pokémon GO 的素材、UI 或 trade dress | 用國泰樹、光能、水滴、肥料與原創 Cathay color/icon language。 |

**建議待產品 owner 確認的決策：** 採「Mapbox GL JS + seed route」為主線 Demo；Directions API 僅留作後續 enhancement；不把原生 Navigation SDK 納入 2026-11-09 的承諾範圍。決策前先完成 Phase 0 的三環境 spike 與台灣六點位的步行路線人工檢查。
