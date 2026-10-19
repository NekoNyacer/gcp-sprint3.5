# Azure Boards 匯入指南

目標 Project：`CUB-CAT_WALK_APP`

## 1. 先確認 Process

目前看得到 `Epic → Feature → User Story`，因此最可能是 Agile 或 inherited Agile。Azure 官方說明中，Agile 使用 `User Story`，Scrum 使用 `Product Backlog Item`，CMMI 使用 `Requirement`；匯入前仍須確認，因公司可能有自訂欄位。

最安全的確認方式：

1. 在 Project 內手動建立一個測試用 Epic、Feature、User Story。
2. 建立包含 `Work Item Type`、`Title`、`Description`、`Acceptance Criteria`、`Priority`、`Story Points`、`Tags` 的 Query。
3. Export to CSV，確認英文欄名與 `User Story` 類型完全相同。
4. 若 Process 不是 Agile，先不要匯入本檔；把 `User Story` 批次改成目標類型，並移除該 Process 不存在的欄位。

Microsoft 官方特別建議先匯出少量既有 work items，以取得該組織的正確欄位名稱。參考：[Export, update, and import bulk work items with CSV files](https://learn.microsoft.com/en-us/azure/devops/boards/queries/import-work-items-from-csv?view=azure-devops)。

## 2. 選擇檔案

- 優先使用 [`import-work-items.csv`](./import-work-items.csv)：含 Epic／Feature／User Story 階層、Description、Acceptance Criteria、Priority、Story Points 與 Tags。
- 若 Azure 顯示 `Acceptance Criteria`、`Priority` 或 `Story Points` 欄位不存在，改用 [`import-work-items-minimal.csv`](./import-work-items-minimal.csv)：保留完整層級、Description 與 Tags，估算仍可從 [`estimates.csv`](./estimates.csv) 查到。

兩個檔案都：

- 沒有 `ID`，因為這些是新 work items。
- 沒有 `State`、`Assigned To`、`Changed Date` 或 `Created By`。
- 沒有 `Area Path`／`Iteration Path`，避免尚未存在的公司自訂節點造成整批失敗。
- 使用 `Title 1`、`Title 2`、`Title 3` 的縮排欄位建立 parent-child links。
- 少於 Azure 單次 1,000 work items 限制。

## 3. 匯入

1. Azure DevOps 開啟 `CUB-CAT_WALK_APP`。
2. 進入 `Boards → Queries → Import work items`。
3. 上傳完整 CSV。
4. 檢查預覽：紅色項目代表欄位或值無效，尚未建立 ID。
5. 特別抽查 E01、F01、US01.1 與最後一個 E06 子項，確認三層 parent-child 未斷開。
6. 確認無誤後選 `Save items`；未按 Save 前 work items 尚未真正建立。

重要：不要先在 Excel 依 Title、Priority 或 Tags 排序。層級 CSV 依目前列順序與 Title 欄縮排判斷 parent；排序會讓子項掛錯父層。

## 4. 匯入後設定 Sprint

建議先在 `Project Settings → Boards → Project configuration → Iterations` 建立：

| Iteration | 日期 |
| --- | --- |
| Sprint 0 | 2026-09-03–2026-09-09 |
| Sprint 1 | 2026-09-10–2026-09-23 |
| Sprint 2 | 2026-09-24–2026-10-07 |
| Sprint 3 | 2026-10-08–2026-10-21 |
| Sprint 4 | 2026-10-22–2026-11-05 |

匯入後建立依 Tags 篩選的 Query，批次設定 Iteration Path：

- `sprint-0` → Sprint 0
- `sprint-1` → Sprint 1
- `sprint-2` → Sprint 2
- `sprint-3` → Sprint 3
- `sprint-4` → Sprint 4
- `earned-scope` → 先留在 Product Backlog，不設 Sprint

有跨 Sprint tags 的 Feature 只作 rollup；實際排程以 User Story 的單一 sprint tag 為準。`Area Path` 可先保留 Project root，等團隊確定前後端／平台分類後再改。

## 5. 指派與估算

- 初次匯入不含 `Assigned To`，因 identity 欄位必須精確符合 Azure 組織中的 `Display Name <email>`。
- 匯入後依 [`estimates.csv`](./estimates.csv) 的 `Primary Owner` 由團隊確認真實姓名，再 bulk edit。
- 完整 CSV 的 User Story 使用 Story Points；工時是估算檔的 `Hours`。
- Feature 人日已寫在 Title 與 Description；若公司的 inherited Process 有自訂 `Estimated Person Days` 欄位，可在匯入後 bulk edit 或以 sample export 的欄名加入 CSV。
- 不建議初次建立一個與 Story 完全重複的 Task。每個 owner 在 Sprint planning 再把 Story 拆成可於 0.5–1.5 天完成的實作／測試 Task，並填 `Original Estimate` 與 `Remaining Work`。

## 6. 常見錯誤

| 現象 | 原因 | 處理 |
| --- | --- | --- |
| `User Story` 無效 | Process 是 Scrum／CMMI／Basic | 改成 sample export 中的 backlog item type |
| `Story Points` 無效 | 欄位被移除、改名或 Process 不同 | 使用 minimal CSV，之後依 estimates.csv 補值 |
| Assigned To 無效 | 帳號名稱／email 不匹配 | 本檔不預填；匯入後從 UI 指派 |
| Iteration Path 無效 | Sprint node 未建立或路徑不同 | 本檔不預填；建立 Iteration 後 bulk edit |
| 子 Story 掛錯 Feature | CSV 被排序或中間父列被刪 | 回復原始列順序後重新匯入；不要直接填 Parent 欄位 |
| 中文亂碼 | 編輯器另存成非 UTF-8 | 以 UTF-8 儲存；避免 Excel 自動另存 ANSI |
| HTML 顯示成純文字 | 組織的 rich-text 欄位行為不同 | 不影響內容；匯入後抽查並 bulk edit 格式 |

## 7. 驗收 Query

完成後建議建立下列 Shared Queries：

- `CAT WALK - Must burn-down`：Tag Contains `must` 且 Work Item Type = User Story。
- `CAT WALK - Sprint 0..4`：依 Iteration Path 分組。
- `CAT WALK - Earned scope`：Tag Contains `earned-scope`。
- `CAT WALK - Demo blockers`：Tag Contains `demo-blocker`（發現阻斷時再加）。
- `CAT WALK - Missing estimates`：User Story 且 Story Points Empty。

最後由 Backlogs 頁檢查每個 Epic rollup、Feature 子項數與總 Story Points；CSV 只是初始載入，之後的單一事實來源應是 Azure Boards，加上本 repo 的產品／架構決策文件。

## 8. 已在看板建立的壓測紀錄

2026/10/19 已建立 US14.5 #1925760 與 8 個子 Task #1925761–#1925768。完整／minimal 初始匯入模板同步列出該 Story，但沒有既有 ID；請勿為了同步紀錄而重新匯入整份模板，以免重複建單。

load-test-20261001-records.csv 是含既有 ID 的工作項快照；load-test-20261001.work-items.json 保存父子關係、描述、已確認用量與限制；evidence/ 保存三日原始 CSV。這些是已建單的追溯資料，不是另一次新項目建立清單。
