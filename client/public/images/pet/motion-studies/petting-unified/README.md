# 撫摸近景：待機與反應圖集

這些是供視覺確認的透明 PNG 素材，沒有修改 App 或其現有動作。每組 `*-review-atlas.png` 均為 **5 欄 × 2 列、10 格**，每格 **521 × 549 px**。從左到右、由上到下讀取，第 1 格與第 10 格皆與 `idle-common-neutral.png` 的 RGBA 像素完全相同。

| 圖集 | 姿勢研究 | 來源 |
| --- | --- | --- |
| `idle-review-atlas.png` | 正面坐姿、輕微呼吸 | `idle-unified-source.png` |
| `head-review-atlas.png` | 輕閉眼、享受摸頭、回到中性 | `head-unified-source.png` |
| `belly-review-atlas.png` | 愉快、閉眼與笑容、回到中性 | `belly-unified-source.png` |
| `expression-master-review-atlas.png` | 中性、柔和閉眼與回神 | `expression-master-source.png` |

## 共同基準與對位

`idle-common-neutral.png` 取自 **head 原圖第 1 格**，使用連通輪廓及附近的抗鋸齒像素提取，再等比縮放與平移。此格可看到真實鬍鬚；鄰格尾巴不屬於它的主要連通輪廓。前版 App 使用的 idle 第一格右頰有原生平直裁切，故此共同基準**不同於目前 App 的 idle**，不能假設直接切換時畫面完全一致。

每個來源圖只使用**一個整組固定的等比縮放**；逐格位置依近似鼻子位置及腳底高度平移，而不依尾巴外緣逐格置中或逐格縮放。這能保留原圖的身形變化，並減少腳部位置漂移；鼻子色塊比對不是正式骨架或人工精修定位。各組 `*-review.json` 記錄比例、平移、尺寸、來源及建議播放資訊。建議 fps 只是試播起點，實際時長與中間格仍需視覺調整。

原始素材以現有花栗鼠近景為參考，由內建 imagegen 生成；提示重點為相同暖棕色毛髮、奶油色腹部、大眼、左側蓬鬆尾巴、固定正面坐姿、透明背景，分別描繪小幅呼吸、摸頭、摸肚與放鬆表情。素材並非經逐張手繪修整的定稿。

以 alpha≥96 檢查四組每格均非空、輸出格邊無該範圍內的像素接觸；這不能證明較透明的細鬍鬚完整或源圖本身沒有瑕疵。各組中間格仍有眼睛、臉與毛髮的漂移，反應強度可能不夠區分；首尾相同也不代表第 1→2 或第 9→10 格已自然銜接。使用前應逐格及實際播放審查。

在專案根目錄執行 `node client/public/images/pet/motion-studies/petting-unified/prepare-review.mjs` 可依保留的原圖重建研究稿；不會修改原圖或 App 程式。
