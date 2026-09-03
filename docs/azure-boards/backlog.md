# Azure Boards Backlog

Project：`CUB-CAT_WALK_APP`  
假設 Process：Agile 或 inherited Agile  
Hierarchy：Epic → Feature → User Story

## 1. 總覽

| Epic | Feature 數 | Must pd | Should pd | Could pd | 合計 pd |
| --- | ---: | ---: | ---: | ---: | ---: |
| E01 體驗基礎與身份 | 3 | 12 | 0 | 0 | 12 |
| E02 健走、路線與任務 | 3 | 12 | 0 | 0 | 12 |
| E03 大樹、回憶與回饋 | 5 | 21 | 2 | 0 | 23 |
| E04 Serverless 平台與 Demo 韌性 | 2 | 11 | 0 | 0 | 11 |
| E05 品質、裝置與展示 | 4 | 7 | 12 | 0 | 19 |
| E06 可選沉浸體驗 | 4 | 0 | 0 | 18.5 | 18.5 |
| 合計 | **21** | **63** | **14** | **18.5** | **95.5** |

63 Must pd 是跨職能工作，其中約 51.5 developer pd、6 Ops pd、5.5 UI/UX pd。詳細容量與 10/21 日期校正見 [`capacity-and-sprints.md`](../project/capacity-and-sprints.md)。

## 2. Epic／Feature

| ID | Epic / Feature | 優先級 | 預估 pd | 目標 | 主要 owner |
| --- | --- | --- | ---: | --- | --- |
| E01 | 體驗基礎與身份 | Must | 12 | S0–S1 | PO／UIUX／Java 1 |
| F01 | 應用殼層、品牌與導航 | Must | 3 | S0–S1 | PO + UIUX |
| F02 | Google 登入、Onboarding 與隱私錨點 | Must | 4 | S1 | Java 1 + PO |
| F03 | 每日步數、資源首頁與提醒卡 | Must | 5 | S1 | Java 2 + PO |
| E02 | 健走、路線與任務 | Must | 12 | S2–S3 | Java 2／Java 3／PO |
| F04 | 六個任務 seed 與規則式推薦 | Must | 3 | S2 | Java 3 + PO |
| F05 | 地圖、路線預覽與進行中任務 | Must | 4 | S2 | Java 3 + PO |
| F06 | 三種任務、拍照與每日資源發放 | Must | 5 | S2–S3 | Java 2 + PO |
| E03 | 大樹、回憶與回饋 | Mixed | 23 | S1–S4 | PO／Java 1／Java 2 |
| F07 | 多樹、種植與私人回憶林 | Must | 6 | S1–S3 | Java 1 + PO + UIUX |
| F08 | 養分配置、成長與收成完整性 | Must | 7 | S2–S3 | Java 2 + PO |
| F09 | Mock 小樹點錢包、兌換與 ESG | Must | 4 | S3 | Java 2 + PO + UIUX |
| F10 | 回憶重訪與遠端照顧 | Must | 4 | S4 | Java 1 + PO + UIUX |
| F11 | Seeded 排行榜與好友投入 | Should | 2 | Earned | Java 2 |
| E04 | Serverless 平台與 Demo 韌性 | Must | 11 | S0–S3 | Java 1／Ops／PO |
| F12 | Firebase 環境、資料、安全與可觀察性 | Must | 6 | S0–S2 | Java 1 + Ops + PO |
| F13 | Demo Mode、seed、reset 與故障切換 | Must | 5 | S1–S3 | Java 1 + Ops + PO |
| E05 | 品質、裝置與展示 | Mixed | 19 | S3–S4 | PO／Ops／UIUX |
| F14 | 跨瀏覽器、響應式、無障礙與效能 | Must | 4 | S4 | 全員 + PO |
| F15 | 五／兩分鐘腳本、錄影與彩排 | Must | 3 | S4 | PO + UIUX + Ops |
| F16 | Android APK、native auth/camera/notification | Should | 9 | Earned | PO + Java 1 + Ops |
| F17 | Gemini 受限偏好解析 | Should | 3 | Earned | Java 3 + PO |
| E06 | 可選沉浸體驗 | Could | 18.5 | Earned | 依 gate 指派 |
| F18 | Health Connect 真實日步數 | Could | 4 | Earned | Java 2 + PO |
| F19 | 真實連續 GPS 任務進度 | Could | 2 | Earned | Java 3 + PO |
| F20 | Three.js 低多邊形樹與粒子 | Could | 11 | Earned | PO + UIUX |
| F21 | 鳥巢居民與季節 polish | Could | 1.5 | Earned | PO + UIUX |

## 3. 日期安全化說明

F04 與 F05 不在 Must 中呼叫任意即時路線生成。六條路線在 seed 階段由人員檢查，runtime `recommendRoute` 只做受限排序；F06 以一套參數化 completion pipeline 支援三種任務。這讓 E02 從較高風險的約 18 pd 收斂到 12 pd，同時保留 Demo 要表達的智慧路線與 pickup-delivery 故事。

若團隊之後把 live Routes API 拉回 runtime，應新增 Should Story，不可直接擴張 F04/F05 的 Must 驗收。

## 4. 依賴關係

- F12 → F02、F03、F06、F08、F09：環境、schema、rules 與 command pattern。
- F04 → F05 → F06：先有受控內容，再顯示路線，最後完成任務。
- F03 + F07 → F08 → F09：先有資源與樹，才能投入、收成與兌換。
- F13 橫跨所有 Must：每個線上功能都要有 seed/fallback。
- F01／F14／F15 是所有展示面的 shared Definition of Done。
- F16–F21 不得成為任何 Must 的 predecessor。

## 5. 建單策略

- 完整 CSV 含 Epic、Feature、User Story、Priority、Story Points、HTML Description／Acceptance Criteria 與 Tags。
- `estimates.csv` 是估算真實來源，因標準 Agile Feature 沒有通用的「人日」欄位。
- 不在初次 CSV 填 `ID`、`State`、`Assigned To`、`Area Path` 或 `Iteration Path`；避免身份、流程與節點不相容。
- Sprint 用 `sprint-0`…`sprint-4` 或 `earned-scope` tag 表示；建立 Iteration 後再 bulk edit。
- Task 由 Story owner 在 Sprint planning 拆分；初次匯入不建立一個與 Story 重複的假 Task。
