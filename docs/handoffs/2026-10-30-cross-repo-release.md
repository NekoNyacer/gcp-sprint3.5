# 2026-10-30 推版交接：跨 repo 合併

本檔供 2026-10-31 合併到另一個 repo 使用，日期以 Asia/Taipei 為準。目標 repo URL、目標分支與兩邊共同基底尚未提供，留待執行時確認；本次只提交並推送來源 repo，未代為合併或新增雲端部署。

## 來源與提交範圍

| 項目 | 值 |
| --- | --- |
| 來源 repo | https://github.com/NekoNyacer/gcp-sprint3.5.git |
| 來源分支 | `develop` |
| 本批基底 | `021eba9cdb3f207d598a7e7ebf5db2cf47fe9257`（three） |
| 本批功能提交 | `db89c675382cf2004a33cb8ead72242ff88ba6d4` |
| 功能提交標題 | `feat: integrate companion agent, motion and drag interactions` |
| 檔案範圍 | 功能提交共 343 個檔案，包含程式、測試、素材、研究稿與驗收截圖 |

交接文件另以 `docs: add cross-repo release handoff for 2026-10-30` 提交，可從來源分支的 log 找到。功能差異以基底到上述功能提交為準，不要直接把來源 repo 全部歷史合併進目標。

## 本次內容與相依檔案

| 模組 | 交付行為 | 合併時一起檢查 |
| --- | --- | --- |
| 花栗鼠健走 Agent | 「幫我安排」依分鐘數及遊戲補水需求產生方案，使用者確認才套入既有健走規劃 | `companion-agent.service.ts`、`companion-chat.service.ts`、`companion.component.*`，以及 Functions 的 `companion-agent-domain.ts`、`companion-chat.ts`、`companion-chat-domain.ts` |
| 動畫與平台 | 短促快跑、停下觀察、卡片平台與上下跳躍、抓起／懸空／落地／睡眠動作 | `chipmunk-motion.component.ts`、`companion-roaming.ts`、`companion-platforms.ts`、`companion-drag.ts` 與 `client/public/images/pet/animations/` |
| 近距離撫摸 | 底部滑入的原生 modal、大型草地場景、摸頭／肚子、共同中性姿勢、暫時氣泡 | `companion-petting.component.*` 與 `animations/petting-unified/`；不要混入早期近距離素材 |
| 拖曳跨 tab | 順序為健走→任務→兌換→回憶林→我的，左右端不循環；邊緣 16px 觸發、回到內側 32px 才重新觸發 | `companion-tab-transition.service.ts`、`app-shell.component.*`、拖曳與相關測試；換頁時保留指標捕捉和抓取狀態 |
| 換頁場景 | 120ms 移出、180ms 移入，位移 32px；寵物與 tab bar 保持固定 | Shell 與內層 Ionic outlet；一般 tab 點擊及 reduced motion 路徑須保留 |
| 個人頁開關 | 底部「啟用寵物」，預設開啟；關閉即移除寵物並清理互動 | `profile.component.*`、`companion-preferences.service.ts`、AppShell；localStorage key 為 `cat-walk.companion-enabled`，不新增雲端欄位 |
| 可站立標記 | 各頁卡片／控制項增加 `data-companion-ledge` | Home idle、Task、Shop、Collection tree card、Profile 的模板，不要只複製 companion 資料夾 |
| CMS 匯入回歸 | 修正 1,716 站點測試 fixture 路徑，新增 2,500 筆與 850,000 UTF-8 bytes 邊界、save/publish 回歸 | `functions/src/cms-domain.spec.ts`、`cms.spec.ts` 與既有 `firebase/seed/seed-data-gcp-hackathon-03-2026-10-27.json` |

Agent 最多檢視附近三棵已種、今日可造訪的樹，產生最多六個候選；沿用 Mapbox Directions 及 LiveEnvironmentService 的 Open-Meteo 天氣。後端只收建議摘要，不收原始 GPS 或路線幾何；最多四輪模型請求、八次工具呼叫、25 秒模型時限。套用前重驗帳號、CMS 版本、五分鐘有效期、起點偏移不超過 50m 與目的地可用性。保留首頁確認出發與原有獎勵驗證，單程時間不包含停留與回程。

完整設計與歷次決策見 `docs/architecture/companion-agent.md`、`CONTEXT.md`。歷史紀錄中的「暫不整合素材」「拖曳不切 tab」已被最新整合／拖曳決策取代，讀取時以最新紀錄與實際程式為準。

## 容易衝突或漏帶的項目

1. **Mapbox 檔案搬移**：runtime helper 從 `client/src/app/mapbox-runtime-config.ts` 移至 `client/src/mapbox-runtime-config.ts`。Home map、Collection map、Task map、Directions service 的 import 要一起更新，避免舊路徑殘留。`mapbox-directions.service.ts` 在這批主要是 import 與排版調整；不要因此覆蓋目標 repo 的路線演算法修改。
2. **本機 token 不入版控**：`client/mapbox-config.ts` 已加入 `.gitignore`；以 `client/mapbox-config.example.ts` 建立本機檔案，填入目標環境的 public token。helper 在 `settings.isDev` 為 true 時直接使用該檔案；目前設定為 true，不能假設 production build 就會切換讀取來源。非 dev 才讀 `window.__CAT_WALK_RUNTIME_CONFIG__`。`npm run build` 的 prebuild 會依 `MAPBOX_PUBLIC_TOKEN` 重建被忽略的 `public/runtime-config.js`，未提供時是空值；發版前核對實際模式與來源。
3. **CMS iconfont 暫時停用**：`client/angular.json` 中 `../cms/node_modules/cub-lib-view-iconfont/css/cub-lib-view-iconfont.min.css` 目前註解掉，因本機缺該套件。目標環境若有私有套件與 registry，應恢復此行並檢查圖示；不應把臨時措施當永久設計。
4. **lockfile**：本批保留既有工作區的 `client/package-lock.json` 更新及 `cms/package-lock.json` 刪除。CMS 沒有 lockfile 時不能直接 `npm ci`；目標 repo 若有正常 lockfile，先比對再決定是否採用刪除。依目標 registry 與版本產生 lockfile，避免盲目覆蓋。Client 用 Angular 22，CMS 用 Angular 20，勿混裝依賴。
5. **素材**：`animations/` 是執行期資產；`motion-studies/` 是研究來源，已由 `client/angular.json` 排除在建置資產外。`.impeccable/review/` 是驗收截圖。本批新增檔案約 233 MB（未壓縮），完整 fetch／搬移需包含二進位圖檔。只搬 TS 會造成缺圖。一般整合不必重跑 prepare 腳本；部分腳本依賴 `pngjs`，目前未直接列在 client package.json，重製素材前需另備工具依賴。
6. **後端 domain 相依**：Client 會引用 repo 根目錄下 `functions/src` 的 domain 型別／工具；目標 repo 若採不同目錄結構，要調整相對路徑、TypeScript 設定與測試 fixture 路徑。
7. **CMS 限制已存在於本批基底**：`functions/src/cms-domain.ts` 目前已有 `CMS_MAX_TREE_PRESETS = 2500`、`CMS_MAX_CONFIG_BYTES = 850000` 與 UTF-8 計數。本次功能提交僅新增相關測試，沒有改這個實作。目標 repo 若仍是舊限制，單 cherry-pick 本批不會自動修好，必須另外核對移植。
8. **環境與部署設定**：保留目標 repo 的 Firebase project、Hosting、權限、帳號與 token；來源 `.firebaserc` 指向 `cathay-ai-hackathon-team-03`，不應拿來覆蓋另一環境。

## 明天建議的合併操作

先在目標 repo 確認工作區乾淨並確認基底分支，再建立整合分支。以下指令在目標 repo 根目錄執行；若 remote 或分支名稱已存在，改用可辨識的新名稱。

```powershell
git status --short --branch
git switch -c integrate/catwalk-2026-10-30
git remote add catwalk-source https://github.com/NekoNyacer/gcp-sprint3.5.git
git fetch catwalk-source develop
git show --stat db89c675382cf2004a33cb8ead72242ff88ba6d4
git diff --name-status 021eba9cdb3f207d598a7e7ebf5db2cf47fe9257 db89c675382cf2004a33cb8ead72242ff88ba6d4
git cherry-pick db89c675382cf2004a33cb8ead72242ff88ba6d4
```

這個提交可用於不共用 Git 歷史的 repo，但前提是檔案路徑／基底內容相容。若衝突，逐項依前述模組解決後 `git add <已解決檔案>`、`git cherry-pick --continue`；要取消這次操作則 `git cherry-pick --abort`。若兩邊版本差距太大，改按模組移植並補齊基底相依，勿用 `--allow-unrelated-histories` 強行混合整個 repo。

交接文件可再從來源分支還原並另行提交：

```powershell
git restore --source=catwalk-source/develop -- docs/handoffs/2026-10-30-cross-repo-release.md
git add docs/handoffs/2026-10-30-cross-repo-release.md
git commit -m "docs: carry cross-repo release handoff"
```

合併前先核對既有花栗鼠基底、Home/WalkSessionStore、LocationStore、ProgressStore、公開 CMS 資料、LiveEnvironmentService、Mapbox service 及 companionChat export／呼叫區域都存在。這些不是本批全部新增的檔案，不會因 cherry-pick 自動補齊。

## 本次重新驗證（2026-10-30）

| 檢查 | 結果 |
| --- | --- |
| Functions `npm run build` | 通過 |
| Functions 四組相關測試 | 75 項中 73 通過、2 失敗；Agent／Chat 與 CMS domain 測試檔通過 |
| Client development build | 通過；沙箱內曾因 Access is denied 失敗，改在允許的沙箱外執行後通過 |
| Client companion／Home／WalkSessionStore 測試 | 11 個測試檔、149 項全部通過 |
| 瀏覽器／實機／外部服務 | 本次交接未重跑；先前各次紀錄與截圖可供參考，不視為本次完整端到端驗收 |

兩項失敗均在 `functions/src/cms.spec.ts`，與 CONTEXT 既有紀錄一致，本次未修改推薦邏輯或放寬測試：

- `uses actual Vertex JSON output and sends no exact player coordinates to the model`：回傳選點／原因與預期不符。
- `preserves eight Gemini-selected stops, permits zero, and rejects planting output`：預期八個選點，實際只有一個。

目標 repo 重跑指令（先安裝各自依賴並設定本機 Mapbox 檔案）：

```powershell
# 在 repo 根目錄
Copy-Item client/mapbox-config.example.ts client/mapbox-config.ts
# 編輯本機 mapbox-config.ts 填入目標 token；已有本機檔案時勿覆蓋。
npm --prefix client ci
npm --prefix functions ci
npm --prefix functions run build
npm --prefix functions test -- companion-chat.spec.ts companion-agent-domain.spec.ts cms-domain.spec.ts cms.spec.ts
npm --prefix client run build -- --configuration development
npm --prefix client test -- --watch=false --include=src/shared/components/companion/*.spec.ts --include=src/features/home/home.component.spec.ts --include=src/shared/stores/walk-session-store.spec.ts
```

Hosting 發版另需執行目標環境 production build 與 CMS build；本次 development build 通過不代表 production budgets、私有套件、CMS 或目標雲端設定都已驗收。

手動驗收：五個 tab 的平台與捲動、8px 抓起門檻／落地、左右端不循環、邊緣不連跳、換頁期間放手、撫摸開關與氣泡消失、Escape／鍵盤焦點／reduced motion、寵物開關重整後保留；Agent 要檢查缺少分鐘數、無可行方案、舊方案過期、已有路線不覆寫、確認套用後仍須確認出發。至少涵蓋 320px、390px 與桌面寬度，並檢查圖片 404、console 錯誤與實際地圖。

## 已部署與未部署的界線

以下為 `CONTEXT.md` 的既有交付紀錄，本次交接沒有重新查詢雲端狀態或重新部署：

- 2026-10-29 的 Hosting `cms-preview` 發布當時的 App／簡報／CMS；記錄到期為 2026-11-05 17:01:23 Asia/Taipei。後續新互動不能假設已在該 preview。
- 健走 Agent 的 `companionChat` 曾單獨部署至 `asia-east1`，revision `companionchat-00003-lis`；後續動畫、拖曳換頁與開關沒有因此自動上 Hosting。
- 2026-10-30 01:06 Asia/Taipei 的 CMS hotfix 使用隔離來源，只部署 `cmsCommand` 限制修正，revision `cmscommand-00006-son`。當時 HTTP smoke 得到預期 401，但尚未以登入管理員完成真實 1,716 筆儲存／發布驗收。
- `functions/.tmp/cmscommand-hotfix`、下載的雲端原始碼、依賴、build output 與本機 token 未納入 Git。目標 repo 應從正式來源建置，且依自己的環境重新驗證，避免整包部署其他尚未確認的 Functions。

推到 Git 遠端僅保存版本。明天的目標 repo 合併、production build、登入 CMS 匯入驗收與實際部署仍需在目標環境完成。
