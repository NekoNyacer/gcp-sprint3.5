# Drag, jump and sleep runtime assets

Derived from existing imagegen source sheets in ../../motion-studies/drag-drop/. Originals remain unchanged. Prefer pickup-v2-source and jump-down-source; earlier pickup-source/jump-down-alternate are not runtime inputs. Every clip has a source hash, dimensions, fixed scale, durations and registration bounds in its JSON.

All cells are 460×400 with main paw/body baseline376 and footInset24. Sleeping width is limited to320 source pixels (about86CSSpx on the128×108 pet host), comparable to the existing idle, avoiding the oversized legacy sleeping fallback. No nonuniform anatomical scaling or invented in-between poses.

Source pose anatomy, view and whiskers can still vary. Exact baseline registration does not prove natural motion. Rebuild with node scripts/prepare-companion-drag-animations.mjs from the repository root.
