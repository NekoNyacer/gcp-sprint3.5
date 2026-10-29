# 起跳、落地分段

以內建 imagegen 補畫 `launch-source.png` 與 `landing-source.png`；參考既有 `chipmunk-neutral.png` 和 `jump-food-prepared/jump-v3-atlas.png`。分段圖集、各自的 JSON 與來源圖都保留；`scripts/prepare-companion-jump-segments.mjs` 可重做提取和對位。圖集為透明 PNG，8 格、4 × 2，固定比例與最低點對位，軌跡未烘焙在圖內。

生成共同提示：

> Use case: stylized-concept. A frame-by-frame animation reference sprite sheet for an app. The input images define the SAME chipmunk, style, palette and side-view proportions, not scenery: russet-brown detailed natural fur, cream muzzle and belly, dark and cream back stripes, large glossy eyes and a bushy tail. Exactly eight full-body poses on a 4-column by 2-row evenly-spaced grid on genuine transparent background. Face right in profile. Consistent lighting, body size, head, eye, stripe and tail identity and camera in every frame. The eight poses depict only ONE small stage of one coherent jump, in chronological order; small progressive changes, not independent poses or repeated loops. Entire animal including tail and paws must fit its own cell with plenty of padding. No background, floor, shadows, text, extra characters or props.

起跳提示：

> Show the brief transition between crouching on a flat ledge and launching upward: 1 low crouch all four paws on the ledge, 2 rear legs begin extending, 3 shoulders start to rise and forepaws gently lift, 4 rear legs pushing, 5 hips extend and forepaws forward, 6 rear toes about to leave, 7 hind feet lift just off ledge, 8 body moving upward with hind legs extended. Show natural anatomically articulated feet and legs. No actual ledge is drawn.

落地提示：

> Show a chipmunk settling from descending flight onto a flat ledge: 1 descending, front paws reaching forward, back legs extended behind; 2 front paws approach the ledge; 3 forepaw tips touch, hind legs still back; 4 elbows bend and head moves slightly down while hind legs swing forward; 5 forepaws support weight, hind paws approach; 6 hind paws touch down; 7 crouched weight on all four feet; 8 relax from crouch. Natural anatomical limb articulation. No actual ledge is drawn.

限制：起跳 3→4 與落地 3→4 仍存在動作跨度；起跳後半幾格相近，落地第 4→5 有身體形狀跳變。兩段不是一個已完成的跳躍動作，不能單純拼接；細鬍鬚和末端毛髮也需進一步檢查。軌跡與時長應在後續使用時另行設計，圖鑑中的位移僅供視覺預覽。
