# 奔跑接觸與回收過渡研究

`run-contact-transitions.png` 用內建 imagegen 生成，參考 `run-v2-aligned.png` 與 `chipmunk-neutral.png`。要求從向前伸展、前腳落地逐步轉為前腳承重、後腿前收及四腳收身，保持右向側面、角色外觀和透明背景一致。`run-contact-review.png` 把該圖第 2–4 格與既有 `run-v2-aligned.png` 的姿勢組合為 5×2、10 格、每格 460×352 的對位試播圖；JSON 記錄順序。執行 `node scripts/prepare-companion-run-contact.mjs` 可重製。

這些是不同生成圖間拼接的實驗素材，不是已驗收的無縫動作。與舊 8 格相比增加了承重及後腿收身姿勢，但中間仍有姿勢跳變、局部體型偏移和可能的細鬍鬚損失；腳掌接觸和循環銜接仍需逐格修正、動態檢查。

## 蹬地片段與後腿回收補充

`run-push-study.png` 由內建 imagegen 依 `run-v2-aligned.png` 生成。提示詞要求相同花栗鼠、右向側面、透明背景、八個相鄰且微幅變化的姿勢，從四足蹲伏逐步伸展後腿、腳掌蹬地，到前腳向前伸出；每格完整獨立。`run-push-aligned.png` 是 4×2 對位試播圖，每格 506×378；`run-push-aligned.json` 標示 `loop: false`，因為這只是起跑蹬地段，不是完整循環。執行 `node scripts/prepare-companion-run-push.mjs client/public/images/pet/motion-studies/run-push-study.png` 可重製。各格有透明空間且輪廓沒有碰到對位圖格線，但第 1→2 格仍明顯跳變、其他若干格過於相似，不能視為完成的流暢步態。

`run-recovery-study-v2.png` 是依落地參考補做的四格後腿回收研究；提示詞要求前腳承重、後膝依序彎曲、後腳向腹部回收並接觸地面。產出仍將主要動作集中在少數影格，因而沒有併入試播 atlas。
