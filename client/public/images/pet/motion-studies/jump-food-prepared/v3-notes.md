# 跳躍與進食：12 格試播素材

由內建 imagegen 以 `chipmunk-neutral.png` 和既有 `jump.png`／`food.png` 為角色及風格參考製作，原始透明圖留在 `jump-v3-source.png` 和 `food-v3-source.png`。`scripts/prepare-companion-jump-food-v3.mjs` 依透明輪廓將原始姿勢分格並對齊成 `jump-v3-atlas.png` 及 `food-v3-atlas.png`；兩者均為 4 × 3、單格 440 × 400 像素。

- 跳躍順序為準備、起跳、上升、縮腿、展開前爪、降落。`jump-v3-atlas.json` 的 `previewOffsetY` 為示意跳躍軌跡，不已經烘焙在圖片內；未來依目標平台高低、持續時間與角色碰撞點自行計算。第 3 到第 4 格、6 到第 7 格動作仍有跳變。獨立的 `jump-takeoff-bridge-source.png` 探索起跳過渡，尚未與圖集合併，因尺寸與角色對位仍需逐格調整。
- 進食順序為坐姿持果、啃食、塞入臉頰、鼓頰。它是一段不循環的片段：從坐著拿到果子開始，結束在鼓頰，不能直接循環到第一格；撿起地上果子和起身另需銜接。身體與表情依影格仍有漂移，需動態審閱。

這些仍是生成的關鍵姿勢，對位無法產生缺少的解剖中間動作；數量較多不等於已確認流暢，也尚未接上 App。

## 生成提示

共同提示：Animation asset: consistent frame-by-frame chipmunk sprite sheet for a 2D app. The reference images define the exact character: detailed warm russet fur, cream muzzle and tummy, dark and cream stripes, big black eyes, bushy arched tail, natural soft realistic animal rendering. Transparent background with no ground, border, shadow, text, extra characters or cropped limbs. Side three-quarter view facing right. Exactly 12 whole-body poses arranged in a 4-column x 3-row grid, each fully separated within its own cell. Every frame is the same size and shows the same individual from same view, same lighting. Twelve consecutive frames represent ONE continuously evolving motion, not separate variations or multiple cycles. Generate genuine anatomically articulated changing poses with incremental transitions from one frame to the next.

- 跳躍：stand, lower slightly, crouch, hind-leg push-off, rise, stretched airborne, start folding hind paws, fold beneath belly, tucked apex, unfold for descent, reach forward, compressed landing. No ledges.
- 進食：sit upright holding one berry; raise it to the mouth, nibble and chew, push food into cheek pouch, lower paws, end with full cheeks. Do not change body pose abruptly.
- 起跳過渡：use top-row poses 3 and 4 of the new jump sheet as endpoints; create eight incremental poses between crouch and ascending, with forepaws lifting and hind feet pushing and releasing. No ledge drawn.

## 拾果到塞頰的整段試播

新增 `pick-v4-source.png`、`rise-v4-source.png` 與對應圖集和 JSON，分別探索低身拾果和持果起身。以內建 imagegen 參考原始角色與 `food-transition-study.png`，要求透明背景、固定視角、四乘二的八格同一動作漸進姿勢；拾果提示要求嗅聞、伸爪、雙爪抓取並抬起一顆紅果，起身提示要求逐步將軀幹抬高並坐起。

`food-sequence-v4-atlas.png` 與 JSON 是把拾果 1–5、起身 2–4、進食 1–12 合併的 20 格試播，格式 4 × 5、單格 440 × 400，結束於鼓頰，不能首尾循環。腳本 `scripts/prepare-companion-pick-rise-v4.mjs` 與 `scripts/prepare-companion-food-sequence-v4.mjs` 記錄提取、等比例縮放與重組方式。第 7→8 格起身過快，第 8→9 格跨來源後角色視角、果子位置和比例有跳變；拾果原圖第 4 格鬍鬚觸及畫布右緣並遭截斷。生成與對位仍不足以稱為完整流暢動作。
