# 容量與 Sprint 計畫

基準日：2026-09-03  
開發截止：2026-11-05  
展示日：2026-11-09

## 1. 估算單位與假設

- 1 人日（pd）＝ 8 小時可交付工作。
- Feature 使用跨職能人日；User Story 使用小時與 Story Points。
- Story Point 採相對複雜度 `1, 2, 3, 5, 8`，不拿來換算個人績效。
- 配置代碼以保守中點換算：A＝80%、B＝50%、C＝25%。「高於／低於」的精確比例尚未提供，因此本表不假設滿載。
- 開發者的 raw allocation 再乘 75% delivery factor，吸收會議、協調、學習 Angular／Ionic／Firebase、review、返工與臨時維運。
- Operations 與 UI/UX 是專項支援，不當作一般開發人力；Must 估算中分別預留 6 pd 與 5.5 pd。
- 未提供個人休假；任何已排休需直接扣除對應 Sprint 容量。

## 2. 工作日

依[行政院人事行政總處 2026 年辦公日曆](https://www.dgpa.gov.tw/information?pid=12574&uid=41)，本區間另有 9/25、9/28、10/9、10/26 四個平日假日。官方日曆只直接適用政府機關；本計畫暫以公司比照放假估算，實際仍以公司行事曆為準。

| Sprint | 日期 | 平日假日 | 可用工作日 |
| --- | --- | --- | ---: |
| Sprint 0 | 09/03–09/09 | 無 | 5 |
| Sprint 1 | 09/10–09/23 | 無 | 10 |
| Sprint 2 | 09/24–10/07 | 09/25、09/28 | 8 |
| Sprint 3 | 10/08–10/21 | 10/09 | 9 |
| Sprint 4 | 10/22–11/05 | 10/26 | 10 |
| 合計 | 09/03–11/05 | 4 日 | **42** |

11/06–11/08 為 feature freeze、彩排與只修 Demo-blocker；不計入正常開發容量。

## 3. 開發容量

| 成員 | 9 月 | 10 月起 | Raw pd | 75% 可承諾 pd |
| --- | ---: | ---: | ---: | ---: |
| PO／主工程師 | 80% | 80% | 33.6 | 25.2 |
| Java 1 | 25% | 25% | 10.5 | 7.9 |
| Java 2 | 50% | 25% | 15.0 | 11.3 |
| Java 3 | 50% | 25% | 15.0 | 11.3 |
| 開發合計 |  |  | **74.1** | **55.6** |

| Sprint | Raw developer pd | 75% 可承諾 pd |
| --- | ---: | ---: |
| Sprint 0 | 10.25 | 7.7 |
| Sprint 1 | 20.50 | 15.4 |
| Sprint 2 | 13.90 | 10.4 |
| Sprint 3 | 13.95 | 10.5 |
| Sprint 4 | 15.50 | 11.6 |
| 合計 | **74.10** | **55.6** |

Must scope 經日期安全化後為 63 跨職能 pd，其中約 51.5 developer pd、6 Ops pd、5.5 UI/UX pd。相對 55.6 可承諾 developer pd，整案只有約 4.1 developer pd 緩衝；任何人員休假、GCP 權限延誤或垂直切片返工，都會消耗這個空間。

建議開發負載上限：PO 25 pd、Java 1 7.5 pd、Java 2 9.5 pd、Java 3 9.5 pd。PO 的上限幾乎用滿，PR review、產品裁決與整合工作不得再被當成免費工時。

## 4. 10/21 目標的容量校正

原始方向是 10/21 完成全部 Must，但截至該日只有 32 個工作日、約 44.0 可承諾 developer pd。全部 Must 需要約 51.5 developer pd，因此「全部 Must 於 10/21 完成」不具日期可信度。

可執行的基準是：

- 10/21：五分鐘核心路徑 feature complete，約 52 跨職能 pd／43.5 developer pd。
- 10/22–11/05：完成回憶重訪、跨平台品質、錄影／runbook 與 Demo-blocker，約 11 跨職能 pd／8 developer pd。
- 11/06–11/08：freeze，只彩排與修 Demo-blocker。

10/21 核心路徑包含登入、首頁／模擬步數、六個任務、路線模板推薦、照片、種樹／培育／里程碑、mock 錢包、Firebase trust boundary 與 Demo seed。私人回憶仍會有基本森林／回憶林，但完整重訪收藏可在 Sprint 4 完成。

為讓數字成立，Must 的路線採六條人工檢查模板與規則排名，三種任務共用同一參數化完成管線。即時任意路線生成不列入 Must。

## 5. Sprint 交付計畫

### Sprint 0｜09/03–09/09：地基與風險可見化

- 固化 UX flow、品牌方向與六個公共 POI 的候選清單。
- Firebase project、Emulator、Hosting Preview、資料模型與 CI 基線。
- Angular shell、Signals state convention、repository interface、Demo/online 邊界。
- Web Google Auth proof；Android 安裝政策與 plugin 只做最小調查。
- Exit：桌面可登入／使用 Demo identity，讀到 seed，Preview Channel 可開。

### Sprint 1｜09/10–09/23：步數到樹的垂直基礎

- Navigation、onboarding、本機 anchors、Starter seed。
- 首頁、日步數合併、光能公式、三資源 inventory、提醒卡。
- 多樹、成長階段、grove 基礎 read model。
- `syncDailySteps`、核心 Rules tests、idempotency pattern。
- Exit：模擬步數能可靠取得光能，首頁能看到追蹤樹與資源。

### Sprint 2｜09/24–10/07：可走的任務垂直切片

- 六個 versioned mission／route seeds 與 deterministic ranking。
- 路線偏好、地圖、單程／回起點、警語與到達 fallback。
- 先完成一條「選任務 → 走路 → 拍照 → 得資源」垂直切片，再參數化到三種類型。
- 活動 Enrollment、10 公尺抵達驗證與 `completeTask`。
- Exit：板橋或西湖至少一區可完整走完三種任務；失敗可用模板／模擬到達。

### Sprint 3｜10/08–10/21：五分鐘核心路徑 Feature Complete

- 另一區三任務與每日獎勵限制。
- 養分 slider／preview、`nurtureTree` transaction、單一 ready milestone、遠端 care／近距離 harvest 基礎。
- mock wallet、catalog、ESG、`redeemReward`。
- Demo Mode、5 分鐘／2 分鐘 seed 與 reset 的核心版本。
- Exit：不靠 Should/Could，可從登入完成五分鐘故事；阻斷缺陷清零。

### Sprint 4｜10/22–11/05：可靠度與展示封版

- 完整回憶詳情、重訪收藏與私人 grove 行為。
- Chrome／Edge／360×800／S22+ browser QA、accessibility、performance、Rules tests。
- 失敗切換、資料清除腳本、五分鐘／兩分鐘 runbook、預錄影片。
- 只有 Must burn-down 維持綠色且核心流程連續兩次彩排成功，才領取 Android、Gemini、社交或 Three.js 項目。
- Exit：Release candidate、Preview URL、兩種 seed、影片、runbook 全部凍結。

## 6. Should／Could 的 Earned Scope Gate

Should／Could 都存在 Azure Boards，但預設不排入承諾容量。領取順序：

1. Android signed APK 與 App Distribution 政策驗證。
2. Native Google Sign-In／camera；local notification 可再後置。
3. Gemini 受限偏好解析。
4. Seeded leaderboard／friend contribution。
5. Three.js 兩人日 spike；通過後才估剩餘實作。
6. Health Connect、真實連續 GPS、鳥巢 polish。

先前構想把 Auth、Health、Three spikes 全放 Sprint 0，但它會超過保守容量。此基準只承諾 Web Auth；其他 spike 必須用提早完成所賺得的容量，不能把 Must 往後擠。

## 7. 風險與觸發動作

| 風險 | 早期訊號 | 觸發動作 |
| --- | --- | --- |
| PO 成為 UI／整合／決策瓶頸 | PR 等待 >1 工作日 | Java owner 先完成 contract tests；UI 只做一套共享元件 |
| 路線整合拖延 | 10/02 尚無完整垂直切片 | 固定模板成為唯一路線來源，停止即時 API |
| Firebase transaction／Rules 不熟 | emulator tests 連續兩日不綠 | 縮小 command schema，集中 Java 1 + PO pairing |
| 照片上傳不穩 | retry 後仍遺失 proof | 先本機 pending＋示範圖，Storage 成功才標 completed |
| Android 政策未核准 | 09/16 前無書面方向 | 關閉 Android Feature，不再投入 packaging |
| 10/07 未完成一區垂直切片 | Sprint 2 Exit 失敗 | 停止全部 Should/Could，砍動態裝飾與社交入口 |
| 10/21 核心無法連跑兩次 | 任一主步驟需人工改資料 | 啟用兩分鐘 seed，優先修流程，不做完整重訪收藏 |

## 8. 每週節奏

- 每日 15 分鐘：只報昨日結果、今日目標、阻塞。
- 每週一：PO 依剩餘容量重排 User Stories，不更改 Must 定義。
- 每週三：UI/UX 30–45 分鐘顧問 review，集中處理一個 build，避免零碎返工。
- 每週五：在 Hosting Preview 跑一次可見的 end-to-end，Ops 檢查 log／成本。
- Sprint review：用可操作成果驗收，不用完成百分比替代。
- WIP：每位工程師同時最多一個開發 Story；阻塞超過半天即求援。

## 9. Estimation 重新校正

第一個 Sprint 後，用實際完成的 Story 小時重估剩餘 backlog；只調整 forecast，不回填美化原估。若剩餘 Must developer effort 大於剩餘 75% capacity，立即採模板、seed 或視覺簡化，而不是期待最後一週加班解決。
