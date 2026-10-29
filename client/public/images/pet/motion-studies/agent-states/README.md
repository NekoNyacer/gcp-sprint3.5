# Agent 狀態姿勢素材（待驗收）

三張 `*-source.png` 為內建 imagegen 產出的原始透明圖；`*-atlas.png` 為腳底對齊的 4×2 切格版本，並附同名 JSON。每組含 8 格，JSON 中的 6 fps 與循環設定只供試播，並非最終節奏。

素材切格時相鄰花栗鼠距離過近，因此限制透明邊緣擴張來減少鄰格碎片，代價是部分細鬍鬚可能被截短。success、confused 原圖的第 4、8 格本身已有像素碰到圖片邊緣。thinking 的低頭到歪頭、success 的表情及身體變化，以及 confused 的頭部角度仍有跳變；不能單靠對位視為完整流暢動畫。各 JSON 的 `usableFrameRange` 指可供預覽的格子，並非可以直接進產品的保證。

執行 `node scripts/prepare-companion-agent-states.mjs` 可用原圖重新製作 atlas 與 JSON。沒有變更 App 動作邏輯或現有 runtime 圖片。
