# 花栗鼠動作素材：待審閱

這些圖片由內建 imagegen 依現有 `chipmunk-neutral.png` 與 `chipmunk-run-cycle.png` 產生。原圖保留透明背景，未接入 App。它們是動作姿勢研究，不是已校正、可無縫循環的動畫 atlas。格子邊緣、角色位置、動作順序及過渡影格仍需逐張檢查；部分姿勢的鬍鬚或輪廓接近格線或圖片邊緣。請先確認畫風和動作，再決定補畫、切格和接線。

圖鑑：`../../../../../docs/companion-motion-studies.html`。

## 共同生成提示

> Use case: stylized-concept. Asset: animation pose sheet for an app's chipmunk companion. Input image 1 is the exact character identity and soft detailed realistic fur illustration style; input image 2 is its original side-view running reference. Preserve warm russet fur, black and cream back stripes, large dark eyes, cream muzzle and belly, and large bushy tail. Genuine transparent background. No floor, shadows, text, borders or extra characters. All poses fully separated with transparent padding, consistent proportions, lighting and camera.

## 個別提示與預期姿勢

- `run.png`：12 格，4 × 3。右向側面循環奔跑：縮身、後腿蹬地、伸展騰空、前腳伸出與落地、身體越過前腳、後腿收回並再次落地。要求四肢有接觸、回收與騰空階段。
- `jump.png`：8 格，4 × 2。右向側面跨越高低平台：站立、蹲下、起跳、上升、頂點、下降、前腳接觸、屈身落地；不繪製平台。
- `food.png`：8 格，4 × 2。發現、嗅聞、拾起並啃食紅果，再將果子塞入臉頰，最後鼓起雙頰。
- `attention.png`：8 格，4 × 2。面向使用者：注意、轉頭、豎耳、靠近、眨眼、抬爪、歪頭、期待。
- `petting.png`：8 格，4 × 2。正面大型撫摸反應：放鬆、享受摸頭、歪頭、露肚子、開心、側躺與休息；不繪製人的手。
- `play.png`：8 格，4 × 2。警覺、嗅聞、抬爪、玩耍俯身、小跳、落地、坐起與擺尾；不加道具。

各圖格數和順序是生成要求，不代表每張圖均已通過動畫品質驗收。奔跑和跳躍尤其需要檢查腳部落點、身體位置、循環接合和速度；進食、期待及撫摸需要更多中間影格才能避免姿勢突變。

## 確認草圖後補充的素材

以內建 imagegen、`chipmunk-neutral.png` 和 `petting.png` 為角色參考，要求同一隻花栗鼠、固定相機和比例、透明背景、4 × 2 的八格連續姿勢。各組的提示分別要求：

- `idle.png`：坐姿呼吸、閉眼眨眼、豎耳及輕微歪頭，回到起始姿勢。
- `head-rub.png`：固定坐姿，眼睛漸閉，頭微微傾向撫摸後回正；不畫人手。
- `belly-rub.png`：固定坐姿，抬爪、閉眼微笑、輕微後仰後回正；不畫人手。
- `groom.png`：坐姿抬爪整理嘴部，再放下爪子；不加道具。
- `run-v2.png`：以原有跑步及角色圖為參考，8 格依序呈現收身、後腿蹬地、起跳、騰空伸展、前腳落地、身體移過前腳、後腿前收與再度收身，要求四肢獨立變化與同一角色比例。

對位圖集與描述檔僅供試播。對齊無法補出缺少的腿部回收、腳掌接觸與前後姿勢之間的過渡；實際流暢度仍需動態審閱與進一步製作。
