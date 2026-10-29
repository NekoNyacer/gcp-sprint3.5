# CAT WALK project context

## Latest preview delivery (2026-10-29)

- At the user's request, rebuilt the current checkout and deployed App,
  Angular presentation and CMS to Firebase Hosting channel `cms-preview`.
  The previous preview channels had expired; the recreated channel has a new URL:
  https://cathay-ai-hackathon-team-03--cms-preview-qb9n7860.web.app
  Expires 2026-11-05 17:01:23 Asia/Taipei. This supersedes earlier preview URLs
  and notes that the latest client changes have not reached Hosting.
- Client production,preview and CMS production builds passed with existing
  bundle/style/CommonJS warnings. Existing local Mapbox runtime settings were
  preserved. Hosting deployment completed successfully with 306 files.
- Verified HTTP 200 and exact local-build SHA-256 matches for `/`, `/login`,
  `/cms/`, `/cms/merchants`, runtime configuration and Mapbox CSP worker.
  This verifies delivery, not a complete browser/device acceptance test.
  Live Hosting, Functions and Firestore were not changed by this delivery.

## Chipmunk companion exploration (2026-10-29)

- The user wants to explore a chipmunk companion inspired by the app's existing
  tree visuals: natural rather than overly cartoonish, with a lively, mischievous
  and food-loving personality. Initial sketches are for style review.
- The user likes the second situation-study image and the subsequent pose sheet,
  and requests a 2D interactive companion in that style. They want smoother,
  more detailed motion than a low-frame-count pet.
- The intended future role includes AI-assisted route and stop suggestions and
  warm greetings informed by time and weather, such as rain or heat reminders.
  Route execution and live-weather integration remain future work. The later
  Gemini conversation decision below supersedes the initial text-only demo.
- The user confirms that the pet should roam above the bottom tabs, rather than
  appear as a fixed launcher/card. It belongs to one tab at a time and crosses
  between the cyclic order Home → Task → Shop → Collection → Profile → Home.
  Exiting right goes to the next tab; exiting left goes to the previous tab.
  Never navigate the player automatically.
- The pet keeps acting independently while the player views another tab; it does
  not wait to be discovered. It may roam, eat, play, idle or sleep. Clicking it
  pauses its activity, greets the player and opens options above its head for
  conversation and petting. The initial local demo conversation is superseded
  by the later Gemini conversation integration below.
- The user rejects the initial running animation as extremely unnatural. Running
  must show a complete articulated gait, with actual leg recovery, foot contact
  and suspension phases; deforming a single running pose is insufficient.
- Running now uses a generated 12-pose atlas played at 24 frames per second,
  with connected-component extraction and shared-scale registration. The single
  running image remains a static fallback. Stationary actions retain continuous
  local deformation. Treat visual motion quality as subject to user review;
  do not equate continuous rendering with additional authored poses.
- The user prefers inspecting animation directly in the Web preview; do not
  generate or attach separate preview videos unless requested.
- On interaction, show separate circular FAB-style actions above the pet instead
  of a popup/card. Conversation uses an invisible native editor focused directly
  by the Talk tap so mobile keyboards can open, with composing text shown as a
  speech bubble and Enter to send. Enter during IME candidate selection must not
  submit. No visible input box or separate send button.
- The user authorizes Gemini conversation with the chipmunk persona. Reuse the
  existing server-side Vertex AI service identity; keep recent conversation in
  memory only, show loading/failure states, and discard dismissed responses.
  Route execution and live weather are not connected by this chat increment.
- `companionChat` was deployed successfully to `asia-east1` in
  `cathay-ai-hackathon-team-03` on 2026-10-29, using Gemini 2.5 Flash through
  Vertex AI. Two authenticated Demo turns returned `source: gemini` in about
  2.7 and 1.4 seconds. Browser CORS preflight passed. The temporary test Auth
  identity was deleted; only its bounded quota counter remains on the server.
  Conversation text is not stored in Firestore by this implementation.
- Verification: Functions TypeScript and client development builds passed,
  seven backend tests and twelve frontend tests passed. Actual compiled Demo
  UI checks cover six viewports (320–1024px), FAB actions, hidden native editor
  focus, Enter submission, per-tab roaming and reduced motion. Keyboard overlay
  geometry was simulated with VisualViewport; physical mobile keyboard behavior
  still requires device verification. Hosting was not redeployed; use the local
  Web preview for the updated client.

## Native Angular presentation (2026-10-29)

- The user requests converting the existing presentation template into an
  Angular component. The client root `/` now renders the presentation template,
  chapter navigation and explanations directly through Angular, superseding the
  outer iframe wrapper around the standalone HTML.
- Preserve layout B, responsive device framing, queued chapter selection before
  login, App-to-chapter synchronization and hover/focus explanations. Only the
  real App inside the phone remains in a same-origin iframe so its session and
  navigation remain independent of the presentation route.
- Keep the existing standalone public HTML URL available for compatibility;
  the Angular root no longer depends on that document.

## Destination metric tags (2026-10-29)

- Wrap the destination card's duration, distance, step and supply tags when
  space is insufficient, with a 4px gap between rows and no horizontal
  scrollbar. This supersedes the earlier single-row/scrolling chip treatment.

## Profile, collection and redemption presentation (2026-10-29)

- Move logout from the Profile page bottom to the right of its identity header.
  Traveler ID and the underlined logout action use 12px text in `#f5f5f5`.
  Keep the CUBE plan select arrow inset within its right padding.
- Collection segment labels must remain fully visible without ellipses on
  mobile. Reduce horizontal spacing rather than reducing the text size.
  The filter icon uses `#777671` with no applied region/species filters and
  `#EE6A17` when either applied filter has values. Opening the sheet or editing
  its draft alone does not activate the icon.
- Keep only Collection segments/filter sticky beneath the fixed page title.
  The tree count and grid/map controls scroll with the grid content. In map
  mode, retain these summary controls as an overlay below the segment toolbar.
- When the redemption wallet card scrolls completely out of view, pin a compact
  white wallet summary below the page title. Keep both groups on one line:
  points on the left and available vouchers on the right, each with its label
  next to its value. Numbers use 16px `#EE6A17`; labels and the voucher unit
  use 14px `#1F1F1F`. Returning to the wallet card hides the compact summary;
  the voucher count remains a link to transaction history.
  Verified at 320/375/390/430px: tabs remain pinned while the Collection summary
  scrolls, the compact wallet appears/disappears without changing scroll height,
  its values update live, and the history link and return navigation work.
  All 17 existing Collection/redemption tests passed. Browser checks used an
  isolated Demo with external HTTPS blocked.
- Redemption reward artwork has square corners, including charity images'
  bottom corners and the green product images. Retain the surrounding cards.
- Use realistic photographic images for the three displayed redemption
  examples: a Taiwanese black bear and leopard cat for conservation, a drink
  voucher and a prominent Taipei city bus for green transportation. Reuse the
  same image in each reward's detail view. Other CMS
  rewards retain their configured icon and background when there is no matching
  subject image.
  The conservation detail uses a wide image area so both animals remain visible.
  Browser Demo checks at 320/375/390/430px confirm all three photos load in
  the list and detail views and custom reward icons still render. Five existing
  redemption tests passed.
- Verified in a local browser Demo at 320/375/390/430px: full segment labels,
  applied/draft/cleared filter colors, image corners and header logout returning
  to login. The CUBE select used a local catalog fixture with external HTTPS
  blocked. All 12 existing Collection tests passed.

## Local interactive app presentation (2026-10-28)

- On 2026-10-29, anchor the left presentation copy independently of the dynamic
  note card height, slightly above its former centered position. Longer screen
  explanations grow downward without moving the brand, kicker, headline, intro
  or chapter navigation. In short viewports, scroll the note card internally
  once it reaches the available space; retain the centered device and mobile
  sidebar hiding.
  Verified all five chapters with short/long notes, actual product hover, and
  desktop/short/mobile viewports: the header anchor does not move, the note grows
  downward, and the presentation and device remain within the viewport.
- The user confirmed that the Angular client root `/` opens the presentation.
  A lazy-loaded presentation component embeds the existing same-origin public
  HTML, preserving its layout and interaction scripts. `/login` and `/home`
  remain direct App entries. Everything runs on the same client server; no
  separate presentation server is needed. The existing HTML URL remains valid.
- Connect the supplied interactive-app-presentation.html layout to the running
  client at /interactive-app-presentation.html?variant=b. The user selected B as
  the final layout; remove the bottom variant switcher and its keyboard controls,
  and always display B, including when an old variant URL is opened.
- The phone frame embeds the actual same-origin client. Chapter buttons navigate
  its existing tabs, app navigation updates the selected chapter, and supported
  hover/focus interactions update the explanation. Keep the current app session
  when changing chapters. Before login, queue a chosen
  chapter until the user enters through the existing login or Demo controls.
- Keep this integration in the standalone public HTML, without changing app
  business flows.
- Use the taller iPhone 11 Pro viewport (375 by 812 CSS pixels) for every
  chapter, with a 395 by 832px outer shell. The
  user requires the complete device to fit without scrolling the presentation
  or scaling app text. This supersedes the short iPhone SE frame, the iPhone 16
  viewport and the scrollable app panel. Remove the connection status and the
  independent-app link entirely, superseding their former upper-right placement.
  Center the device itself horizontally and vertically in the right panel.
  Reduce surrounding space first;
  in smaller windows, let the frame
  and app viewport reflow to available space, without transforms, zoom or font
  overrides. Normal scrolling inside app pages remains part of their UI.
  On mobile, hide the explanatory sidebar.
- Remove the horizontal chapter progress bars and their numeric caption from
  every page. Chapter navigation uses orange circular markers on a fine vertical
  connector, following the supplied UXD timeline reference. Active, hovered and
  keyboard-focused markers receive a translucent orange halo. Chapter labels use
  a single row such as `01 健走地圖`, with number and title at 12px; the selected
  chapter uses 14px for both number and title, superseding the prior 16px.
- Use `#EE6A17` for the active chapter label and each page kicker; kickers are
  16px. Omit Chinese commas and full stops from all chapter headlines.
- Match the supplied spacing annotations across every chapter and layout:
  brand line bottom margin 40px, page kicker bottom margin 8px, intro top margin
  16px, note card top margin 24px, and note-card padding `16px 24px 24px`.
  The note-card heading uses margin `2px 0 4px`.
- Verified in Edge: Demo entry, all five chapters, navigation in both directions,
  hover explanations, variant changes retaining the session, and 390px layout.

## App typography and cancelled palette update (2026-10-28)

- The latest user request cancels the preceding App palette changes. Restore
  the original Ionic theme and purple Demo button. In particular, retain the
  original green secondary color used by map recommendation text. The earlier
  light-orange water-outline clarification no longer calls for a palette change.
  Presentation active navigation and kicker remain the confirmed `#EE6A17`.
- Follow the supplied `typography.png` by semantic role across the five main
  App tabs and their related dialogs, drawers, route cards and map popups:
  12px/400 labels, navigation and metadata; 12px/500 badges and small actions;
  14px/400 content and unselected segments; 14px/500 selected segments, tree
  names and filter values; 14px/700 item prices and reward amounts;
  16px/400 narrative/result content; 16px/500 actions and record/card titles;
  18px/700 section titles; 20px/700 Roboto profile statistics;
  24px/700 page/dialog titles, profile names and primary resource balances.
  Reserve 32px/500 Roboto for Home's today's-step value only.
- Use Noto Sans TC with Roboto for the supplied text/number roles. Remove
  nonstandard text sizes such as 10px, 11px and fluid text-size clamps from
  these screens. Keep decorative icon sizes separate from text typography.
  Do not scale the iframe or shrink its fonts to fit the device.
- Verified in the running Edge client: all five tabs have no visible text
  outside the supplied size scale; Home resources are 24px/700, today's steps
  are 32px/500, and map recommendation hints are 12px with their original
  green text. Device centering and a non-scrolling presentation pass at
  1918x908, 1280x720 and 390x844. The development client recompiles successfully.

## Walking HUD and simulation speed (2026-10-28)

- During an active route, compress the upper resource cards into a single row
  of icons and balances; retain today's steps beneath it. Idle cards keep their
  existing presentation. Move the route-stop action lower toward the tab bar
  and use 中止本次路線 / 確認中止 throughout its confirmation flow. Preserve
  the existing one-second hold and explicit confirmation behavior.
- Add very transparent minus/plus controls below the joystick with faint white
  outlines and no visible current-speed value. The same speed multiplier must
  scale both simulated translation and daily step increments. Calculate steps
  from simulated distance at the existing 0.75 metres per step, replacing the
  unrelated fixed two-steps-per-second credit. Turning in place and dead-zone
  input still earn no steps; Task-eligible credit still requires an active route.
- Reversible control tuning: start at 1× the configured Demo movement speed,
  adjust by 0.25× per press, and bound speed to 0.25–3×. Turn speed remains
  governed by the existing steering settings.
- Verification: client development build and 67 joystick/Home-idle/location
  tests passed. Actual compiled HUD layout checks passed at 320/390/430/1024 px:
  resource row about 34 px, speed-to-stop gap 8 px, stop-to-tabs gap 14 px.
  Rerun scripts/verify-walking-hud.mjs after a development build; its screenshot
  is docs/walking-hud-preview.png and explicitly labels the offline map fixture.
  This verifies local UI and simulation, not live Mapbox or cloud acceptance.

## Route departure card and supply spacing (2026-10-28)

- Follow-up: the user accepts the bottom card's functionality but requests a
  smaller presentation, with no changes to content outside the bottom area.
  Use compact padding, 13–15 px main text, a 12 px hint and a 44 px action with
  a 20 px walking icon. Preserve the card's copy, orange action and behaviors.
- Match the user's second reference with a white bottom card, a route status
  sentence, the hint 點擊「出發」後即可開始導航。 and a wide orange walking-icon
  出發 button. Remove the crossed-out merchant heading/list and the route action
  from the upper destination card; retain its destination and compact metrics.
  Map markers remain the entry to merchant details and optional joining.
- Preserve explicit route updating before departure after stop changes. The
  bottom action reads 更新路線 while the preview is stale, then 出發 after a
  successful update. Loading/failure blocks departure; an empty merchant result
  remains truthful and offers retry without blocking an otherwise valid walk.
- Supply points should be distributed along the actual walking route instead
  of grouped close together. Generated Demo stations use interpolated road
  positions across the early/middle/late sections, superseding the old snapped
  anchors and artificial off-route challenge distances. Published merchants
  retain their real configured coordinates; never move or invent a merchant.
- Apply route-progress and geographic spacing checks to AI recommendations and
  the rules fallback. Keep Gemini's requested count when spaced candidates
  exist; sparse candidate coverage may return fewer stations rather than fill
  the count with adjacent shops. This supersedes unconditional preservation of
  the model's selection count. Existing destination consent and explicit joining
  remain in force. The new cloud recommendation behavior requires Functions
  deployment; local source changes alone do not change the deployed service.

## Task location, walking qualification and manual rewards (2026-10-28)

- The user requests completing the existing daily/weekly/event Task feature,
  following the supplied task-list, activity-detail map and pending-reward
  dialog reference. On 2026-10-28 the user confirmed shared understanding with
  採建議，開始實作 and authorized implementation after grilling.
- Task qualification must combine walking steps and arrival at the configured
  destination. Coordinate-only completion is insufficient because transport
  could satisfy it. Replace the reference's excessive 12,000-steps-in-30-minutes
  example with reasonable tuning. Confirmed defaults are daily 1,000, weekly
  5,000 and event 2,000 steps, adjustable in CMS, with no timed walking quota.
  The screenshot's example numbers do not define task rules.
- The arrival radius defaults to 100 metres and is adjustable in CMS. This
  supersedes the Task specification's fixed 10-metre distance. Location-accuracy
  policy has not yet been changed by the user.
- Keep the name 光能, but Tasks never award it. Task rewards may be water drops,
  fertilizer or items; implement seeds as the initial item reward. This
  supersedes cadence-specific water/fertilizer restrictions and the earlier
  deferral of Task-based seed acquisition. Reaching the conditions creates a
  待領取 state; only explicit 完成任務 credits the reward, once.
- The user accepts a separate Task detail map sharing current location, with
  Home walking state preserved, and asks about repeated Mapbox loading. Mapbox
  GL JS counts map loads per Map initialization (maximum session 12 hours),
  while updating an existing map does not itself add a map load:
  https://docs.mapbox.com/mapbox-gl-js/guides/pricing/ . Implementation retains
  one Task-map host across detail visits, updates its markers and arrival circle,
  and stops updates while hidden. A unit regression verifies switching tasks,
  detaching/reattaching and cached-page ownership without creating another Map.
  Do not promise that routing caches or cached JS remove initialization charges.
- The user confirms this increment is a browser-only simulated demonstration;
  do not add Android/device step acquisition. Existing normal-account cloud
  progress remains client-reported, not sensor proof. The user describes the
  future ordinary-walking flow as reading steps when the app opens and awarding
  equivalent step light; demonstrate that with simulated data in this increment.
- Only movement after a Home planting destination has been chosen, its route
  planned and departure explicitly confirmed can contribute Task steps. Ordinary
  movement outside an active confirmed route contributes only ordinary step/light
  progress. Preserve the distinction between general and Task-eligible counters.
  The existing light conversion and cap have not explicitly been changed.
- The user accepts saving ready qualification: after satisfying both steps and
  arrival, leaving the destination does not revoke it. Explicit manual claim is
  allowed until the Task's existing end time; there is no additional grace period.
- Daily/weekly Tasks automatically accumulate eligible steps in the current
  Taipei day/Monday-based week. Event Tasks count only eligible steps after
  explicit enrollment. One walk can advance several Tasks; each still requires
  its own destination arrival. Steps accumulate across walks, and terminating
  a walk preserves already-walked steps. Planning, idle movement and turning
  in place never increase Task steps. Revalidate both steps and fresh proximity
  together before recording ready qualification.
- Related defects repaired: Demo Task rewards credit the shared inventory once;
  normal-account reward synchronization preserves active Home routes and care
  timers, rebases concurrent spending/movement and reads canonical balances
  instead of restoring a stale retry receipt. Interrupted resource refresh can
  retry the existing receipt. Identity changes discard pending UI/async results.
- Task qualification uses a fresh observation (maximum age 30 seconds, maximum
  future skew five seconds) and retains the earlier 10 m accuracy requirement.
  Normal-account join, qualify and claim operations use completeTask; enrollment
  baselines and ready qualifications are command-owned. Deploy the updated
  completeTask, saveWalkProgress, cmsCommand and Firestore rules before normal
  cloud acceptance; no deployment or cloud catalog write occurred here.
- Task seed rewards draw hidden species from the first enabled published pool,
  without the separate route-drop probability. Preserve the task destination and
  acquisition time under a task-prefixed source ID. Seeds are capped at 100 per
  reward transaction as an implementation size bound, separate from economics.
- Local UI QA mounts the actual compiled task list, detail and reward dialogs
  with actual Task/Progress stores and isolated auth/catalog/map fixtures. All
  320/390/430/1024 px layouts pass, including cancel-without-credit and one-time
  explicit claims. External HTTPS is blocked; this does not verify live Mapbox,
  cloud functions or authenticated cloud acceptance. Screenshots are
  docs/tasks-list-preview.png, docs/tasks-detail-preview.png and
  docs/tasks-reward-preview.png; rerun scripts/verify-tasks.mjs after a development
  client build. The detail screenshot explicitly labels the offline map stand-in.
- Final local verification: client and CMS development builds and Functions
  TypeScript build passed. The 12 related client test files report 171 passed
  and four skipped: three existing skips and one explicit exclusion of the
  previously recorded harvest-dialog test expecting an absent Demo badge.
  Functions report 118 passed and one explicit exclusion: the existing Cathay
  location-import test references missing
  firebase/seed/cms-cathay-locations-2026-10-27.json in this checkout. Both existing
  issues were observed before exclusion; no failing assertion was changed to
  hide them. These are related-suite results, not a passing full-client claim.
  Final compiled-UI QA and whitespace checks also passed. No cloud acceptance,
  Security Rules emulator test, deployment or publication was performed.

## Destination selection feedback (2026-10-27)

- Presentation follow-up: match the supplied destination reference with a
  `目前目的地` eyebrow, prominent place-only title and separate rounded gray
  chips for walking duration, distance and estimated steps. Remove the heading
  emblem and the three-column metric panel. Keep chips on one line; horizontal
  scrolling accommodates narrow screens and added chips. A warm orange supply
  count may use actual recommendations after confirmation; do not invent offers.
  Retain the existing selection and confirmation actions.
- The chip presentation follow-up passes the client development build and all
  eight destination-card tests. No deployment performed.
- The latest compact reference supersedes the oversized 60 px action treatment:
  use a compact white card, `目的地` eyebrow, tighter title/chip spacing and
  equal-width pale-gray/orange buttons. Size actions proportionally at 36–48 px
  on mobile, with centered bold text and no candidate icon. Use explicit button
  colors without Ionic color attributes overriding them. Chips remain one row.

- Candidate destination cards offer `再看看其他地點` and `確認地點` side by
  side. The former clears the candidate and returns to destination browsing
  within planning. The upper-left back arrow cancels the plan and returns Home.
- Home's `開始散步` remains the entry to destination planning; opening or
  browsing a candidate does not request AI supply recommendations. Only
  `確認地點`, after the existing over-60-minute consent where applicable,
  requests those recommendations. Route preview and departure confirmation
  remain separate actions.
- Local verification: client development build passed. The two relevant test
  files report 53 passing tests, including the new button and AI-entry checks;
  15 Home integration tests fail with missing `Auth` injection in the test
  setup. This is not a passing full-suite claim. No deployment performed.

## Backpack seed drawer and planting confirmation (2026-10-27)

- Presentation follow-up: match the supplied clean filter-sheet reference with
  a pure white background and neutral text/controls. Remove decorative icons,
  section slogans, repeated totals, item explanations and the instructional
  footer. Retain seed artwork, names, acquisition places, segment quantities
  and necessary actions; use a text close action. Naming follows the same
  minimal treatment, retaining field validation and planting confirmation.
- The user requests a bottom-opening backpack modal occupying 90% of the
  viewport, with clear 種子 / 道具 segments. Seeds appear three per row;
  display names are 小種子, 普通種子, 大種子 and 特別種子, with acquisition
  location beneath each name.
- Seed appearance may subtly hint at its hidden species through restrained
  coloration and shell details. This supersedes the previous identical-backpack
  appearance requirement. The actual species name is still revealed only at
  小樹 (30%); the shared early planted-tree models remain applicable.
- Selecting a seed opens a naming dialog, defaulting to `(用戶名)的樹`.
  Only explicit 確定種植 consumes that selected seed and plants the named tree.
  Cancelling naming or closing the backpack consumes nothing. Existing empty-site
  and proximity restrictions continue to apply; preserve fertilizer effects.
- Acquired seeds must belong to the route that awarded them. This increment
  records the completed route's ID, its departure-time destination label and
  acquisition time, without storing raw walking coordinates. Old seeds without
  provenance show 取得地點未記錄; never assign them an invented locality.
- Exact species-to-size/category assignments remain unconfirmed. Current visual
  defaults group 桂花/櫻花 as small, 榕樹/樟樹 as ordinary, 柿子/楓香 as large
  and 銀杏/國泰小樹 as special. These reversible presentation defaults do not
  change drop probabilities, growth speed or resource costs.
- Local verification: client development build and Functions TypeScript build
  passed; 96 seed/route tests, three targeted cultivation integration tests and
  10 Functions tests passed. The broader cultivation suite still has 11 modal
  test-mounting failures; this is not a passing full-suite claim. Actual compiled
  backpack fixture checks passed at 320/390/430/1024 px, including 90% height,
  three columns, segment switching, naming cancellation/confirmation, empty
  inventory and reopening. Preview screenshots under `docs/backpack-*-preview.png`
  use fixture seeds, without adding inventory or writing cloud data. No deployment.

## Cathay service-location planting seed (2026-10-27)

- Import failure diagnosis: the first generated artifact left every tree `name`
  empty, but shared `validateConfig` requires a nonblank name even for empty
  planting sites. Fill `name` with the location label (`place`), retaining
  `empty: true`, blank species and zero growth. The full corrected artifact
  passes the actual shared validator; all 35 CMS domain tests pass, including
  a regression that imports this exact artifact and checks the upload byte limit.
- At the user's request, create a CMS import artifact that replaces the 51
  mock planting-site presets from the current CMS seed snapshot with Cathay
  service locations. The file is
  `firebase/seed/cms-cathay-locations-2026-10-27.json`; all other catalog
  categories are retained, and these new sites start empty with zero growth.
- Use the attached location list's coverage: Taipei City and New Taipei City
  ATM locations, plus Taipei, New Taipei and Keelung branch locations. The
  current official Cathay location feed supplies coordinates and address data:
  `https://www.cathaybk.com.tw/CathayBK/service/Locations/LocationsGetData.ashx`.
  Exclude three non-branch operational departments from the branch list.
- The 2026-10-27 feed yields 93 public branch/service locations and 1,944 ATM
  records in the attached coverage. Exact-coordinate deduplication combines
  co-located records into 1,716 physical planting points; each label keeps a
  representative site name, co-located ATM count where relevant and address.
  The official coordinates replace approximate/demo coordinates. These are
  demo planting spots only and do not imply branch access, bank approval or a
  Cathay partnership.
- CMS seed validation and file upload limits now allow up to 2,500 tree
  presets and 850,000 UTF-8 bytes; the corrected compact seed is 663,929 bytes. Import
  only loads the seed into the draft; saving and publishing remain operator
  actions. No cloud catalog write or publication was attempted.
- The attached CMS export had seven species, while the current workspace seed
  has eight, including `國泰小樹`. Keep this newer local species catalog in the
  generated file; importing it remains a draft-only action.
- The supplied list covers only the northern locations described above.
  Whether to expand this demo seed to every Taiwan branch and ATM remains
  unresolved.

## Mystery seeds, species atlas and route rewards (2026-10-27)

- The user confirms that all seed species share the same appearance. A player
  names and plants a mystery seed; its species is revealed only at 小樹 (30%
  growth), superseding the earlier provisional 幼苗 (10%) reveal. The first
  four growth stages share their existing models. Preserve existing planted trees.
- Implement random seed discovery only on successful walking-route completion
  in this increment. Task-based seed acquisition is deferred. A failed check-in,
  cancellation or intermediate supply stop does not roll or award a seed.
- CMS must manage the route seed drop chance and weighted species distribution,
  distinguish conditional species probability from per-completed-route probability,
  and show species growth-stage images. Players cannot select a probability pool
  when planting; their backpack shows one mystery-seed appearance.
- Extend the existing botanical model from 小樹 onward with species-specific
  leaf, bark and blossom colors and leaf proportions. Preserve the eight growth
  milestones, care mechanics and 小樹點-icon fruiting/harvest behavior.
- Initial tuning is a reversible demo default: 35% seed discovery per completed
  route, at most one seed per route; species weights 榕樹 30, 樟樹 24, 桂花 18,
  柿子 12, 楓香 8, 櫻花 5, 銀杏 2, 國泰小樹 1. Final economics and any further
  per-day limits remain unresolved. CMS can change drop chance and weights.
- Retain the hidden species drawn when a seed is acquired, even if later CMS
  edits disable or remove its pool. Freeze route reward configuration at departure.
  Legacy starter/generic seeds draw from the configured pool when planted.
  Player progress retains existing Demo/normal identity separation and persistence.
- Local verification: client/CMS development builds and Functions build passed;
  258 related client tests passed, with three existing skips and one explicitly
  excluded pre-existing harvest-dialog test (expects an absent `Demo` badge).
  All 96 Functions tests passed, including revisioned hidden-seed persistence.
  This is not a passing full-client-suite claim. The existing cultivation-modal
  mounting failures described elsewhere remain outside this related test run.
- Local visual QA mounted the actual built CMS species page with fixture data,
  blocked external HTTPS, and verified no document overflow or broken images at
  1440/1024/390/320 px. Both built frontends contain all 60 generated model images.
  Preview artifacts are `docs/seed-species-cms-preview.png` and
  `docs/tree-species-growth-preview.png`; usage is in `docs/seed-species-gameplay.md`.
  The validated `firebase/seed/cms-gameplay-2026-10-27.json` preserves the prior
  local expanded file's 51 sites, 92 merchants and unrelated categories while
  adding the new gameplay defaults. No deployment or cloud write was attempted.

## Along-route merchant choices and destination card (2026-10-27)

- The user clarifies that a distant walking destination should offer optional
  merchants along the whole route for the player to add and visit. Consider
  travel order along the actual route, including intermediate sections; preserve
  destination confirmation and the over-60-minute consent before recommendations.
  Gemini still decides the number of recommendations. Never invent a merchant
  when the published catalog has no candidate in a section.
- Distinguish recommended merchants from merchants the player has chosen. A
  zero selection count must not imply there are no recommendations. Display both
  counts, with a horizontally scrollable set of merchant detail entry points.
  Viewing details does not add a merchant; joining still requires confirmation
  and the established updated route preview before departure.
- The user requests improving the destination card's presentation. Use a soft
  white rounded card, clear destination heading, one row of three labeled route
  metrics, a separate supply section, and the orange primary action. Show a
  compact empty message with retry when no recommendations were returned.
- Rules fallback should also distribute its choices along the route. This only
  changes model-failure behavior; it does not override Gemini's selection count.
  Expanded cloud data/publication and deployment are still required; the prior
  corporate Firestore write restriction remains in force.
- Local layout QA uses the actual built Angular/Ionic card with fixture merchants,
  with external HTTPS blocked. The 320/390/430 px layouts keep all three metrics
  on one row without document or metric overflow. This is presentation validation,
  not live cloud recommendation, authentication or map-provider acceptance.

## Destination summary chips (2026-10-27)

- Keep the destination card's walking duration, estimated steps and distance
  chips on one row, including narrow mobile screens. Use compact spacing and
  text; the confirmed destination's supply-count chip may occupy the next row.

## Destination-first supply recommendations (2026-10-27)

- Planting locations show cultivation information only. Merchant offers belong
  exclusively to AI-recommended extra supply stops after the player confirms
  a walking destination; opening a planting location must not count as an offer view.
- Gemini decides the number of extra supply stops using origin-to-destination
  distance, current Taipei time and current weather. There is no fixed six-stop
  limit and no AI-selected replacement planting destination in this flow.
- The user confirms a warning for estimated walking times strictly above
  60 minutes. Display the estimated duration and require explicit acceptance
  before confirming the destination and requesting Gemini; cancellation preserves
  the candidate destination without requesting recommendations.
- Demo starts at the existing Banqiao Google office position. Support a nearby
  Banqiao destination and a distant Neihu destination, with station coverage in
  Banqiao and all twelve Taipei districts. Existing content remains simulated;
  new demo merchants must not imply real offers or partnerships.
- Recommendation context uses live weather when available and explicitly unknown
  weather on lookup failure; fixed scene weather is not current weather evidence.
  Preserve the configured-candidate validation and rules fallback on AI failure.
  Existing planting records and confirmed walking routes retain their identities.
- Follow-up: planting scenes must also use live weather at each planting location
  and the current Taipei time, replacing the earlier fixed per-POI scene assignment.
  Preserve the existing twelve scene assets. Weather failure is visible to the
  player and must not be described as a current sunny-weather observation.

- Local delivery: the seed catalog now has 92 merchants and 51 planting sites,
  including 65 new explicitly fictional supply merchants and 23 new planting
  sites. The 2026-10-27 import file merges the prior local cloud export while
  preserving its existing records; it is not a fresh cloud export. CMS's merge
  action preserves current operator edits and still requires save/publication.
- Local verification: client/CMS development builds and Functions build passed;
  173 related client tests and all 90 Functions tests passed. The updated live
  scene weather/time integration test also passed independently. The cultivation
  suite still has 13 previously documented Ionic modal mounting failures and
  one skip; do not describe the full client suite as passing. No deployment,
  cloud catalog write retry or live Gemini/weather acceptance test occurred.
  The previously recorded corporate Firestore write restriction remains in force.

## Seed pools, merchant attribution and CUBE preferences (2026-10-22)

- User confirms that a player names a tree when planting. The planted seed type
  determines a weighted species pool; the resulting species is unknown at planting.
  Operations can configure common/rare outcomes. Manage planting locations separately
  from species and seed pools. Preserve existing player cultivation records.
- Add planting locations and merchant candidates within Taipei Neihu and New Taipei
  Banqiao. New planting locations should be separated; merchants have no minimum
  separation and Gemini selects from the configured candidates.
- Preserve recommendation selections, offer views, navigation intent and proximity
  arrivals as separate business measurements. Record Gemini versus rules source,
  configuration version and selected benefit plan. A navigation is not a visit;
  a client-reported or simulated proximity arrival is not evidence of a purchase.
  Existing identity separation and event-deletion deadline remain in force.
- User explicitly places CUBE benefit-plan selection in Profile, not Home. It is an
  app recommendation preference and does not switch the actual bank card's benefits.
  A new preference applies to subsequent recommendations, preserving confirmed routes.
- Only domestic CUBE channels may influence domestic recommendations. Official
  references checked on 2026-10-22 list LOPIA Taiwan, FamilyMart, 7-ELEVEN,
  PX Mart (excluding the separately branded hypermarket) and IKEA under 集精選.
  Official 秋日遊 UNIQLO terms refer to Japan; do not assume Taiwan eligibility.
  Sources: https://www.cathay-cube.com.tw/cathaybk/personal/product/credit-card/cards/cube-list
  and https://www.cathaybk.com.tw/cathaybk/promo/event/credit-card/product/japanrewards/index.html
- Unresolved: final species-reveal milestone, exact minimum location separation,
  and acquisition/allocation of distinct seed types. Current demo defaults reveal at
  the seedling stage (10% growth), generate new sites at least 450 m from catalog
  locations, and allow the existing generic seed balance to choose a configured pool.
  These are reversible implementation defaults, not user-confirmed product rules.
- Merchant arrival currently means an active route entering a 50 m radius of a
  configured merchant coordinate, checked again on the server. Deduplicate by
  identity, route and merchant; keep the departure-time benefit preference.
  The 50 m radius is a demo measurement default and does not change the existing
  cultivation or supply-claim radius. Raw player coordinates are not persisted
  in these analytics events.
- Profile preference currently persists per identity on this device. Cross-device
  preference synchronization and bank-account integration are not implemented.
- Expanded catalog retains 13 legacy demo presets and adds 15 separated empty sites
  plus 22 merchants with official names/addresses. New merchant coordinates are
  approximate demo positions around those addresses; entrances remain unverified.
  Existing five simulated merchants are retained. LOPIA channel metadata is included;
  no unverified LOPIA branch is invented in either district.
- Expanded content is prepared as local seed files and a CMS merge-into-draft action
  that preserves existing operator edits. Cloud catalog import and publication are
  pending the corporate proxy policy blocker described below; related Functions
  deployment is complete. Hosting has not been redeployed.
- The user explicitly authorized updating cloud data on 2026-10-22. The first
  read-only migration preview failed because Firebase CLI credentials are no longer
  valid; no cloud writes occurred. Reauthentication was initiated, but the CLI's
  agent login flow requires the user to complete authentication. Resume with
  `functions/scripts/merge-expanded-catalog.mjs` after login. It previews changes,
  merges the draft and publication independently, checks live planting distances,
  preserves operator edits and unrelated categories, atomically backs up prior
  documents to the administrator audit collection, and verifies the readback.
- Follow-up after the user reauthenticated on 2026-10-22: authentication and
  read-only preview succeeded. Deployed `cmsCommand`, `cmsRecommend`, `cmsTrack`
  and `cmsDashboard` successfully in `asia-east1` (CLI exit 0, all four successful
  update operations). The first deployment attempt hit discovery timeout; retry
  used the installed CLI's `FUNCTIONS_DISCOVERY_TIMEOUT=60` option and passed.
- Catalog writes remain blocked by Forcepoint HTTP 403 with the explicit message
  "The request was blocked because it violates corporate policy." An empty REST
  commit succeeded but the actual content commit was blocked; SDK and REST write
  attempts both failed. Stop write retries until IT resolves the policy restriction;
  do not work around it using another host, encoding, transport, or network path.
  The endpoint is `https://firestore.googleapis.com/v1/projects/cathay-ai-hackathon-team-03/databases/(default)/documents:commit`.
- Final read-only verification confirmed draft revision 8 and publication version 5,
  each still containing 5 merchants, 13 tree sites, zero seed types and zero CUBE
  channels. No catalog migration was committed. The prepared merge would produce
  27 merchants, 28 sites, 3 seed pools, 6 CUBE channel records and preserve all 8
  cloud species. The migration now uses an atomic REST commit with exact update-time
  preconditions, an audit backup, canonical comparisons and readback verification.
- Local validation passed: 66 Functions tests, 214 client regression tests
  (three existing skips), Functions TypeScript build, and client/CMS development
  builds. Live bank integration, entrance field checks and cloud acceptance remain
  outside these local verification results.
- At the user's request, exported the latest cloud draft merged with all expanded
  records to `firebase/seed/cms-expanded-2026-10-22.json` (46,338 UTF-8 bytes).
  The read-only export observed draft revision 9 and publication version 6;
  those versions had advanced since the prior verification, independently of this
  export. The file preserves the latest draft's existing records and includes
  28 sites, 27 merchants, 8 species, 3 seed pools, 6 CUBE channel records,
  17 tasks, 3 rewards and 12 scenes. Schema validation and ID completeness passed.
  Export writes only the local file; no cloud mutation was attempted. Standard
  file import replaces the in-memory draft and still requires save and publication.


## Recommended supply marker visibility (2026-10-22)

- User requires Gemini-recommended supply stations to remain individual map
  markers instead of disappearing into marker clusters. Exclude active
  `cmsRouteRoles` supply selections from the cluster source and visibility
  suppression. This also preserves visibility for deterministic fallback
  selections that use the same recommendation seam. Other markers retain
  existing clustering; clearing recommendations restores normal clustering.
- All 56 home-map tests passed, including a regression covering a clustered
  station becoming recommended, remaining visible while ordinary stations
  stay clustered, and returning to clustering when recommendations clear.
  This change has not been deployed to Hosting.

## Gemini cloud diagnosis (2026-10-22)

- The user requests relaxing the recommendation timeout and removing the
  home-map recommendation status message. Use a 15-second Vertex fetch
  timeout (superseding the earlier seven-second setting) and disable Flash
  thinking for this bounded ranking task. Keep deterministic fallback and
  the existing 30-second callable limit. Remove home loading/source/reason
  text and render the recommendation action only when actionable; CMS still
  shows the recommendation source. Distinguish timeout and invalid JSON in
  safe server logs without logging model content or credentials.
- Local validation for this change passed: Functions TypeScript build,
  all 56 Functions tests, and client development build. No Functions or
  Hosting deployment was performed; the cloud still requires deployment
  before the revised timeout and request settings take effect.

- Follow-up after the user enabled the API: Service Usage reports `ENABLED`.
  A live `gemini-2.5-flash` request with the CLI user identity returned HTTP 200
  in 1.5 seconds. Impersonating the Functions identity was denied
  (`iam.serviceAccounts.getAccessToken`); no IAM changes were made.
- Two authenticated Demo calls to the deployed `cmsRecommend` still returned
  `source: rules` (8.9 and 7.5 seconds, publication version 5). The temporary
  anonymous Auth account was deleted after testing. Its bounded rate-limit
  document remains subject to the existing cleanup mechanism.
  Latest fallback categories are `unavailable-or-invalid-output`, not 403.
- Direct probes with the recommendation prompt and local seed candidates,
  using the CLI identity, returned valid five-selection JSON: default thinking
  took 6.5 seconds with 754 thinking tokens; `thinkingBudget: 0` took 2.0 seconds.
  The deployed 7-second fetch timeout is a suspected remaining blocker, not
  proven: existing logs conflate timeout and invalid output, and the probe
  used local seed candidates rather than the live publication. No code or
  deployment changes were made during this follow-up test.

- Read-only cloud checks confirmed `aiplatform.googleapis.com` is `DISABLED`
  in `cathay-ai-hackathon-team-03`. This is a confirmed blocker for the current
  Vertex AI integration. Authenticated `cmsRecommend` logs repeatedly show
  `cms_gemini_fallback` with `category: vertex-403`, including 12:02, 12:50
  and 13:00 Asia/Taipei on 2026-10-22.
- The deployed function uses `gemini-2.5-flash`, location `global`, and runtime
  identity `1039933163857-compute@developer.gserviceaccount.com`. Project IAM
  grants this identity `roles/editor`; no explicit `roles/aiplatform.user`
  binding was found. Do not infer that missing explicit binding alone proves
  an effective permission denial.
- No API activation, IAM change or deployment was performed in this diagnosis.
  After API activation, verify an authenticated recommendation returns
  `source: gemini`; further permission, model-access or quota blockers have
  not yet been ruled out. Existing fallback logging retains HTTP status only.

## Collection Firestore filters (2026-10-22)

- The user confirms tree records should have a three-digit string `postalCode`,
  preserving `place`. Region selectors display 台北市內湖區 (114) and
  新北市板橋區 (220), and match postal codes instead of species.
- Species options use the shared Firestore publication's `config.species`;
  exact species and region matches combine with the existing status filter
  for both grid and map. Multiple choices within each selector use OR.
- CMS tree editing and publication preserve postal codes. Known legacy demo
  places can be backfilled; unknown places must not be assigned a guessed district.
- Local verification passed: 12 collection tests, 5 CMS publication integration
  tests, 56 Functions tests and client/CMS development builds. Both seed files now include
  postal codes for all 13 existing demo tree presets.
- After the user reauthenticated on 2026-10-22, cloud backfill succeeded and
  all 13 tree postal codes were read back from both draft and publication
  (draft revision 8, release version 5). Existing CMS content was preserved.
  One CMS-edited place, 亞東紀念醫院, was verified as 220 against the hospital's
  official address: https://www.femh.org.tw/mainpage/contact. The migration script
  includes that exact-place mapping; unknown places still remain unassigned.
- `cmsCommand` deployment completed successfully in `asia-east1`, including its
  predeploy build, to preserve postal codes on later saves/publications.
  Hosting was not redeployed during this follow-up. The existing client changes
  read the shared publication and support legacy places in memory.

## Collection filter sheet presentation (2026-10-22)

- Match the user's screenshot with a content-height white bottom sheet, a drag
  handle, stacked-label outlined selectors and equal-width gray/orange actions.
- This is a presentation change only; the current placeholder options and
  unimplemented region/species filter actions are not new filtering rules.
- Reset the modal open signal on dismissal so the sheet can be reopened.

## Global client modal styles (2026-10-22)

- The user requests moving the service-backed modal's `ion-modal` styles into
  `client/src/styles.scss` so directly declared modals share the same defaults.
- Preserve the existing `auto-height-sheet` and `supply-station-sheet` class
  modifiers. Component-specific modal styles can still override global defaults.

## Collection long-time-no-visit threshold (2026-10-22)

- The user confirms that "long time no visit" means 14 days or more, inclusive.
- The collection filter uses the existing Asia/Taipei visit-day records.
  Trees without a recorded visit are counted from their planting day; a
  previous planting cycle's visit must not predate the current planting baseline.
- Both grid and map use the same filtered collection. The empty-state message
  states the 14-day threshold instead of describing it as unresolved.

## Repository tracking scope (2026-10-22)

- Manage the complete CAT-WALK-APP repository from its root. The `cms` branch
  includes both `client/` and `cms/`, together with shared Functions,
  Firebase configuration and documentation; CMS is not a separate repository.
- Keep frontend source, package manifests and lockfiles tracked. Ignore local
  dependencies, Angular caches, build/test output and tooling logs for both
  frontends. Preserve local runtime/map configuration exclusions.

## Redemption reference layout (2026-10-21)

- The user requests the client redemption screen match the supplied reference:
  a white two-column wallet, ecological charity card, horizontally scrolling
  product cards, a full-screen product detail view with an orange redemption
  action, and a compact success dialog with transaction details and balance.
- Preserve the published CMS catalog and current point-based redemption rules;
  screenshot balances, products and voucher requirements do not establish new
  reward rules. Gray image placeholders follow the reference.
- The current implementation links the success dialog's ticket action to existing
  transaction history and labels simulated redemption explicitly. Actual ticket
  issuance, validity and merchant barcode redemption remain unresolved.

## Unified simulation content (2026-10-21)

- Hosting preview published to channel `cms-preview`, including client at `/`
  and CMS at `/cms/`: https://cathay-ai-hackathon-team-03--cms-preview-y5yvbvh6.web.app
  Expires 2026-10-28 14:35:50 Asia/Taipei. Verified HTTP 200 for the client,
  CMS and `/cms/merchants`, with the correct CMS base path. Live Hosting is unchanged.
- The user supplied the Mapbox public token for preview delivery. It is present
  in the ignored generated runtime configuration and deployed preview assets;
  do not record its literal value in project memory. The Mapbox Standard style
  API returned 200 using that token and the preview origin. Future client builds
  must set `MAPBOX_PUBLIC_TOKEN` because prebuild regenerates runtime-config.js.

- Company network commands require process environment settings:
  `HTTPS_PROXY=http://pxoawcg:8080`, `HTTP_PROXY=http://pxoawcg:8080`,
  `NO_PROXY=localhost,127.0.0.1`, `NODE_USE_ENV_PROXY=1`,
  `NODE_USE_SYSTEM_CA=1`. Use these for Firebase/Google network operations.
  Firestore seed tooling uses REST transport for proxy compatibility.
- With these settings, the shared Firestore seed import succeeded and was read
  back at revision/version 1 with all expected content counts. This supersedes
  the earlier unverified import status below.
- Proxy-enabled deployment completed successfully for `cmsCommand`, `cmsRedeem`,
  `cmsHarvest`, `cmsRecommend` and `cmsValidateStation`; CLI exited 0 with zero
  Functions errors. All five live endpoints returned expected unauthenticated
  401 responses and CORS for `http://localhost:4200`. Authenticated CMS CRUD still
  needs administrator acceptance. Seed rerun confirmed existing content is
  preserved. Client production+preview build also passed with the proxy settings.
  Hosting was not deployed in this retry.

- The user confirms all current CMS content is simulated; remove the Demo/normal
  content selector and import the client's mock content into Firestore for CRUD.
  A production launch will rebuild the database. This supersedes earlier CMS
  content isolation requirements. Keep identity-scoped player progress and history.
- Use the existing `demo` content document as the shared catalog, retaining draft,
  publication and revision checks. Account authentication is unchanged.
- Implementation prepared: CMS selector removed, client and trusted content
  validation read the shared publication, and task publication updates `/tasks`.
  Seed package contains 5 merchants, 13 tree presets, 7 species, 3 rewards,
  12 scenes and 17 tasks. The importer preserves existing CMS documents on rerun.
- Local verification: CMS build, client development build and 45 Functions tests
  passed. Production client build hit a Google Fonts download timeout. Cloud
  import and Functions deployment are pending: after CLI reauthentication,
  Google Cloud endpoints still timed out from the execution environment. No
  successful cloud write or deployment has been verified for this change.
- Deployment retry on 2026-10-21 at 14:11 Taipei time: CLI token remained valid
  and Functions predeploy build passed, but IAM and Cloud Resource Manager
  requests again failed with connection timeouts. Firestore import did not
  return a successful result; cloud completion remains unverified.

## CMS scope extension (2026-10-21)

### Additional CMS administrators (2026-10-21)

- At the user's explicit request, granted `cmsAdmin: true` to verified Google
  identities `mickylumc@gmail.com`, `shadow210021@gmail.com`,
  `pon860516@gmail.com`, `yunchi.wu17@gmail.com`, `megan880330@gmail.com`, and
  `ai-hackathon-team-03@demo-wsp-enterprise.reseller.dynacloud.co` in
  `cathay-ai-hackathon-team-03`. All six grants were read back and verified;
  unrelated existing claims were preserved. Users must sign out and sign in
  again to refresh their ID token. This verifies role provisioning, not an
  authenticated browser acceptance test for each account.

### Login presentation exception (2026-10-21)

- The user explicitly requests the initial custom login presentation again.
  Custom styles are permitted on the CMS login page; the authenticated CMS
  retains the established rootNgV2 direction. Original custom CSS was not found
  in repository history, so the login is reconstructed as a standalone component
  with a green brand panel and responsive white sign-in panel. Authentication,
  verified Google identity and `cmsAdmin` checks remain unchanged.
- Administrator provisioning can use the existing Firebase CLI login via the
  optional package-path argument to `functions/scripts/grant-cms-admin.mjs`,
  alongside the existing ADC option. Grant/revoke operations read the account
  back to verify the claim; all existing unrelated claims are preserved.
- Custom login was built and published to the existing `cms-preview` channel;
  expiry is now 2026-10-28 14:44:27 Asia/Taipei. Chrome checks at 1440px and 390px
  confirmed the desktop split layout, mobile stacked layout, a 50px sign-in
  button and no horizontal overflow. Cached preview HTML can show the previous
  design; hard refresh when reviewing. Mapbox runtime configuration is preserved.

### CMS UI conformance (2026-10-21)

#### Mock seed import navigation (2026-10-21)

- The user requests mock seed import on its own CMS route with a sidebar menu
  entry. Remove seed import blocks and unused imports from content-management
  pages; preserve the existing importer behavior and draft-only safety on the
  dedicated page.

- The user requires the CMS frontend to use rootNgV2 components and official
  utilities throughout, without custom visual styles or replacement UI widgets.
- The user further confirms CRD as the implementation reference, especially
  its Layout: header/logo/account alignment, `cub-collapsible-menu` inside the
  sidebar, desktop collapse versus mobile overlay behavior, library-managed
  content spacing, and `cub-footer` projected through `cubLayoutFooter`.
- Preserve CMS behavior and the separate client UI; this direction changes the
  CMS presentation rather than the confirmed operational scope.
- The user additionally requires each CMS function to have its own component
  and route, with each content block enclosed in a rootNgV2 card. The seven
  initial page routes are dashboard, merchants, trees, rewards, scenes, budget
  and AI; the later task-management request adds a separate tasks route.
  Shared draft/publication state must survive navigation between these pages.
- The user requested the CMS login screen as its own `/login` route. Unauthenticated
  navigation redirects there with a safe internal return URL; successful
  authorization returns to the requested CMS route. The existing Google sign-in,
  admin-claim checks and login presentation remain in place.

### Confirmed direction

- On 2026-10-21 the user requested station, task and product CRUD, with Google
  Maps for visual location selection on stations and tasks. Here "task" means
  the existing daily/weekly/event feature; AI-selected extra supply stops are
  explicitly outside this task-management scope. Preserve draft/publication,
  rootNgV2 presentation and Demo/normal isolation. Google Maps API configuration
  is a setup input; do not assume Firebase credentials enable Maps.
- The user specified port 4200 for local CMS use instead of 4300. Live Google
  Maps loading, point selection and marker dragging were verified at
  `http://localhost:4200/`. The provided browser key is stored only in the
  ignored local Maps configuration file. Geocoding currently fails because the
  key is not authorized for that service/API; map selection and manual
  coordinates remain usable. Do not describe address search as live-verified
  until Geocoding API access is configured.
- Task management uses the existing daily/weekly/event reward rules (water
  drops for daily/weekly, fertilizer for events). Each record is one dated
  occurrence; automatic recurring issuance is not implemented. Normal
  publication synchronizes only CMS-managed `/tasks` records. Removal disables
  the task for new enrollment/completion while retaining player history;
  completion snapshots preserve the original reward and task content. Submission
  checks the published version before issuing rewards. Demo publication feeds
  the separate local demo task repository, never the normal task collection.
  Existing normal tasks may be loaded into the draft explicitly for review.
  These are implementation choices preserving the established task model,
  rather than new definitions of AI-selected supply routes.
- CRUD extension validation: Functions build and 45 tests, client
  production+preview build and five Demo task tests passed. Browser fixture CRUD
  checks passed for merchants, tasks and products; live Google Maps selection
  was verified separately from the fixture SDK address-search test. Deployed
  `cmsCommand`, `completeTask` and Firestore rules for this extension. The CLI
  again timed out only after reporting successful updates and completion;
  independent checks from the 4200 origin verified OPTIONS 204 and unauthenticated
  POST 401 for all nine CMS callables plus `completeTask`. No task data was
  automatically imported or published; authenticated cloud CRUD still needs
  administrator acceptance. Hosting assets are prepared locally, not deployed.

- The user reports that client development is nearing completion and requests
  a simple administration interface in the same repository's `cms/` directory.
  This is a new scope decision superseding the earlier exclusion of a
  content-management UI; it does not imply production readiness.
- The CMS will support collecting user data and analyzing business value,
  together with station-location settings, exchange-ratio settings, redemption
  reward management, and cost/budget controls. Detailed behavior and acceptance
  criteria remain subject to the new grill-me discovery rounds.
- Use the company's latest UI kit, referencing the existing CRD project at
  `D:/Users/00594664/Desktop/CRD`. The exact package, approved current version,
  and integration constraints must be verified rather than assumed.
- Connect to Firebase for the initial data integration. Round 3 confirms real
  Gemini integration for this delivery; other GCP additions remain candidates.
- The management demonstration should show credible operational and commercial
  value, alongside the potential of AI and cloud applications.
- Existing Demo data separation, privacy constraints, trusted reward commands,
  and the exclusion of real payments/production loyalty integration continue
  to apply unless explicitly changed in subsequent confirmed decisions.

### Discovery round 1 confirmed (2026-10-21)

- Business objective: secure support for a small-scale pilot. Also demonstrate
  how attracting merchants to become app stations could support the company's
  current TWQR partner-merchant recruitment initiative. This is a pilot business
  hypothesis, not an existing merchant partnership or proven conversion result.
- CMS changes must be adopted by the client after publication, including newly
  added stations and their latest merchant offers/plans. A draft-only CMS is
  insufficient. Rounds 2 and 3 below settle publication and active-route behavior.
- Analyze existing account, step, planting, and redemption data where available;
  add only necessary funnel events. Default reporting is aggregated and
  de-identified. Explicitly distinguish seeded demonstration data and missing
  historical measurements. Existing private-anchor/track restrictions remain.
- First-slice configurable reward economics: harvest point amounts and catalog
  redemption prices. Defer changes to step/light/water/growth conversion formulas.
- Track both reward costs and cloud/API expenditure, presented separately.
  Provide budgets and alerts; do not stop reward issuance automatically when
  budgets are exceeded. Cost definitions and data freshness must be explicit.
- Limit CMS entry to designated Google accounts. Round 2 confirms administrator
  access for all initial accounts; the account list is still a setup input.

### Discovery round 2 confirmed (2026-10-21)

- Merchants can appear as planting locations or supply stations. The intended
  AI capability judges routes and decides which merchants take each role.
  Round 3 below settles per-route roles and real AI in the current delivery.
- Migrate existing mock data into Firebase so the CMS can manage it. This is a
  demonstration scenario; there is no real merchant application/onboarding
  workflow. Round 3 below defines migration coverage and player-state isolation.
- Accept live map/offer updates after publication. Preserve an existing route
  when a station is unpublished, but prevent newly adding unpublished stations.
  Revalidate unclaimed rewards at submission; changed prices/rewards require
  notice and renewed confirmation. Completed transactions retain their original
  settings version. This does not silently reroute an active walk.
- Offers simulate the effect of joining TWQR: a merchant becomes visible as an
  app station and attracts potential visitors. Merchant coupon claiming and
  verification are not required for this slice. Navigation is not evidence of
  an actual visit or purchase. Persist mock catalog redemptions in Firebase for
  demonstration transaction reporting.
- Initial dashboard metrics: active users, route completion rate, merchant
  offer-view-to-navigation funnel, reward redemption rate, and reward cost per
  active user. Round 3 below defines denominators/windows. Show only recorded
  periods and explicitly identify absent measurements and seeded data.
- Reward budgets use NTD per month; cloud/API budgets use the existing USD 500
  project total. Present them separately with 50%, 80%, and 100% alert levels.
  Identify cloud-cost source and update time. Round 3 settles alert channels.
- Retain completion by 2026-11-05 and presentation on 2026-11-09. Designated
  Google accounts initially all have administrator access; defer read-only
  roles. Round 3 promotes real route/station AI into this delivery; additional
  enhancements remain deferred until this operational loop is complete.

### Discovery round 3 confirmed (2026-10-21)

- Real Gemini integration is required in this delivery because Google personnel
  are among the judges and should see actual GCP/Gemini application. A simulated
  AI-only showcase does not meet this requirement. Existing constraints continue:
  select only server-validated configured candidates, retain map-service route
  validation, and fall back to deterministic recommendations on AI failure.
- The CMS sets each merchant's allowed roles. AI chooses a role per route from
  those allowed roles. Existing planted trees keep their location/identity;
  confirmed routes are not automatically reassigned by later AI decisions.
- Migrate merchant, station, offer, species, catalog, and preset-scene mock data
  to Firebase for CMS management. Player inventory, tree progress, and transactions
  remain identity-scoped. Demo uses a separate data scope; resetting it must not
  delete normal-account data.
- Active users are distinct accounts performing at least one core action in the
  selected period. Route completion rate is completed routes divided by departed
  routes. Offer navigation rate is distinct offer viewers who subsequently start
  navigation divided by distinct offer viewers; it measures intent, not visits.
  Redemption rate is distinct redeeming users divided by distinct shop viewers.
  Reward cost per active user is the period's redeemed items' configured costs
  divided by active users. Show outstanding-point estimated cost separately.
  Default to the last seven days with a current-month option; separate Demo and
  normal-account metrics. Zero-denominator/unmeasured cases must not imply success.
- New analytics events follow the existing deletion deadline: seven days after
  the presentation. Preserve the existing test-account and privacy boundaries.
- Alerts are dashboard-only; no email notifications in this slice. Cloud spend
  is initially entered by an administrator from billing records, with source
  and update time visible. Reward costs are derived from Firebase demonstration
  transactions. Automated GCP billing ingestion is deferred.
- Support save-draft, publish, and unpublish. Only publication changes the client;
  online clients with the page open should see changes within a five-second
  target. Show a change summary before publication and record operator, time,
  and version. Previously confirmed active-route/transaction rules still apply.

### Discovery closure and setup inputs

- During implementation the user resolved the discovered double-award conflict:
  harvest credits tree points directly; the shop spends those points on products.
  Mature-tree-to-points exchanges are superseded, not a second reward stream.
  CMS reward pricing therefore uses required tree points per product, not mature
  tree counts. Retain lifetime mature-tree counts as non-spendable statistics.

- On 2026-10-21 the user confirmed shared understanding (Q19), ended discovery,
  and authorized implementation. The user initially requested Angular parity
  with the client, then explicitly permitted CMS Angular 20 if rootNgV2 proves
  difficult on Angular 22.1.4. Internal registry verification found the latest
  rootNgV2 (`cub-lib-view-rootng` 2.2.1) still declares Angular ^20.3.0 peers.
  Use supported Angular 20.3 for CMS under this authorized exception; preserve
  CAT WALK client Angular 22.1.4. Reference CRD's rootNgV2 usage and layout.
- The user designated `mariomario258@gmail.com` as the first CMS administrator
  on 2026-10-21. Provisioning requires a verified Firebase Google identity;
  after the user restored Firebase CLI authentication, `cmsAdmin: true` was
  granted in `cathay-ai-hackathon-team-03` and verified by reading the account
  back. The verified Google identity and existing claims were preserved.
  Sign out and sign in to CMS again to refresh the ID token. This confirms the
  account claim only; deployed CMS/Functions acceptance remains separate.
  The initial monthly reward-budget amount remains a setup input, not a value
  to invent.
- Verify the latest accessible internal UI-kit release and compatible Angular
  version during setup. CRD's adopted version alone does not prove latest.
- Confirmed implementation direction: a separate Angular CMS application using
  supported Angular 20.3 and rootNgV2 2.2.1 under the authorized exception; Firebase Hosting
  delivery; trusted server-side CMS commands and Gemini calls, with secrets
  outside the browser. Preserve the existing client framework version.

## Earlier client decisions

### CMS implementation handoff (2026-10-21)

- CMS source now lives in `cms/`, using Angular 20.3.24, rootNgV2 2.2.1 and
  matching utilities 3.3.0. The client remains on Angular 22.1.4. Setup,
  administrator provisioning, seed import, Gemini IAM and acceptance steps
  are documented in `cms/README.md`.
- Public configuration is versioned separately from administrator drafts and
  identity-scoped player state. Callable commands enforce administrator claims,
  publication revisions, transactional point spending and idempotent retries.
  Published updates are consumed through Firestore listeners. Gemini uses
  Vertex AI with the Functions service identity and constrained candidate IDs.
- The `/shop` route now spends points on products/charity. Harvest directly
  credits points once; mature-tree counts are statistics, not spendable
  entitlements. Legacy entitlement components remain for compatibility with
  existing tests/history but are not the active shop route.
- Mock migration creates a reviewable JSON import, not an automatic cloud
  write. The first admin account is provisioned as recorded above. Monthly reward-budget value, Hosting deployment,
  Vertex API/IAM/model access, and a real cloud happy-path verification remain
  operational setup inputs. Do not describe mocked Vertex tests as live AI use.
- On 2026-10-21 the user reported `cmsDashboard` OPTIONS 404. Cloud inventory
  confirmed all CMS functions were absent. Deployed all ten CMS functions in
  `asia-east1` and Firestore rules; Cloud Scheduler API and the daily cleanup
  job were created. Explicit public model/location values in the project dotenv
  file support non-interactive CLI deployment. Functions build and 29 tests
  passed. Live checks verified OPTIONS 204 with the requested CORS origin and
  unauthenticated POST 401 for all nine callable endpoints. This does not verify
  an authenticated dashboard query, seed publication, or a live Vertex AI call.
  CLI reported a timeout after deployment completion; logs show ten successful
  function deployments, zero errors, and an enabled cleanup job. HTTP endpoints
  were independently verified. Hosting was not deployed in this repair.
- Firebase Hosting artifacts can include CMS at `/cms/` via
  `scripts/prepare-cms-hosting.mjs`; building/preparing does not deploy.
- Existing cultivation-modal tests have 14 failures reproduced with the
  pre-change component/template as well. These are tracked as pre-existing
  modal test-mounting failures, not evidence of a successful full-suite run.

- 2026-10-20 collection grid card action: Enable Ionic card button behavior
  in the grid so clicking or keyboard-activating a card opens the same tree
  preview/navigation modal as map mode. Map popup cards remain non-button cards
  with their existing separate 查看 action.
- 2026-10-20 collection info bar: Match map mode's count and mode controls
  to grid mode's padding, text color, paragraph margins and shape. Only map
  mode floats the bar over the map and adds an 80% light-color background.
- 2026-10-20 collection navigation button placement: Fix 導航到此樹木 at
  the modal bottom, spanning the width with equal 12px side insets and 16px
  bottom spacing (respect device safe areas). Keep pointer events enabled
  inside the scene's non-interactive overlay panel.
- 2026-10-20 collection tree preview navigation: Collection modals hide the
  resource dock/backpack and disable cultivation interactions. Replace the dock
  with 導航到此樹木. Dismiss the modal, navigate to /home and consume a one-time
  tree selection on Home entry, using startPlanning/selectDestination so the
  selected destination and route loading match a Home marker selection. Do not
  confirm the destination or depart automatically. Existing eligibility/location
  checks remain in force. This supersedes allowing direct collection cultivation.
- 2026-10-20 collection card close control: Hide the Mapbox popup's default
  top-right close button. Retain click-on-map dismissal and the 查看 action.
- 2026-10-20 collection selected-tree framing: Position a tapped tree at
  the lower center (80% of map height) to leave room above for its card.
  Apply a camera offset of 30% of the map container height, retaining zoom
  and the bottom-anchored popup. This supersedes geometric centering on tap.
- 2026-10-20 collection popup placement: Anchor the card's bottom to the
  selected tree marker with a 26px offset so the card always opens above it,
  preserving the existing camera centering behavior.
- 2026-10-20 collection map framing: Tapping a tree smoothly centers the
  camera on its coordinates while opening the card, retaining the current zoom.
  Map mode fills all available content below the segment toolbar, with the
  count/view controls floating over it. Use flex sizing rather than a fixed
  height subtraction or minimum map height; disable content scrolling in map
  mode and retain grid scrolling. The shell header and bottom tabs stay visible.
- 2026-10-20 collection tree interaction: Use the Home green circular tree
  marker and cathay-tree-icon.svg in collection, without ripple effects.
  A tap opens the shared grid TreeCardComponent with a 查看 button beneath it.
  查看 or a stationary long press opens HomeCultivateComponent in an independent
  modal, without changing Home walking-session phase. Preserve existing proximity
  and resource rules. Cancel long presses on drag, interruption and marker removal.
- 2026-10-20 Home marker clusters: Extend numbered, click-to-expand clusters
  to Home trees, empty planting spots and currently displayed supply stations.
  Preserve individual marker tap/long-press actions and route visibility.
  Use Mapbox clustering (55px radius, max zoom 18) with DOM number buttons;
  hide clustered individual buttons until they separate. Clicking a cluster
  stops camera following and zooms to its expansion level. User-position and
  route lines are excluded. Dispose cluster markers with the Home map.
- 2026-10-20 collection map: Connect map mode to the same filtered trees as
  the grid, including current cultivation state. Keep the map inside collection
  content and fit its initial bounds to those trees. Dense markers merge into
  orange numbered clusters when zoomed out; clicking a cluster zooms to its
  expansion level. Single trees show name, species, location and status on click.
  Use a dedicated collection map so browsing does not change Home route/camera
  state. Cluster radius 55px and maximum cluster zoom 18 are implementation
  defaults. Long-absence criteria remain unresolved.
- 2026-10-20 collection harvest chip: Use a compact 20px height, 10px text
  and 6px horizontal padding to leave more card width for the tree name.
- 2026-10-20 collection grid sizing: Keep two equal columns across phone
  widths. Allow card names to shrink and truncate with an ellipsis while
  keeping the harvest chip on one line without forcing wider columns.
- 2026-10-20 collection tab icon: Use the solid orange twin-tree SVG when
  /collection is selected; retain the outlined twin-tree SVG otherwise.
- 2026-10-20 collection segment appearance: Follow the supplied reference
  with three equal-width tabs on white, muted gray inactive labels and an
  orange active label with a thin orange underline. Keep the existing labels
  and selection values. Place the segment across the content width below
  the shared header, with padding applied to the tree grid separately.
- 2026-10-20 harvest point result notification guard: Open the result modal
  only for a point increase following a successful user initiated harvest in
  the active cultivation component. Hydrating or switching progress scopes
  must never be treated as newly earned points.
- 2026-10-20 header sizing correction: Use one shared ion-toolbar with a
  common 48px minimum content row for both profile identity and other tab
  titles. Explicitly reset identity-card margin, padding, border, radius,
  shadow and background; the olive color belongs to the toolbar.
- 2026-10-20 profile header alignment update: Use the same toolbar height,
  padding, border and rectangular shape as other tabs. Only the olive
  background and identity content differ. Share a 72px toolbar minimum and
  48px content/button row minimum; use a 44px avatar and 24px name. This
  supersedes the rounded standalone identity-card frame below.
- 2026-10-20 profile identity header appearance: Follow the supplied compact
  reference with a solid dark olive background, large rounded top corners,
  thin dark outline, muted green circular portrait and white display name
  above a subdued traveler ID. Remove the gradient, header level label and
  decorative badge; use a tree emoji when the account has no usable portrait.
  Preserve traveler-ID copying and existing ID values.
- 2026-10-20 profile header: Render the existing identity card in the shared
  shell header on the /profile root, including when query parameters or a
  fragment are present. ProfileIdentityComponent owns account name, portrait
  fallback and traveler-ID copy feedback. Remove the duplicate identity card
  from profile content. Share the existing demo/normal level preview values
  between header and progress card; actual XP rules remain unresolved.
- 2026-10-20 shared header sizing: Preserve the back-button group's layout
  space on tab roots using visibility: hidden rather than removing it with
  @if. Match the height, padding and title position of the visible-button
  header; hidden buttons cannot receive pointer or keyboard focus.
- 2026-10-20 shared header back visibility: Hide the back button on the five
  tab roots (/home, /task, /shop, /collection, /profile); show it on other
  routes where the shared header is present. Ignore query parameters and
  fragments when identifying a tab root.
- 2026-10-20 shared header back action: Navigate to the parent URL path by
  removing the last primary path segment, using NavController.navigateBack
  for the back transition. For example, /shop/history returns to /shop.
  Drop query parameters and fragments. This replaces history-based back
  navigation and the earlier fixed /home fallback.
- 2026-10-20 shared toolbar alignment: Keep the back icon button at the start
  in ion-buttons and center the title across the full toolbar width with
  symmetric title padding. The title must not intercept button clicks.
- 2026-10-20 app shell layout: Stack the shared header and tabs vertically.
  Override ion-tabs' default absolute positioning with relative positioning
  and flex sizing so routed content occupies the remaining space below the
  header. Let Ionic apply the first toolbar's top safe-area inset once.
- 2026-10-20 app shell header: Center the page title and remove the header
  shadow and toolbar border. Use Ionic's ion-no-border class on ion-header;
  the installed Material header stylesheet sets box-shadow directly and does
  not consume a --box-shadow custom property.
- 2026-10-20 production Mapbox worker repair: The preview map failed after
  initial load because Angular production optimization broke the embedded blob
  worker (ReferenceError: s is not defined). Serve mapbox-gl 3.32.0's unmodified
  mapbox-gl-csp-worker.js as assets/mapbox/3.32.0/mapbox-gl-csp-worker.js and use
  an explicit workerClass. Keep the copied worker path aligned with package
  upgrades. Preserve the current token, Standard basemap and optional HD-road
  error handling. Rebuilt and redeployed sprint3-preview; 54 Home map tests
  pass and the deployed map remains visible in headless Chrome. The browser
  regression script is client/scripts/verify-preview-map.cjs; it observes tile
  parsing after initial map load because component mocks miss this build bug.

- 2026-10-20 preview delivery: Update the existing sprint3-preview Firebase
  Hosting channel with the current app and existing local Mapbox public token
  in generated runtime-config.js; never record the token in project memory.
  Build with production,preview configurations: production optimizations remain
  enabled and the preview-only component-style error budget is 16 kB, allowing
  the existing 12.84 kB relay-game stylesheet. Production retains its 12 kB
  component-style error budget. The walking sync fix is confirmed by the user.

- 2026-10-20 walking sync deployment repair: Earlier Cloud Build attempts for
  initializeWalkProgress failed during npm installation ("Exit handler never
  called"). The Functions lockfile contained company-internal npm tarball URLs.
  Use public https://registry.npmjs.org/ tarball URLs for cloud builds while
  retaining locked versions and integrity hashes. For local Firebase CLI access,
  use the company HTTP/HTTPS proxy http://pxoawcg:8080, NO_PROXY localhost,127.0.0.1,
  NODE_USE_ENV_PROXY=1 and NODE_USE_SYSTEM_CA=1. Do not store login credentials.
  Both walking callables were successfully deployed to asia-east1. Their Cloud
  Run services initially had empty IAM policies and returned platform HTTP 403.
  Both now explicitly declare invoker: public, and roles/run.invoker for allUsers
  was applied to these two services via the Cloud Run API because deployment did
  not populate IAM. Firebase request.auth and UID checks remain mandatory inside
  the handlers. Verified both callable endpoints return HTTP 401 UNAUTHENTICATED
  for anonymous requests instead of the earlier 404/403. Actual signed-in client
  loading and saving were confirmed fixed by the user on 2026-10-20.

Last updated: 2026-10-21

- 2026-10-19 Demo map error correction: The Standard basemap's optional
  mapbox.hd-road-v1-bounded source can return HTTP 403. Do not replace the
  entire Home map or detach camera following for that resource error; retain
  the remaining basemap. Other map errors still use the existing failure UI.
  This client correction does not grant access to the rejected Mapbox resource.

- 2026-10-20 login-time initialization: Do not require an Auth-triggered
  `initializeNewUserV2` Function. The existing callable
  `initializeWalkProgress` provisions the idempotent starter seed when a
  normal user first loads cloud progress, using the authenticated Firebase
  UID. This avoids the 2nd-gen Auth trigger IAM/Eventarc deployment path while
  preserving one starter seed per user. The previously deployed 1st-gen
  `initializeNewUser`, if present, is not required by the client flow and is
  not deleted automatically.

- 2026-10-19 local Firebase testing recovery: A normal Firebase identity may
  temporarily fail to load cloud walking progress while callable Functions are
  unavailable. Keep the loading state blocking only during the initial load;
  show a non-blocking error banner after failure so Mapbox and the testing
  joystick remain usable. The banner keeps retry, Demo entry and logout
  actions. This is a local/demo testing fallback and does not replace cloud
  progress synchronization.

- 2026-10-19 identity data separation: The user requested that Demo keep the
  existing mock data while Firebase-authenticated identities persist their own
  daily steps, resources and walking/cultivation progress. Scope progress by
  Firebase UID; reset active routes and pending cultivation timers at identity
  changes. Demo progress remains memory-only and must never write normal user
  documents. Normal accounts start with zero steps/resources except the existing
  idempotent one-seed starter grant. Persist inventory in users/{uid}/inventory/current,
  cultivation and progress in users/{uid}/progress/current, and Taipei-day step/light
  summaries in users/{uid}/dailyProgress/{YYYY-MM-DD}. Use authenticated callable
  Functions and owner-only reads; preserve server task reward balances via inventory
  deltas and reload after task completion. Revision conflicts require an explicit
  cloud reload. These are prototype client-reported progress records, not verified
  health or anti-cheat evidence. The mock joystick is currently retained for
  Firebase-authenticated users to support location testing; this temporary
  testing behavior does not change the identity-scoped persistence rules.
  The user confirmed this increment covers identity isolation and cloud storage
  only. Actual step acquisition is deferred; its eventual source (native pedometer/
  health integration versus GPS estimation) remains unresolved.
  Shared map POIs remain curated fixtures. Shop/collection production integration
  is outside this progress change and remains pending. Deploy the two new callable
  Functions and Firestore read rules before testing against the hosted project.

- 2026-10-19 station photo header: The user requested a photo background in
  the upper station-details area using their supplied image URL. Treat it as
  a decorative cover image behind the title, chips and existing orange
  rotating droplet, with a readability overlay and fade into the pale body.
  Keep rotation and reward eligibility unchanged. The supplied URL is the
  current shared visual; station-specific photography remains unresolved.

- 2026-10-19 supply-station reference design: The user requested a rounded,
  pale station-details panel with a centered title and orange circular hero,
  following the supplied reference. The orange circle is the existing draggable
  rotating droplet, not a separate decoration. Rotation is always available
  while the modal is open, including after claiming and outside reward range
  or an active route. A completed turn requests a reward only when the existing
  route, proximity and daily eligibility conditions pass. Keep interruption
  cleanup and duplicate-reward guards. Use existing merchant and reward data;
  photos, ratings and additional toolbar actions remain unconfirmed.

- 2026-10-19 dense undergrowth correction: The user rejected the short sparse
  grass treatment and supplied a dense meadow/undergrowth reference. Replace
  the wirelike blades with overlapping painted grass clumps, rich green
  undergrowth, height variation and moss on the three large stones. Keep a
  clear planting/root opening. Bake blade detail into one small alpha texture
  and batch static crossed cards in one additional grass draw call; retain
  one opaque turf/stone/flower mesh. No grass animation, shadows or per-blade
  objects. The optional 2D grass sprite uses the matching baked blade plan.
  Dispose grass geometry and texture when leaving the scene. Weeds stay off.

- 2026-10-19 continuous lawn refinement: The user requested a grassy ground
  surface like the supplied meadow reference instead of a few sparse tufts.
  Cover most of the platform with continuous mottled turf and dense short
  grass, retaining a small irregular bare-soil opening around the trunk.
  Reduce rocks to three larger stones. Keep small wildflowers and match the
  2D view. Turf and decorations share the existing single scenery mesh, with
  no grass animation or interaction; weeds remain disabled.

- 2026-10-19 ground scenery and paused weeds: Temporarily disable removable
  weeds and their nutrient-absorption penalty, including weed recommendations
  and clearing notifications. Keep the implementation and mock seed data for
  later restoration with TREE_WEEDS_ENABLED in environment-dev.ts (false).
  Decorate the soil with a few static pebbles, small wildflowers and grass
  tufts in the existing botanical style, including the optional 2D view.
  Decorative grass is scenery and cannot be pulled or cause a penalty. Keep
  the trunk/root area clear. Merge 3D decoration geometry into one static mesh
  to limit draw calls; retain the existing soil/watering/fertilizer behavior.

- 2026-10-19 explicit tree rendering preference: Default to 3D and show a
  loading message without a 2D tree until the first successful visible frame.
  A 3D initialization/render/context failure must ask whether to switch to 2D;
  only user acceptance enables that scene's fallback. Offer a 3D retry as the
  alternative. Never persist failure acceptance as a display preference.
  TreeDisplayService exposes readonly mode() and setMode('3d' | '2d') for a
  future settings page, saved locally on the device and applied immediately.
  Explicit 2D selection avoids loading WebGL. Reduced motion keeps the chosen
  renderer and suppresses animation rather than silently choosing 2D. Switching
  modes or destroying a scene must discard pending loads and release WebGL.
  This supersedes the automatic 2D preview/reduced-motion fallback below.

- 2026-10-19 constant tree brightness: The user requested the 3D tree remain
  as bright as the 2D preview, without deliberate darkening. Use consistent
  daylight model lighting for every weather/time background; remove the
  previous environment-dependent dimming and tint. Retain the temporary
  light-resource highlight. This supersedes matching tree lighting to each
  background's time and weather below.

- 2026-10-19 modal tree handoff: The user requested matching the immediately
  visible 2D tree preview to the 3D model's size to prevent a visual jump when
  opening a modal. Share camera framing across both renderers, anchor roots at
  the same projected position, fit tree height to its growth scale, and match
  the soil footprint. Keep framing responsive to modal resizing; watering,
  fertilizer and weed coordinates must follow the same projection. Preserve
  the existing 3D appearance and immediate 2D/reduced-motion fallback.

- 2026-10-19 illustrated scene backgrounds: The user requested twelve actual
  background images combining 晴天 / 雨天 / 陰天 with 清晨 / 白日 / 黃昏 / 夜晚,
  matching the supplied softly painted meadow, distant hills, village and
  dimensional-cloud reference. This replaces the dark studio backdrop while
  retaining the approved botanical tree style and interactions. Keep the same
  landscape composition across variants and match tree lighting to each scene.
  Produce a rendered overview image, like the earlier tree-model preview.
  All eighteen existing mock POIs (ten trees, three empty planting points and
  five supply stations) have fixed randomized weather/time parameters. Seed
  20261019 distributes the four periods within each existing tree-weather group;
  the thirteen tree/planting POIs expose all twelve combinations. Reopening a
  POI or reloading must preserve its scene; these are Demo parameters, not live
  weather or the current clock. Keep resource, growth, watering and reward
  rules unchanged. Use compressed images and load only the selected background.

- 2026-10-19 fruiting and shake refinement: In the final stage, replace the
  flowers with 小樹點 icons at the same positions; do not use fruit models.
  Harvested points scatter, bounce and roll independently on the soil before
  fading rather than forming a tidy ground arrangement. Keep the existing
  harvest payout amount and deadline. Reduce crown motion to a subtle sway
  and emit a small, bounded number of falling leaves during shaking and stage
  emergence. The trunk remains fixed. Reduced motion suppresses leaf scatter.
  The initial sway cap is 1.6 degrees; this is an implementation tuning value.

- 2026-10-19 eight-stage tree lifecycle: The user confirmed eight visuals and
  their harvest-target ratios: 種子 0%, 幼苗 10%, 小樹苗 16%, 大樹苗 23%,
  小樹 30%, 大樹 60%, 開花 85%, 結果 100%. Keep the current botanical style
  and large-tree silhouette. Early plants must have distinct shoots, slender
  stems, sparse leaves and progressively more branches, as in the reference.
  Every credited growth update gradually increases absolute model size within
  its stage; remove the previous whole-tree shrink/grow celebration. From 小樹
  onward, entering a stage reveals foliage, flowers or fruit with a short
  spring-like crown motion while the trunk stays fixed. Size remains bounded
  at the fruiting-stage limit for growth beyond 100%. Harvest eligibility,
  rewards, recovery and weed pulling remain unchanged. These thresholds replace
  the previous five-stage visuals and mature-stage size cap.

- 2026-10-19 seedling, crown motion and weed pulling: Match seeds and seedlings
  to the approved botanical tree style. Sway the crown while keeping the trunk
  and roots fixed, including during harvest. Replace click-to-remove weeds with
  an upward drag and visible uprooting; taps, incomplete pulls and interrupted
  gestures do not remove weeds. After the last weed is successfully removed,
  show the existing centered toast with `已清除雜草，恢復養分吸收率。`.
  Preserve the existing persistent weed penalty until every weed is removed.
  A 32 CSS-pixel upward pull, a short 220 ms release animation, and ArrowUp as
  the keyboard equivalent are implementation defaults, not confirmed product
  thresholds. Reduced motion skips the release animation.

- 2026-10-19 tree-scene refinement: The user approved the leaf style and
  requested more natural trunks plus matching soil, background, and weeds.
  Keep the existing leaf treatment; use organically curved, tapered branching
  and a consistent botanical treatment throughout the scene. Soil water-state
  feedback, individually removable weeds, cultivation, and shaking/harvesting remain intact.

- 2026-10-19 tree-scene visual direction: The user requested trees and a
  background resembling the supplied botanical reference: slender branching
  trunks, irregular airy crowns with small yellow-green leaves and blue-green
  shaded foliage, against a dark blue-gray backdrop. Favor modest geometry and
  device performance over fine model detail. The model manipulation required
  is swaying/shaking; no rotation, zoom, or more elaborate model controls are
  requested. Existing cultivation and harvest behavior remains applicable.
  Visual acceptance and actual mobile performance remain to be verified.

- 2026-10-16 harvest recovery: Each planted cycle can be harvested once. The
  24-hour recovery clock starts when fruit lands and points are credited. Until
  recovery, show a gray `arrow-redo` Ionicon marker and keep the harvested tree
  inspectable; its open cultivation modal displays a persistent toast with
  whole hours remaining. The toast uses the centered dark interaction-warning
  style and stays below the harvest-result modal. At 24 hours, clear that site
  into an empty planting point that can be selected and replanted. Keep
  previously credited points and same-day destination-completion tracking
  unchanged.

- 2026-10-16 cultivation soil appearance: Empty planting points use the same
  soil platform as trees when 3D is available, without showing a seed/tree
  until planted. Rain displays an empty point's platform in the watered color
  but does not change the saved watering state.

- 2026-10-16 two-stage route planning: The user confirmed selecting a candidate
  tree or empty planting point first, then pressing `確定此終點` in the upper
  destination card to lock it without departing. Only after locking can other
  eligible trees, empty points and supply stations be added/removed as
  intermediate stops using explicit map-popup actions. In planning, a short
  marker tap only selects an eligible candidate destination before the lock;
  after locking, short taps on tree or empty-point markers do not open details
  or change route stops. A 500 ms long press opens tree details. For supply
  stations, a short tap opens the route-options popup and a 500 ms long press
  opens the station-details modal; the generated click is suppressed. Outside
  planning, existing marker click behavior stays unchanged. Updating the
  preview requests one continuous route through both kinds of stops, ordered
  along the original route; departure still requires the existing route confirmation.
  Changing a locked destination requires returning and starting a new plan.
  Trees in their 24-hour post-harvest recovery and points already completed as
  destinations today remain view-only and cannot be new intermediate stops;
  recheck eligibility before departure and allow removing selected points
  that become ineligible. Recovered sites become empty planting points.
  Tree stops are separate from reward-granting supply stations and retain
  ordinary optional cultivation/planting; no new rewards or mandatory
  intermediate check-ins are introduced.
  Active routes now retain the destination, selected tree/empty-point stops
  and selected stations, hiding unrelated trees. Reset all draft selections
  and the destination lock when restarting/cancelling planning. Candidate
  route/station data can preload, but station markers/actions are gated until
  destination confirmation. Recommendation popups remain suppressed after
  any candidate selection.

- 2026-10-16 backpack and empty planting points: The user requested replacing
  the cultivation fertilizer dock button with a backpack picker containing
  fertilizer and seeds. Fertilizer keeps its existing 24-hour, +20% effect
  and per-tree daily activation guard. A seed can only be used at an empty
  planting point; spend one seed and turn that point into a planted seed
  with zero growth, then enable ordinary care. Keep the existing starter
  seed quantity of one and the inclusive 500 m interaction restriction.
  Add three curated Demo empty points around Banqiao; show soil-yellow
  circular markers with the same selection and ripple treatment. Empty
  points can be walking destinations. Planting, growth and inventory use
  the same session-local Demo state as existing tree care.
- 2026-10-16 destination eligibility: Exclude trees still within the 24-hour
  post-harvest recovery period and points already checked in as a walk destination today from both recommendation
  filling and route selection/confirmation. Track completed destinations
  per Asia/Taipei day, independently of route state, so starting/cancelling
  another plan does not erase eligibility. Cancellation alone does not
  consume a destination. At 24 hours after harvest payout, clear the tree to
  an empty planting point; a new seed starts a new harvest cycle. This is not
  natural tree regrowth.
  Ineligible markers remain visible in a faded treatment and can open their
  cultivation/status modal even while planning. Closing that modal restores
  the same plan and camera; in-flight route responses can still finish while
  inspecting. Active routes retain only their selected tree/empty-point markers.
  The requested Home seed action is direct backpack use at the point; this
  does not add a new photo flow or change the separately documented backend
  planting-task contract.

- 2026-10-16 recommendation reasons: The user confirmed one reason per tree
  and this ranking priority within the existing 8,000-step group:
  `可收成` > `即將收成` > `缺水了` > `附近雜草叢生` > `即將進入新階段`.
  Prefix the reason with `種子` below 10%, `樹苗` from 10% to below 30%,
  `小樹` from 30% to below 60%, and `大樹` from 60% onward, using the same
  configurable-target thresholds as cultivation. `即將收成` starts at 90%
  and ends at 100%; at 100% use `大樹可收成`. Near-next-stage means remaining
  growth to the next stage is at most 5% of the harvest target. Use existing
  dry-state timing (strictly over seven days since watering or creation) and
  the configured weed-count threshold (currently ten), not the persistent
  weed-debuff flag. Harvested trees have no actionable reason. Trees without
  reasons still fill remaining slots using the original harvest/growth/distance
  ordering; farther-than-8,000-step fallback retains nearest-first ordering.
  Popup reasons use per-tree live growth, weeds and watering timestamps instead
  of a single placeholder. Refresh time-dependent planning reasons each minute
  while no destination is selected; stop the clock on selection or leaving
  planning. Keep map camera and popup visibility behavior unchanged.

- 2026-10-16 active-route tree visibility: Once a route is confirmed, show
  its destination and selected intermediate tree markers; hide unrelated trees. Keep the
  selected supply-station markers unchanged. The destination still opens care,
  and other trees stay hidden while care is open or the active route is
  arrived. Restore all trees when the route ends or is cancelled. Planning,
  including choosing/changing a destination before confirmation, still shows
  all tree markers. Use active-route state rather than the walking phase.

- 2026-10-16 recommendation-visibility follow-up: Add a planning button to
  toggle recommendation information without hiding tree markers. Start each
  new plan with the three recommendation popups visible. As soon as any tree
  is selected as the destination, remove all recommendation popups and hide
  the toggle for that selection; station popups remain available. Reopening
  recommendations must not override a selected destination or refit the map.

- 2026-10-16 tree-map planning: The user confirmed green circular tree
  markers matching supply-station styling, with white tree silhouettes,
  ripples before selection, and a check badge/double outline when selected.
  In planning, automatically show exactly the three highest-ranked existing
  recommendations as simultaneous compact map popups. Their contents are
  nickname/species, place, estimated walking steps, and growth remaining/status;
  do not add weather. Other trees remain selectable by marker without a popup.
  Clicking a recommendation card also selects that destination. On entering
  planning, fit the player and all three recommended tree positions between
  the planning panels rather than using a fixed zoom. Reserve card clearance
  and choose popup anchors to reduce edge clipping and overlap. Leaving
  planning removes recommendation popups; idle/active-route tree clicks still
  open cultivation. Ranking uses current session tree growth/harvest state.

- 2026-10-16 popup-fit follow-up: The user reported oversized station popups
  extending offscreen. Use a compact 260px-wide card capped at 300px and at the
  actual gap between planning panels. Keep route action buttons outside the
  scrollable details. After rendering, automatically pan only enough to keep
  the complete popup inside the visible map area with 12px margins; preserve
  zoom/bearing and refit on viewport/content resizing. No manual map movement
  is required to reveal the popup.

- 2026-10-16: Planning supply-station details now open as a map-anchored
  Mapbox popup when clicking a loaded station marker, replacing the bottom
  sheet. Preserve merchant/category badges, offers, Demo terms, expiry,
  current-location distance, extra minutes, and configured resource rewards.
  Only the explicit `加入路線` / `移出路線` action changes selection; closing
  or clicking elsewhere leaves it unchanged. Switching stations replaces the
  popup, and invalidated routes or leaving planning close it. Station changes
  still require `更新預覽路線`. Active-walk station check-in retains its modal.
  No station photos or ratings are invented; existing seeded details are used.

- 2026-10-16: The cultivation modal's status chips use compact height and reduced
  horizontal padding to leave room for readable text and icons, with three chips
  per row on mobile. Their backgrounds are transparent, while the text and icons
  retain the Ionic status shade. This styling is local to the cultivation status
  row and does not change chips elsewhere.
- 2026-10-16: Supply-station success, access, and error feedback uses the same
  transient centered toast treatment as tree-cultivation interaction feedback,
  rather than inline status text.

## Status

Discovery rounds 1 through 11 are resolved using the repository-local `grill-me` / `grilling` workflow. The user confirmed shared understanding and ended grilling on 2026-09-03. Product specification, system design, capacity plan, estimates, and Azure Boards import artifacts have been generated under `docs/`.

## Product intent

CAT WALK is a standalone, public-facing walking app inspired by the motivational loop of Pikmin Bloom. It should encourage office workers to walk farther after work by turning activity into visible tree growth and rewards.

`CAT` is the company's standard three-character project prefix, derived from Cathay. It does not mean that the product has a cat theme. The relevant company image is a large tree, so planting and growing trees is the intended product metaphor.

`CAT-WALK` is an internal project code, not the intended public product name. The working Demo name is `Cathay Walk | 國泰健康走`. If the group adopts the Demo, internal brand and legal owners will make the final naming decision.

Public-name research found no exact public product with either proposed name, but it did find material collision risk:

- `Cathay Walk` is high risk because Cathay previously operated `Cathay Walker` and `Cathay Walker Plus`, later integrated or renamed as FitBack. The earlier concept also combined steps, rewards, and physical check-in points.
- `Cathay Go` has moderate risk: no exact product collision was found, but `Go` is generic, weakly communicates walking/tree growth, and appears in other Cathay product or event language.
- Current working Demo name is `Cathay Walk | 國泰健康走`.
- This research is not a legal trademark clearance. Brand/legal should check Taiwan trademark classes and internal product registries before any public launch.

The Pikmin Bloom inspiration describes the desired motivational pattern, not permission to copy its protected characters, artwork, names, mechanics, or exact presentation.

The company group already offers a related feature called `健康吧` inside the Cathay Life app. That feature is primarily for existing Cathay Life users and scores passive health signals such as steps, average heart rate, and sleep quality. CAT WALK must remain differentiated: it is open to the general public, centers on active walking experiences and game-like objectives, builds general brand awareness, and introduces more people to the group's `小樹點` reward concept.

## Confirmed constraints

- Development window: 2026-09-03 through 2026-11-05.
- Final presentation: 2026-11-09 at Google's Banqiao office.
- Goal: demonstrate the main product idea as completely and convincingly as possible by the end of the window.
- Primary audience: management or an internal product team. The demo should communicate a coherent product story and business potential.
- Primary user: office workers who need an incentive to walk farther after work.
- Product boundary: a standalone concept for the general public, not an employee-only tool and not a subfeature restricted to existing insurance-app users.
- Intended business value: strengthen public familiarity with the Cathay brand and broaden awareness and usage of `小樹點`.
- The demo may represent `小樹點` with mock balances and transactions; no production loyalty integration is required.
- Support two activity modes in the intended experience:
  - Active walk: the user deliberately starts a walk and receives a route or objective shaped like a game task.
  - Passive activity: the Android app reads background step totals for users who do not want an explicitly game-like session.
- The active-walk concept uses smart route recommendations and pickup-and-delivery-style objectives. Generative AI is not required by the event; rules-based recommendations are Must, while a Gemini enhancement is Should because the demo takes place at a Google office.
- All unique daily steps contribute once to tree growth. Active-task steps remain part of that daily total rather than being counted twice.
- Completing an active task grants an additional task reward. Reaching a passive daily-step goal grants a smaller reward.
- A mature tree becomes part of the user's personal forest and remains associated with the place where it was planted. Returning to that place should evoke a memory and sense of accomplishment.
- A location-associated tree stores a Place ID, landmark name, and obfuscated coordinate rather than publicly exposing an exact GPS point. The personal forest is private by default.
- Trees are persistent rather than consumed on maturity or harvest. A tree can continue growing into a larger representation of the Cathay tree identity across repeated growth milestones.
- A user may own and cultivate several planted trees at the same time.
- Walking earns an unallocated, tree-themed growth resource rather than immediately growing one designated tree. The resource's final name remains open.
- To invest accumulated resources, the user returns near a planted tree and chooses how much to allocate. The user can concentrate resources on one tree or distribute them across several trees.
- Frontend tree visual thresholds depend on `TREE_GROWTH_PER_HARVEST` in `client/src/environments/environment-dev.ts`: 種子 below 10%, 幼苗 at 10%, 小樹苗 at 16%, 大樹苗 at 23%, 小樹 at 30%, 大樹 at 60%, 開花 at 85%, and 結果 at 100%. These are the eight thresholds confirmed on 2026-10-19; development targets can be changed without separately editing model stages.
- Every cumulative 5,000 growth value enables a 50 `小樹點` harvest without removing or resetting the tree. Later milestones are 10,000, 15,000, 20,000, and so on.
- Tree model size grows smoothly with credited growth and is capped at the fruiting-stage size in WebGL and SVG. Growth beyond 100% does not enlarge it. The 2026-10-19 growth rule supersedes the earlier mature-stage cap and whole-tree shrinking celebration.
- Each account can trigger at most one `小樹點` tree harvest per day in the Demo.
- The intended product lets invited friends contribute resources to collaborative visual growth, decoration, or resident animals. Friend contributions do not count toward the owner's monetary-value `小樹點` harvest.
- The Demo represents one friend contribution with seeded data rather than implementing real invitations, friend search, or resource transfer.
- Revisiting a planted tree shows its date, photo, steps, and task memory, and may award a seasonal badge or collectible leaf. Revisits do not repeatedly award `小樹點`.
- A place or route is not consumed after one planting. The same landmark can host multiple persistent historical trees, grouped under one private memory-grove marker rather than overlapping map pins.
- The same route can be replayed, but only its first eligible completion per day grants a task reward. New places, seasons, and tree species grant collection rewards rather than exclusive access.
- Planting a new tree requires a seed plus an active planting task and photo check-in at a curated public point. A new user receives one starter seed; later seeds come from weekly goals, achievements, or special delivery tasks.
- The Demo only permits planting at its six curated public task points. Home and work remain private route anchors rather than planting locations. Arbitrary Google Places require a future curation or validation policy.
- A user can own any number of historical trees. The home dashboard pins at most three followed trees; arriving at a memory grove lets the user choose any tree there for resource allocation.
- The mock reward experience includes a `小樹點` balance, a small redemption catalog, and an ESG-style tree-donation option.
- Reward economics must remain credible against the existing Cathay Life `健康吧` reference supplied by the product owner:
  - 5,000 daily steps yield 30 non-cash activity points.
  - 7,500 daily steps yield 50 non-cash activity points in total.
  - 5,000 activity points convert to 50 `小樹點`.
  - One `小樹點` can offset one New Taiwan dollar at supported merchants.
- CAT WALK must not issue tens of `小樹點` directly for one ordinary walk. Steps grant `光能`; the documented water, fertilizer, 5,000-growth harvest, and mock catalog amounts are the Demo baseline. Only final resource naming remains open.
- The current resource family is:
  - `光能` (working name): the common step-generated resource. On 2026-10-14 the user confirmed one eligible step produces one `光能`, capped at 7,500 `光能` per Asia/Taipei day; 150 `光能` produces one base tree-growth value. Thus 7,500 eligible steps produce 50 base growth. This supersedes the earlier 30/50-per-day light denomination and 1:1 light/growth rule; task value remains the economic reference rather than another name for light. Steps above the cap remain visible but earn no extra light. Step credits are incremental and cannot be claimed again after spending.
  - `水滴`: acquired by reaching and checking in at a designated public water-source task point. Each eligible source grants one per day. On 2026-10-14 the user confirmed one `水滴` equals the growth effectiveness of 10 `光能`: 15 drops provide one base growth, superseding the earlier 10-growth-per-drop rule.
  - `肥料`: acquired from a pickup-and-delivery task. Activation grants a 20% bonus to all light-energy and water allocations for the following 24 hours, limited to once per tree per `Asia/Taipei` calendar day. An active effect cannot be reactivated or stacked. This duration rule was confirmed on 2026-10-14 and supersedes the original single-allocation bonus.
  - Special items: may alter appearance or attract an animal. The Demo only considers one optional `鳥巢` item and does not implement a real pest, defense, treatment, or death system.
- Google Weather API is available in Taiwan and can report daytime, conditions, precipitation probability, cloud cover, UV, sunrise, and sunset. Weather may alter visual flavor or resource storytelling, but it does not change expected economic value by weather or time of day because the target users often walk after work.
- If weather is represented, a failure never reduces the base walking reward and Demo Mode can select sunny, rainy, cloudy, or night presentation states.
- All Demo resources persist without expiry or inventory caps. Long-term production caps and inflation controls are deferred until real usage and liability data exist.
- Daily valid steps use the maximum eligible cumulative total reported across real sources rather than summing sources. Each source only accepts a monotonically increasing total for the `Asia/Taipei` calendar day.
- Web simulation is only available in Demo Mode. Every simulated step, resource, tree, ledger entry, and leaderboard record is marked `isDemo=true` and never merges with normal data.
- A task check-in occurs at a designated waypoint and uses a photo to represent pickup, delivery, or arrival. AI image-content validation is not required.
- Active tasks support both a one-way trip and a return-to-origin trip, with one pickup-to-delivery objective per task.
- Users may configure home and work anchors so recommended routes remain close to their familiar commute corridor rather than leading them far away. Exact coordinates remain device-local and are only transmitted transiently to `recommendRoute`; they are not persisted or logged.
- Exact home/work coordinates remain device-local. A route request may transmit them temporarily to `recommendRoute`, but the service does not persist them. Firestore stores only non-sensitive preferences, obfuscated areas, and task results. A user setting up another device must configure the anchors again.
- Route planning uses the current position and the user's next commute destination rather than requiring the entire home-to-work journey to be walked. The user selects an acceptable extra walking duration, and the recommendation applies a bounded geographic detour from the normal commute direction.
- Normal mode can use GPS proximity for arrival, while Demo Mode always provides a simulated-arrival fallback.
- Resource investment and `小樹點` harvest require the user to be within approximately 150 meters of the tree. Demo Mode can simulate proximity.
- The Home nurture interaction was updated on 2026-10-14 to a larger tree scene with directly held resources. Drag a sun or watering can into the indicated care range to continuously feed while held inside; leaving the range or releasing stops feeding. Light and water each have an adjustable, positive integer per-second rate (initially 100 light energy and 1 water drop per second). Fertilizer activates on release inside the range. Successful feeding immediately spends integer-valued resources and cannot be undone; unsuccessful drops spend nothing. The earlier slider/toggle confirmation interface is superseded for this Home interaction.
- Crossing a growth milestone reveals an immediate harvest action while the user is near the tree.
- A user who cannot physically return may remotely allocate resources. Crossing one milestone marks that tree as the account's single `harvestReady` tree until the user returns; remote care cannot collect the `小樹點`.
- The system does not create a queue of multiple unclaimed reward milestones. An account can have at most one `harvestReady` milestone globally. Before `nurtureTree` commits, it checks that no existing ready milestone or daily harvest limit would make the new milestone unclaimable.
- If the account has no ready milestone and has not harvested today, an allocation may cross at most one new 5,000-growth milestone. If it has already harvested, an allocation cannot cross another milestone until the next `Asia/Taipei` day.
- An invalid allocation is rejected atomically without spending resources. The preview displays the maximum permitted base allocation after water and fertilizer effects so the user can reduce the amount.
- The core experience remains individually usable. A weekly leaderboard and one friend contribution use seeded data. Real friend invitations, search, relationships, and resource transfers are out of scope.
- Minimum interactive delivery: the product must be demonstrable through a web browser with simulated walking progress.
- Preferred delivery: also demonstrate the product on a real Android phone.
- Video is an acceptable event fallback, but it is not the target implementation.
- A photo check-in experience is desired to make walking more playful and goal-oriented.
- Backend responsibilities use the confirmed Firebase/GCP serverless architecture documented below.
- Production integrations are not required for the demo.
- Real payment processing and real production data are explicitly out of scope unless later promoted by a confirmed decision.
- Mocked, seeded, or simulated services and data are acceptable.
- Work planning will use Azure Boards.
- Planning must define Epics, Features, and estimated effort.
- After scope is confirmed, create an Azure Boards import artifact rather than requiring manual work-item entry where practical.
- Product, technical, delivery, and project-management decisions must be recorded in Markdown in this repository.
- The user interface only needs Traditional Chinese for this demo.
- Official company brand assets and resources may be used because the initial demo is internal.
- Live GCP services are the primary runtime, with a seeded local Demo Mode and a prerecorded video as presentation fallbacks.
- The default presentation script is five minutes, with a shorter two-minute version and a prerecorded full-flow fallback.

## Task taxonomy

- Planting task: consume one seed, follow a route to a curated public planting point, and take a photo to create a tree.
- Water task: follow a route to a curated public virtual water station and take a photo; the first eligible visit per source per day grants one `水滴`.
- Nutrient-delivery task: automatically collect virtual fertilizer at the pickup checkpoint, deliver it to the destination or grove, and take one delivery photo; the first eligible completion per day grants one `肥料`.
- Each curated Demo area has one task of each type.
- Pickup checkpoints do not require a photo; planting, water, and delivery completion do.

## Repository facts

- The existing client is an Ionic 9 and Angular 22 application using TypeScript 6.
- The client uses NgRx Signal Store 22 and the exact pre-release `@angular/fire@21.0.0-rc.0`, which brings Firebase JS SDK 12. AngularFire 21 RC still declares Angular 21-only peer dependencies, so client-level npm installs use `legacy-peer-deps=true`; remove this compatibility setting once AngularFire publishes Angular 22 support.
- The installed Angular 22.1.4 exposes the `@Service()` decorator with automatic provision enabled by default. Use `@Service()` for new project services and repositories; `@Injectable()` remains supported when its explicit provider metadata is needed.
- The client uses Capacitor 8.5.1 for native-device integration, pinned consistently across core, CLI, and Android. Its application ID is `com.cathay.catwalk`, display name is `Cathay Walk`, and Angular web assets are read from `dist/client/browser`.
- The repository currently has no configured Git remote and no visible commit history.
- The Matt Pocock skill collection is stored at `skills-main/` as ordinary, currently untracked repository files. It is not a nested Git repository and can be committed with this project.
- Root `AGENTS.md` points agents to the repository-local skills so teammates can use the same checked-in workflow after cloning.

## Client terminology and code naming

- On 2026-10-15 the user merged destination selection and optional supply-station selection into one planning screen, removing the separate destination-confirmation step. After choosing a destination, its loaded stations can be toggled immediately and the destination can still be changed; changing it resets the previous route and station selections. In the follow-up, the user required a separate `更新預覽路線` action before confirmation whenever stations change: update the visible continuous route and distance first, remain in planning for review, and only then enable `確認路線` to return to the active-route idle-style dashboard. Confirmation never silently updates a stale preview. Routing failure keeps planning open with an explicit retry, and Back cancels the whole plan.
- On 2026-10-15 the user confirmed that completing destination/supply-station planning returns Home to the idle-style resources and daily-step interface while retaining the active route, destination, and selected stations. The departure button becomes `終止本次路線`: hold for one second to open the shared confirmation dialog, then explicitly confirm before clearing the route. Short clicks, interrupted holds, and dialog cancellation preserve it. The active-route dashboard also retains the idle-style navigation tabs.
- On 2026-10-15 the user confirmed that idle and active-route tree clicks open the clicked tree's modal regardless of distance or missing location. Viewing is unrestricted; feeding, fertilizer activation, and harvest require a valid location within the inclusive `TREE_CULTIVATION_RADIUS_METERS` (currently 500 metres). Moving out of range stops spending immediately but leaves the modal open for viewing. Moving back enables care again. Opening/closing care preserves the active route and returns to the prior walking/arrived state. This supersedes the earlier out-of-range modal-opening restriction and automatic-close behavior.
- In the 2026-10-15 interaction-feedback follow-up, the user replaced the persistent tree proximity alert with an action-triggered warning toast: `請靠近一點再進行互動`. Remote resource buttons remain clickable to show the warning without spending resources; remote supply-station claim attempts show the same toast without awarding supplies. Mature/large trees retain their existing sway animation remotely, with one warning per shake gesture and no falling fruit or earned tree points. Nearby care and harvest behavior remain unchanged.
- On 2026-10-16 the user confirmed that the shared proximity warning toast appears vertically centered in the viewport (`position: 'middle'`), rather than at the bottom; its message, duration, and interaction restrictions remain unchanged.
- Home-map extra checkpoints are presented uniformly as `補給站`, without water/fertilizer-specific icons or labels. In the 2026-10-15 follow-up, the user changed unselected stations to the same reference orange used by selected stations, retaining the white droplet and continuously expanding ripples. For selected stations, the user chose white/deep-orange double outlines plus a top-right check badge, keeping the orange circle and white droplet with no ripple animation. Planning and walking summaries use `補給站` as well; underlying task kinds and resource rewards are unchanged.
- On 2026-10-15 the user requested station-specific merchant details and a bottom sheet matching the supplied design. Each of the six route-generated Demo stations carries a store name, food/shopping category, Cathay TWQR merchant flag, featured offer, terms, and expiry. Clicking a loaded planning station only opens its details; only `加入路線` confirmation adds it. Cancel, backdrop, and swipe dismissal preserve selection. Already-selected stations retain removal through an explicit `移出路線` confirmation. Merchant/offer data is seeded Demo fiction, not verified live merchant offers; distance uses current location and approximate added minutes use 100 steps/minute with routed extra steps. Station changes still require `更新預覽路線` before route confirmation. A stale station sheet cannot change a replaced destination or task.
- In the station-sheet follow-up, the user requested category (`美食` / `購物`) and TWQR merchant status as badges beside the title. Use the user-provided transparent TWQR logo in the merchant badge with `特店`, rather than redrawing it; omit that badge for non-partner stores. Keep the Demo disclaimer in the offer terms. The user will verify the visual result and requested no further browser validation.
- The user subsequently requested a vector SVG based on the supplied TWQR image. The title badge now uses `client/public/images/assets/twqr-logo.svg`, with transparent background, vector paths, and sampled reference colors (pink `#e74e95`, blue `#008bba`). This Demo reconstruction is not an official brand-master asset and supersedes the earlier PNG-only choice.
- Station title badges keep their contents on a single line without shrinking the TWQR logo. On narrow layouts, the whole badge may wrap to the next line, but the logo and `特店` must stay together.
- The TWQR image and `特店` share an explicit inline-flex content wrapper inside the shared badge's projected text span. Host-level `white-space: nowrap` alone cannot prevent a block-level image from placing the text on a separate line.
- The user confirmed moving only the supply-station test data, not the tree metadata, into `client/src/environments/environment-dev.ts`. `demoSupplyStations` is the single typed list for station IDs, store/offer details, task kinds, route anchor fractions, and initial extra-step estimates. The task generator consumes it directly; existing station identities, default placement, rewards, and route-confirmation behavior remain unchanged. Loaded Mapbox road-distance estimates still replace the initial simulated step values.
- The user requested station-sheet height that follows its contents, avoiding excess blank space and clipping. Station calls use `ModalService.open(content, 'auto')`, with natural CSS height, `[0, 1]` sheet breakpoints, an 80dvh maximum constrained by the top safe area, bottom safe-area padding, and a scrollable `.ion-content-scroll-host` for long content. CSS naturally reflows on content/viewport changes without measuring in JavaScript. Existing numeric-breakpoint calls and tree-profile sheets retain fixed sizing.
- Use `Collection` instead of `Forest` for the client feature, route-level page, Signal Store, repository, and related implementation names. The existing client route is `/collection`; future names should therefore use forms such as `CollectionStore` and `CollectionRepository` rather than `ForestStore` and `ForestRepository`.
- Use `Task` consistently across the client, Cloud Functions, Firestore paths, seed data, tests, and documentation. The client route remains `/task`; implementation names use forms such as `TaskStore` and `TaskRepository`.
- The Traditional Chinese product language may continue to use `森林` and `任務`, and the underlying concepts remain a personal forest and active walking tasks.
- Trusted-command and persisted-data contracts use `completeTask`, `taskId`, `taskCompletions`, and `tasks/{taskId}`. Do not introduce new identifiers containing the deprecated English term.

## Team

- Three Java full-stack engineers, each with approximately one year of experience.
  - From 2026-09-03 through September: one is below 30% allocation; two are approximately 40–60% allocated.
  - From October onward: all three are below 30% allocation.
- One .NET full-stack engineer, also acting as product owner and primary UI implementer, with approximately one year of experience.
- The .NET full-stack engineer is allocated above 80%.
- The .NET full-stack engineer will host and coordinate backend work, work alongside the Java engineers, and remain the primary technical and product owner. The Java engineers are supporting contributors rather than autonomous feature owners.
- One operations colleague responsible for GCP service requests and integration support.
- The operations colleague is allocated above 80%.
- One UI/UX designer with approximately ten years of experience, participating as an advisor rather than the primary implementer.
- Individual allocation percentages and planned absences are not yet confirmed.
- The capacity plan must not treat the four developers as four full-time engineers. The approved planning artifacts use A=80%, B=50%, C=25% and a 75% delivery factor, yielding approximately 55.6 committed developer-days before known leave.
- Planning must account for the concentration risk created by one person owning product decisions, Angular/Ionic conventions, UI implementation, integration, and backend coordination.

## Delivery priority

### Must

- A browser-based app can simulate walking and complete the core reward loop.
- The browser experience can complete the photo check-in flow through a camera or existing image selection.

### Should

- The Ionic app can be installed and run on a real Android phone.
- Android can invoke the native camera.

### Could

- Android reads real steps through Health Connect or a device sensor.
- Android uses real GPS movement as part of an active walking task.
- A bounded Three.js tree showcase passes its technical spike and is included as a visual enhancement.

### Fallback

- Seeded local Demo Mode can complete the presentation without GCP connectivity.
- A prerecorded end-to-end demonstration video is available for the event.

## Final scope priority

### Must

- Web Google Sign-In and progressive onboarding.
- Dashboard, multiple trees, and the three-resource inventory.
- Web-only Demo step simulation.
- Six curated planting points and planting/water/nutrient-delivery tasks.
- Deterministic route recommendation, map, and safety warning.
- Photo check-in.
- Resource allocation, persistent tree growth, milestone harvest, wallet, mock redemption, and ESG donation.
- Private memory groves.
- Firebase Hosting/Auth/Firestore/Storage, five trusted TypeScript functions, Security Rules, versioned seed data, and Demo Mode.
- Required failure handling and the five-minute/two-minute presentation paths.

### Should

- Signed Android APK, native Google Sign-In, and camera.
- Android local after-work notification.
- Gemini free-text preference interpretation with deterministic fallback.
- Seeded leaderboard and friend-contribution record.

### Could

- Health Connect real background steps.
- Android real GPS arrival.
- Three.js tree showcase, particles, and the seeded bird-nest effect.
- Additional tasks, tree species, catalog items, or visual polish.

### Explicitly out of scope

- Real `小樹點`, real merchants, payment, and production reward liability.
- Real friend invitation, search, relationship, or resource transfer.
- Arbitrary-location task generation.
- Weather API and Firebase Cloud Messaging. The former exclusion of a
  content-management UI is superseded by the CMS scope extension on 2026-10-21.
- Production anti-cheat and comprehensive health-data handling.
- iOS, Safari-specific acceptance, AR, 3D maps, and AI photo validation.
- A separate production Firebase/GCP environment.

## Demo Mode controls

- Always display a `DEMO` badge while simulation is active.
- Enable Demo Mode from Settings rather than from the normal primary flow.
- Provide step speed, simulated arrival, cosmetic weather, and reset controls.
- Provide one-click five-minute and two-minute seed states.
- Isolate or explicitly mark every Demo record and use only seed data for the Demo leaderboard.
- Reset only the active Demo user, never all shared test data.

## Confirmed technical direction

- Shared confirmation and notification dialogs use a compact centered `ion-modal`
  with Angular template content, rather than `ion-alert`. Preserve the
  `DialogService.openDialog` / `openNotifyDialog` API, customizable button text,
  and `confirm` / `cancel` results; an optional config title separates the heading
  from the message. Button results are emitted after modal dismissal completes.
- Route confirmation uses the shared bottom-sheet modal instead of the centered
  dialog, with `確定路線` / `確定要挑戰本路線?` and `確認` / `返回` buttons.
  `ModalService.open` returns an observable emitting `confirm` / `cancel` once,
  after dismissal. Only confirmation starts the walk; returning, tapping the
  backdrop, or swiping down keeps route planning unchanged. Other dialogs retain
  their existing centered presentation.
- The harvest-result dialog shows the points earned in that harvest and the
  updated balance in a two-column summary card. It has only a `確認` button and
  stays on the current screen after dismissal; it does not navigate to Home or
  redemption. Demo harvest results are explicitly marked `Demo` and use the
  current demo cultivation point balance, not a production wallet balance.
  Show the result after falling fruit finishes and the points are credited,
  rather than at the start of the harvest animation.

- Host the Ionic Angular SPA on Firebase Hosting.
- Do not build a Java or .NET application backend unless Firebase-only implementation proves insufficient.
- Use Firebase-managed services and a small number of trusted TypeScript Cloud Functions over a client-only architecture. This remains entirely serverless on GCP while avoiding Java and .NET services.
- Use Firebase Authentication, Firestore, and Cloud Storage for Firebase for demo identity, state, and check-in photos.
- Prefer real Google Sign-In through Firebase Authentication over anonymous login.
- On Web, use the Firebase JavaScript SDK. On Android, do not run OAuth inside an embedded WebView. First run a one-day community Firebase plugin spike; if its license, security, and shared Firebase session are acceptable, use it. Otherwise use Android Credential Manager plus a small Capacitor bridge.
- Keep authoritative tree growth, step-delta calculation, route-service calls, and mock reward claims behind trusted functions rather than letting clients write balances or secrets directly.
- Use five Firebase HTTPS callable functions as the trusted command layer:
  - `syncDailySteps`: deduplicate monotonic daily totals and grant the correct `光能` delta once.
  - `completeTask`: validate task state, checkpoint/photo evidence, GPS or Demo Mode, and grant water, fertilizer, seed, or item results once.
  - `nurtureTree`: atomically spend selected resources, update one chosen tree's growth, enforce fertilizer/daily-harvest rules, and issue an eligible milestone harvest once.
  - `redeemReward`: atomically validate balance, append an immutable point-ledger entry, and create one redemption.
  - `recommendRoute`: accept only limited preference inputs, call Routes/Places securely, and fall back to rules when Gemini is unavailable.
- Require a unique request ID for every value-changing command and enforce idempotency inside a Firestore transaction.
- Treat the immutable point ledger as the source of truth; keep the displayed balance as a transactionally updated aggregate.
- Deny client writes to point balances, ledgers, authoritative step totals, tree progress, task completion, and redemptions through Firestore Security Rules.
- Allow direct client uploads only to the authenticated user's check-in path, limited to new image files and a small maximum size through Storage Rules.
- Store server-side Maps/Gemini credentials in Secret Manager. Use separate restricted client keys only for map rendering.
- Use Firebase App Check for callable functions, but spike Android sideload compatibility early and allow a controlled non-repository debug token only for the internal Demo if needed.
- Use Firebase Emulator Suite and seeded data for local development and demo recovery.
- Treat Android Health Connect as a short technical spike before committing real passive steps to the demo. It is not available on Web, and device or work-profile compatibility can block it.
- Keep the web walking simulator explicit, with simulated data labelled separately from device data.
- Do not claim production-grade anti-cheat, health-data accuracy, or cross-device step reconciliation.
- For active tasks, prefer rules-based smart recommendations, Google Routes API walking routes, and a curated pool of public task places.
- Do not let a language model invent coordinates or unverified routes. If Gemini is included, constrain it to interpret preferences, rank server-validated candidates, or generate task flavor text.
- Do not describe a route as safe. Google walking routes cannot verify lighting, crime, construction, opening hours, or accessibility, and the UI must display an appropriate warning.
- Prefer one pickup-to-delivery objective per task. Route Optimization and multi-shipment sequencing are not justified unless later made an explicit requirement.
- Use two curated demo areas: the presentation venue around Google's Banqiao office and the development area around Xihu MRT Station in Neihu. Dynamic Places search and arbitrary-location support are stretch work.
- Support a manual or simulated-arrival fallback for GPS-dependent checkpoints, especially for the indoor presentation venue.

## Delivery ownership

- Product owner / primary .NET full-stack engineer: architecture, Angular Signals and Ionic conventions, primary UI, integration, and PR approval.
- Java supporting engineer 1: Firebase Authentication, Firestore model, Security Rules, and rule tests.
- Java supporting engineer 2: step, task, and reward TypeScript Cloud Functions.
- Java supporting engineer 3: Routes, map integration, curated task data, and `recommendRoute`.
- Operations: Firebase project, IAM, secrets, budget, quotas, deployment, and App Distribution.
- UI/UX advisor: fixed weekly design review.
- Work should land through short-lived branches and small pull requests so supporting contributions can be reviewed without large rewrites.
- Place Firestore, Storage, and Cloud Functions in `asia-east1` unless the already-created Firebase project has an incompatible immutable location.
- Develop with `minInstances: 0`; consider one warm `recommendRoute` instance only for the final presentation.
- The Firebase plus five TypeScript Functions slice is currently estimated at 20–29 person-days, plus 4–7 person-days of integration-risk buffer.

## GCP and device readiness

- The GCP project and permissions are available.
- The project has a USD 500 cloud budget.
- All currently proposed GCP services are allowed.
- No company development handset has been identified.
- A personal Samsung Galaxy S22+ is available as the fallback Android test device.
- Company policy is expected to prevent directly connecting the personal phone to the company computer. APK signing and no-USB distribution must be part of the Android delivery plan.
- The current no-USB distribution recommendation is a consistently signed APK delivered through Firebase App Distribution. The company still needs to confirm use of a private Google account, installation of unreleased APKs, and permission to enable installation from that source.
- Keep the release keystore outside Git under an explicitly assigned custodian; use the same signing certificate for every Demo build and register its SHA-1 with Firebase Authentication.

## Environment and operations

- Local development uses Firebase Emulator Suite.
- Shared integration and presentation use one Firebase/GCP Demo project. There is no separate production environment.
- Pull-request review uses Firebase Hosting Preview Channels.
- Versioned seed and reset scripts restore known Demo data.
- Cloud Functions emit structured Cloud Logging entries. Google Analytics, Crashlytics, and a full monitoring stack are out of scope.
- Configure budget alerts at 50%, 80%, and 100%, plus daily Maps and Gemini quotas.
- Secrets, release-keystore material, and App Check debug tokens never enter Git.
- Development uses zero minimum instances. Only `recommendRoute` may use one warm instance for the final presentation.

## Acceptance platform and performance

### Must

- Current and previous major Chrome and Edge releases on Windows.
- Presentation layout at 1280×720 or larger and responsive layout at 360×800 or larger.
- Home becomes usable in approximately three seconds on ordinary corporate networking.
- Local UI actions respond within approximately 200 milliseconds.
- Route or Gemini work shows its fallback after eight seconds rather than blocking indefinitely.

### Should

- Samsung Galaxy S22+ Chrome and the signed APK's Android WebView.
- Android native camera, Google Sign-In, and local notification.

### Could

- Health Connect step import, real GPS arrival, and Three.js on the S22+.

iOS, Safari, and other Android models are not formal Demo acceptance targets.

## Demo content baseline

- Three tree species.
- Four growth stages: seed, seedling, young tree, and mature tree.
- Two curated geographic areas.
- Three active tasks per area.
- Three mock catalog rewards.
- One ESG tree-donation option.
- Mock catalog prices are a 30-`小樹點` beverage discount, a 50-`小樹點` green-transport discount, and a 50-`小樹點` ESG tree donation. All are labelled as Demo data rather than real merchant offers.
- Eight seeded leaderboard profiles.
- One complete example memory tree with a photo.
- The original seed-only content-management baseline is superseded by the CMS
  scope extension on 2026-10-21. Existing versioned seed data remains in use
  until CMS publishing and client-consumption behavior is confirmed.

## Demo privacy baseline

- Use test accounts and non-sensitive photos only.
- Do not retain a full walking track.
- Store only landmark identity and obfuscated coordinates for planted trees.
- Keep check-in photos private to the user by default.
- Provide a concise privacy notice.
- Delete demo account and photo data seven days after the presentation.
- Do not claim production-grade health-data accuracy or anti-cheat protection.

## Primary UI surfaces

1. Google Sign-In.
2. Home dashboard with today's steps, current tree, and quick start.
3. Task planner with time, mood, direction, and optional Gemini input.
4. Route preview with map, time, distance, and safety warning.
5. Active-walk task progress with task waypoint and stop controls.
6. Photo check-in.
7. Task result with tree growth and `小樹點` earned.
8. Personal collection map representing the user's private forest.
9. Memory-tree detail.
10. `小樹點` wallet, mock catalog, and ESG donation.
11. Leaderboard, settings, privacy, and Demo Mode controls. These may be combined into tabs or overlays rather than eleven separate routed pages.

## Three.js optional enhancement

- 2026-10-16 cultivation weather: The user confirmed at least sunny, rainy,
  and cloudy backgrounds, including rain particles, with a weather field in
  frontend environment configuration. In a follow-up, the user confirmed
  independent weather per tree, with randomly mixed test conditions and no
  neighboring-area consistency logic for now. Each tree's
  `destination.features[].properties.weather` in
  `client/src/environments/environment-dev.ts` stores a fixed sunny/rainy/cloudy
  seed value instead of a global weather setting. Switching trees updates the
  cultivation background and badge; reopening preserves the tree's configured
  weather. The shared scene input serves both WebGL and SVG.
  Reduced-motion mode uses static rain. This is cosmetic only:
  rain does not water trees or change resources, growth, or rewards. Live local
  weather is intended for a later Google integration; no API calls or keys are
  added now. Provider wiring, condition mapping, and failure UI remain unresolved.
  The user subsequently requested that sunny weather retain the original blue
  sky without any extra sunlight overlay. Preserve light-feeding effects.

- 2026-10-16 cultivation blank-scene follow-up: The user reported intermittent
  missing soil and tree after reopening the modal. Keep the SVG preview until
  a visible, nonzero-sized WebGL frame is rendered, redraw after making the
  canvas visible, and refresh dimensions/visibility after modal presentation.
  Do not reset the drawing buffer for unchanged canvas dimensions. Preserve
  context-loss fallback, teardown, weather, care state, and map camera behavior.

- 2026-10-16 cultivation camera follow-up: Closing tree care must preserve
  the current map camera and follow mode instead of requesting player recentering.
  This also applies when endpoint check-in completes the walk while care is open
  and closing returns to idle. Keep initial map positioning, route planning,
  and the explicit recenter button unchanged.

- 2026-10-16 cultivation-dismissal smoothness follow-up: Dragging the top
  handle past the native sheet dismissal threshold must continue downward
  directly into dismissal, without snapping back to the open breakpoint first.
  Use boolean `canDismiss: true` rather than a callback, because Ionic's
  callback path intentionally snaps back before checking dismissal. Retain
  `[0, 1]` breakpoints, disabled handle-click cycling, `backdropDismiss: false`
  (also blocks Escape/hardware-back dismissal), content-start gesture blocking,
  and the existing resource cleanup and walking-state restoration.

- 2026-10-15 cultivation-dismissal follow-up: The user confirmed that the
  cultivation sheet can only be closed interactively by dragging its handle
  downward. Disable handle-click cycling, backdrop/Escape/hardware-back
  dismissal, and sheet gestures starting in content. Preserve resource and
  tree pointer interactions, dismissal cleanup, and overlay teardown on destroy.

- 2026-10-15 interaction-position follow-up: The user requested that becoming
  mature not move the interaction area upward. Anchor the WebGL feeding/shake
  area to fixed scene coordinates rather than the current canopy bounds, and
  reproject it only for viewport changes. Preserve the SVG sprouted-stage
  interaction area, model-center tracking, root watering aim, and soil effects.

- 2026-10-15 fertilizer-soil visual follow-up: Show a soft golden soil glow
  and staggered sparkles while the existing fertilizer buff is active, in both
  WebGL and SVG. Align the effect to the soil surface on resize and stage
  changes; keep it independent of simultaneous light/water feeding. Reduced
  motion uses static sparkles. Do not change fertilizer duration or economics.
  On 2026-10-16 the user clarified back-to-front layering: soil, fertilizer
  glow/sparkles, then tree. WebGL fertilizer belongs inside the depth-tested
  scene rather than an HTML overlay above the canvas; SVG places the effect
  between the soil ellipse and tree group.
  The user subsequently confirmed the corrected layer order but preferred the
  earlier animation: preserve six scattered four-point sparkles, staggered
  2.4-second pulses, gentle upward drift, and the soft golden soil glow rather
  than the replacement's regular distribution and faster flashing.

- 2026-10-16 proximity-warning lifecycle: The user confirmed that the
  too-far interaction toast must disappear with the cultivation modal.
  Dismiss it when closing starts, invalidate pending creation/presentation,
  and prevent repeated interactions from stacking warnings. Also clear the
  shared warning on station closure and Home view teardown.

- 2026-10-16 weeds: Each Demo tree seeds an independent `weedCount` in
  `client/src/environments/environment-dev.ts`. At least 10 remaining weeds
  activate a stored per-tree debuff reducing new light/water conversion by 10%;
  the user subsequently confirmed that it persists below ten, including at
  one remaining weed, and only clears at zero. Tree switches and reopening
  do not reset the debuff; trees seeded below ten start without it.
  Multiply with fertilizer
  (1.2 x 0.9 = 1.08), without reducing existing growth or earned fractions.
  Users click individual weeds on the soil to remove one, subject to the
  same 500 m cultivation radius and proximity-warning behavior. Removal
  persists when switching trees or reopening care; reload restores seeds,
  and there is no timed regrowth yet. Pulling weeds grants no resources or
  points. Growth precision is now 1/7,500 per integer tick, superseding the
  earlier 1/750 representation, to keep all multiplier combinations exact.
  Display remaining weeds and the current conversion rate in care.
  A simultaneous sparkle fix must preserve all six scattered stars: composite
  soil, then fertilizer without soil depth occlusion, then tree/fruit, retaining
  soil depth so planted seeds remain correctly buried.

- 2026-10-15 seedling visual follow-up: The user requested a more sapling-like
  seedling model. WebGL and SVG now use a slender green stem, four spreading
  pointed leaves, and one upright new leaf rather than a miniature mature
  canopy. Keep the existing stage thresholds, soil, care interactions, and
  young/mature/large models unchanged.

- 2026-10-14 reward-particle follow-up: The user requested smaller fruit markers,
  using 50 yellow particles with a central leaf motif instead of volumetric fruit
  meshes. Use an original yellow/white-leaf SVG in the public image assets, not
  the read-only reference attachment. WebGL uses one textured `THREE.Points`
  object with 50 vertices; SVG uses 50 small instances of the same image. Each
  particle represents one of the existing 50 Demo points, not an extra reward.
  Distribute markers over the canopy, stagger their falls and soil landings,
  and finish the entire animation within the store's existing 1,150 ms payout
  deadline. Preserve reduced-motion static landings, cleanup, and the ripe-only
  harvest gate. Harvested state lasts through the confirmed 24-hour recovery
  period described above. This supersedes the original
  five volumetric fruits and numeric ten-point labels.
  Preserve the developer's latest compact modal markup: percentage spans and
  the stage badge remain, while the standalone harvest panel/button is absent.
  Direct shaking triggers harvest; the component/store action remains available.

- 2026-10-15 tree-size follow-up: The user confirmed that the mature tree model
  is the maximum rendered size. Large/ripe and later growth retain mature trunk
  and canopy dimensions in WebGL and the mature transform in SVG. Fruit origins
  follow the capped canopy; watering/feeding targets remain aligned. Mature and
  large growth pulses shrink and return rather than exceeding the cap. Stage
  thresholds, labels, growth values, sway, and harvest rules are unchanged.

- 2026-10-14 configurable stage-threshold follow-up: The five-stage boundaries
  below were superseded by the eight stages confirmed on 2026-10-19;
  harvest-target configuration and reward rules still apply. The user confirmed
  that development must allow freely changing the environment harvest target and
  that every visual stage should derive from a percentage of that target.
  Use one shared stage function: seed below 10%, seedling from 10%, young from
  30%, mature from 60%, and large/ripe at 100%. For example, a target of 100
  yields boundaries of 10/30/60/100; preserve the developer's chosen environment
  value rather than resetting it. Targets must be positive safe integers.
  WebGL geometry, SVG fallback, stage labels, growth celebrations, and sway/
  harvest gates all use the same function. Ordinary sway starts at 60%, fruit
  can fall only at 100% with harvest permission. Keep the 50 Demo-point reward
  and resource ratios unchanged. The 5,000-growth economic reference is not
  a hardcoded development threshold. Store and interaction tests provision
  inventory relative to the actual environment target, while pure conversion
  tests also preserve the 5,000-growth economic reference. Stage tests cover
  multiple targets and integration covers the actual target. Preserve the developer's
  compact markup edits, including the removed cost-warning paragraph.

- 2026-10-14 sway-only interaction follow-up: Remove free model rotation at every
  stage. Only mature (60% of target) and large trees in interactive scenes respond
  to horizontal pointer movement with a gentle, bounded +/-5-degree sway and
  return upright on release/cancellation. Seed, seedling, and young stages do not
  respond. Ordinary sway has no growth, resource, reward, or fruit-drop effect,
  including after harvest. Only a large tree with ripe fruit and explicit harvest
  permission can emit a harvest request after the existing deliberate-reversal
  gesture. Disable interaction during fruit falling; preserve the accessible
  harvest button, single-harvest reward guard, and 2D/WebGL consistency.
  This supersedes the earlier free horizontal drag rotation.

- 2026-10-14 soil/seed visual follow-up: The user requested a brown ground base
  and a seed that looks planted rather than resting on top. Use brown soil in
  both WebGL and the SVG fallback. Center the 3D seed on the derived soil top
  so its lower half is occluded by the opaque ground; changing ground height
  or vertical placement in the constructor also updates seed planting depth.
  The fallback shows only the upper seed cap with a small foreground soil rim.
  Update the fallback model center while retaining the root watering point,
  feeding rules, later growth stages, and harvest behavior.

- 2026-10-14 water/overflow follow-up: Water shares light's conversion system
  with ten times the effectiveness per resource unit: one drop equals 10 light,
  so 15 drops produce one base growth. Fertilizer still adds 20% for 24 hours;
  15 boosted drops yield 1.2 growth and 25 yield exactly 2. Preserve the unified
  integer 1/750-growth remainder across mixed and small allocations. While
  growth is below 5,000, accept any valid, affordable batch, including one that
  exceeds the remaining growth. Deduct the full batch, cap credited growth at
  5,000, and discard overflow and the remaining fraction upon reaching 100%.
  Continuous feeding is inventory-limited, not trimmed to the exact final cost;
  stop immediately after the crossing batch and reject further feeding at 100%.
  Show a final-batch resource-cost warning. Preserve the existing compact modal
  layout, 50-point harvest, terminal `已收成` state, and configured feeding rates.
  This supersedes the old water value and exact-final-cost limits below.

- 2026-10-14 light/growth separation: The user rejected one light energy equalling
  one growth value and explicitly chose one eligible step -> one light energy,
  150 light -> one base growth, and a 7,500-light daily cap. Keep the confirmed
  5,000-growth/50-point single harvest and terminal `已收成` state. The step-only
  baseline is now 750,000 eligible light/steps over 100 capped days, not 5,000 light.
  Credit light incrementally when steps arrive, retaining displayed daily steps
  and preventing duplicate credits. Reset eligibility at Taipei midnight, without
  converting yesterday's steps. Fertilizer remains +20% for 24 hours
  (150 boosted light yields 1.2 growth; 125 yields 1). Water's original
  10-base-growth/drop value is superseded by the water/overflow follow-up above.
  Carry earned fractional growth in integer 1/750-growth ticks across gestures,
  rate changes, modal closure, fertilizer activation/expiry, and mixed feeding.
  Whole growth drives tree-level progress. The original next-point percentage
  row is absent from the current compact markup, but fractions remain in state.
  The original minimum-final-light and water-capacity limits are superseded
  by the water/overflow follow-up above.

- 2026-10-15 cultivation layout follow-up: The user requested floating controls
  over the tree scene and a follow-up layout cleanup. Keep tree information,
  growth progress, and the active fertilizer indicator grouped at the top, with
  the resource dock centered at the bottom. The overlay must not block tree
  gestures outside the resource buttons or change feeding coordinates.

- 2026-10-14 completed-harvest follow-up: The user requested that this cultivation
  Demo stop after its first harvest and display `已收成`, rather than opening
  another growth cycle. Keep the grown tree and 5,000 growth, remove fruit, and
  block light, water, fertilizer, and duplicate harvest even after reopening or
  a new calendar day. This supersedes the repeatable Demo cycle below, not the
  broader persistent-tree product plan. The existing 50 Demo-point reward is
  unchanged. The user asked for an economic recommendation based on 7,500 steps
  yielding 50 task value and 5,000 task value redeeming 50 `小樹點`, and then
  explicitly chose 5,000 growth/50 points instead of the currently edited
  150,000-growth Demo threshold. Update that environment constant only; preserve
  the user's light/water rate settings. Treat harvest as redemption, not an
  additional second award. Assuming one task value becomes one growth, pure step
  earning takes 100 capped 7,500-step days; water/fertilizer acceleration must
  account for extra task effort. This does not change step conversion logic.
  Frontend seeded inventory and adjustable visual feeding rates are not evidence
  of real earning rates. Sharing the Demo balance with the shop remains unresolved.

- 2026-10-14 mirror/fruit-harvest follow-up (repeatable Demo cycle superseded
  by completed-harvest follow-up above): Mirror the can horizontally when
  its nozzle is to the right of the root, preserving nozzle anchoring and an
  upright opening. Bound tilt to +/-75 degrees for near-vertical pouring.
  At each cumulative 5,000 growth, show five golden fruits (10 Demo points each).
  Deliberate left/right shaking drops the fruits; a button offers a keyboard
  alternative. The user confirmed automatic 50-point credit after landing,
  temporarily keeping the large tree and cumulative growth during the recovery
  period, then clearing the site to an empty planting point, and continuing to 10,000,
  15,000, etc. Apply one harvest per Asia/Taipei calendar day. Stop feeding at
  a ripe milestone until it is harvested; a same-day next batch remains ripe
  until the next day. Reward credit is guarded and owned by the session-local
  store, so closing the modal during the fall cannot duplicate or lose a credit.
  No Firebase/real points are involved; the modal explicitly shows its own Demo
  points balance. Sharing this balance with the separate shop seed remains
  unresolved and is not implemented here. Preserve the SVG/reduced-motion
  fallback and disposal. This supersedes the initial no-harvest Demo restriction.

- 2026-10-15 watering animation/state follow-up: Replace the root-reaching
  water ribbon with eight short nozzle-local drops and twelve separate root
  splashes; no particles travel between the can and root. Preserve nozzle
  anchoring, mirroring, root projection, reduced-motion static effects, and
  existing feeding costs/growth. Each Demo tree records its last successful
  water allocation separately: `已澆水` for less than 24 elapsed hours, then
  `正常`, and `缺水` only after more than seven elapsed days without watering.
  Before the first watering, use the Demo tree's session creation time as its
  age baseline. Only successful allocations spending at least one drop refresh
  the timestamp; picking up the can, light, fertilizer, and rejected allocations
  do not. Show the status badge and use darker wet soil in both WebGL and SVG,
  with lighter dry soil. These visual states do not alter growth or care limits.
  Demo tree data remains session-local, matching existing cultivation data.
  This supersedes the root-reaching ribbon below.

- 2026-10-14 root-watering follow-up (ribbon superseded above): Aim the held can and water stream at the
  projected trunk base/soil, not the model center; the seed uses its soil point.
  Keep feeding-range detection separate from this visual aim, and update both
  WebGL and SVG fallback targets with stage/resize changes. Make pouring fuller
  with a bounded 60-drop curved ribbon and 12 small root-impact splashes, without
  cone-shaped particle fields. These decorative droplets do not change inventory
  spending or growth. Reduced motion uses static droplets and splashes; retain
  the clipped, absolute overlay so effects never resize the canvas.

- 2026-10-14 visual follow-up: Remove the background sun disk and explicit
  sunlight rays. Light feeding instead adds a broad, static upper-sky glow;
  retain blue sky, white clouds, and brighter model lighting. Keep the held
  light-resource icon. Water-stream styles must apply to the layout-level SVG,
  not descendants of the held can: the stream is an absolute, clipped overlay
  that does not resize the scene or disturb feeding-range detection. Preserve
  nozzle alignment, continuous feeding rates, resource deductions, and fertilizer.

- 2026-10-14 visual revision (sun/rays superseded by the follow-up above):
  The user rejected cone-shaped particle effects.
  Replace them with a blue-sky/white-cloud backdrop, parallel soft sky-to-tree
  sunlight rays, and a curved water stream originating at the pointer's actual
  watering-can nozzle. Rotate and position the can to aim at the projected
  model, not the center of the larger feeding radius. Track stage and resize
  changes. Remove Three.js point-cloud care effects; preserve the care economy,
  transparent WebGL/SVG layering, reduced-motion alternatives, and cleanup.

- 2026-10-14 watering follow-up (water value and final-capacity limits superseded
  by the water/overflow follow-up above): The user requested a watering-can graphic while
  dragging water, continuous pouring inside the tree range, and separate
  per-second injection controls for both water and light. Water retains 10 base
  growth per drop (12 with fertilizer). Rate changes stop the current gesture;
  the next gesture uses the new rate. Whole resources are deducted atomically
  and automatically limited by inventory and remaining permitted growth.

- 2026-10-14 follow-up: The user confirmed a larger, resource-holding care scene
  with immediate spending rather than a final confirmation button. Holding a
  dragged sun inside the model's care range feeds at exactly 100 light energy
  per second of active in-range time by default; the later watering follow-up
  adds configurable rates and replaces single-drop water feeding.
  Fertilizer activation costs one item and boosts all light/water feeding by 20%
  for the next 24 hours, not just one feeding. Daily activation uses Taipei time;
  the effect itself expires 24 hours after activation, not at midnight.
- Pause resource spending on release, pointer cancellation, leaving the range,
  loss of focus, hidden/offscreen scenes, modal closure, and inventory/growth
  limits. Preserve fractional light time until a gesture ends and fractional
  fertilizer bonuses across feeding ticks during the active effect so small
  timer updates do not lose the promised 20% bonus. SVG and keyboard operation
  retain the same resource rules without requiring WebGL.

- 2026-10-14 harvest/foliage follow-up (completed 2026-10-15): The user
  confirmed that each Demo map tree may harvest once independently, without the
  account-wide daily harvest restriction. This supersedes that restriction for
  the frontend Demo only; each harvested tree remains completed, cannot grant
  another reward, and still credits exactly 50 session-local Demo points after
  landing. Fertilizer and daily light limits are unchanged. Multiple pending
  falls credit their original trees even if the user switches trees or closes
  the modal. The user requested rewards buried among leaves rather than all
  50 visibly arranged in front of the tree: WebGL origins cluster within the
  five foliage volumes with depth occlusion; the SVG fallback conceals 40 and
  partly covers ten glimpses. During shaking harvest, all 50 particles become
  visible and fall within the existing 1,150 ms payout deadline.

- 2026-10-14 map-tree cultivation follow-up: The user confirmed a provisional
  500-metre cultivation radius, adjustable through
  `TREE_CULTIVATION_RADIUS_METERS` in `client/src/environments/environment-dev.ts`,
  and requested initial growth plus a mix of active/inactive fertilizer for every
  existing tree marker. The Home modal now uses the clicked map tree rather than
  the independent showcase tree described below. Each marker's Demo seed properties
  include `growth` (scaled with the configurable harvest target) and
  `fertilizerRemainingMs` (zero means inactive); five of ten trees start with a
  timed effect. Growth, fertilizer expiry, fractional growth, and harvest state
  are tree-specific and session-local; inventory and the daily account harvest
  restriction remain shared. Home recommendations read current growth from the
  same store. No Firebase, collection persistence, or real reward integration is
  added. The 2026-10-15 follow-up supersedes the original modal-access restriction:
  idle and active-route clicks always open the tree for viewing, while care
  actions check straight-line Haversine distance inclusively. Missing location or
  leaving the radius disables care and stops spending without closing the modal.
  Planning clicks still select destinations.
  This supersedes the independent-map-tree restriction in the initial prototype.

- 2026-10-14: The user requested a Three.js tree in the Home cultivation modal
  and confirmed an interactive frontend Demo with resource previews, actual
  deductions from the existing frontend inventory, and growth effects, without
  Firebase integration in this increment.
- This increment uses an explicitly labelled, independent Demo tree rather than
  modifying map/collection tree records. State is session-local and reload resets
  it. The initial no-harvest restriction is superseded by the mirror/fruit-harvest
  follow-ups above: the Demo now grants session-local Demo `小樹點` once at its
  first 5,000-growth milestone and then displays `已收成`, not real wallet points.
- The prototype pins `three` 0.186.1 with `@types/three` 0.186.0, loads the scene
  dynamically, and keeps SVG care controls available without WebGL. Accepting
  the enhancement still depends on the device/performance spike below. Broader
  multi-tree persistence, species styling, and harvest integration remain outside
  this increment.

- Three.js is a Could item rather than a Demo requirement. If capacity permits, use it only as a controlled, reusable 3D tree showcase, not as a 3D game world.
- Use direct `three` integration rather than an Angular-specific wrapper. Pin an exact version for the project.
- Reuse one `TreeSceneComponent` on the home dashboard, task-growth result, and memory-tree detail.
- Keep Google Maps, route preview, collection-map markers, lists, navigation, and all required workflows independent of Three.js.
- Generate stylized tree species parametrically, using the eight growth stages confirmed on 2026-10-19 rather than separately commissioned detailed models.
- The provisional art direction is warm, stylized low-poly geometry led by Cathay green with restrained seasonal color variation. The UI/UX advisor will review this direction before optional implementation.
- Use progressive growth sizing, brief crown emergence, and bounded sunlight/water/leaf effects. The 2026-10-19 growth animation replaces the earlier whole-tree pulse. Use a bounded point scatter for harvest rather than a separate physics engine.
- Keep a permanent WebP/SVG/CSS fallback for WebGL initialization, context-loss, performance, or reduced-motion cases.
- Allow only one active renderer at a time. Stop animation when an Ionic page is left, the tab is hidden, or no animation is required.
- Cap mobile device pixel ratio, avoid real-time shadows and post-processing, and dispose all Three.js resources explicitly.
- Run a two-person-day spike before committing the feature. Test desktop Chrome, S22+ Chrome, and later the Android WebView.
- Spike acceptance targets:
  - At least 30 FPS during care effects on S22+, targeting 45–60 FPS.
  - No growing renderer memory after twenty Tree → Map → Tree navigation cycles.
  - 2D fallback appears within one second when WebGL is unavailable or lost.
  - Three.js is lazy-loaded and its compressed lazy chunk targets at most 250 KB.
  - The scene does not interfere with Google Maps gestures or Ionic page transitions.
- Estimated implementation after accepting the spike: 8.5–11 person-days plus up to 2 risk-buffer days and 0.5–1 designer day.

## Reminder scope

- In-app progress and after-work reminder cards are Must.
- An opt-in Android local scheduled notification is Should.
- Firebase Cloud Messaging and a server-managed push campaign are out of scope.
- The user chooses an after-work reminder time, defaulting to 17:30.
- A reminder is only issued when the daily step goal is incomplete. It states the remaining steps and a suggested task duration.
- Completing the daily goal suppresses the reminder.
- Web Demo uses an in-app reminder card and a notification-preview action.
- Background geofence notifications are out of scope.

## Onboarding and navigation

- Bottom navigation client features are Home, Task, Collection, and `小樹點`; the Traditional Chinese labels remain appropriate product copy such as `首頁`, `任務`, `森林`, and `小樹點`.
- Leaderboard opens from Home. Profile, reminder settings, privacy, and Demo Mode open from the user avatar.
- First sign-in asks for a daily step target and optional device-local home/work anchors.
- A new user receives one starter seed and a guided first planting task.
- Explain `光能`, `水滴`, and `肥料` only when each is first earned rather than in one up-front tutorial.
- Empty Collection state points to the first planting task. Empty resource state points to the nearest eligible task.

## Weather scope

- Do not call Google Weather API in the two-month Demo.
- Weather may appear only as preset visual flavor in Demo Mode and never changes resource economics.

## Required failure fallbacks

- Gemini failure falls back to the deterministic rule-based recommendation.
- Routes failure loads a curated preset route.
- GPS permission denial allows manual or simulated arrival.
- Camera permission denial allows selection of an existing image.
- Photo-upload failure keeps a local pending state and exposes retry.
- GCP or network failure switches the presentation to seeded Demo Mode.
- WebGL failure displays the 2D tree fallback.
- Google Sign-In failure permits the prepared Demo identity.

## Delivery calendar

- Sprint 0, 2026-09-03 through 2026-09-09: discovery, UX, Firebase setup, and Auth/Health/Three technical spikes.
- Sprint 1, 2026-09-10 through 2026-09-23: sign-in, dashboard, steps, tree core, and Firebase data layer.
- Sprint 2, 2026-09-24 through 2026-10-07: routing, map, active task, and photo check-in.
- Sprint 3, 2026-10-08 through 2026-10-21: personal forest, memories, reward wallet/catalog, and Android integration.
- Sprint 4, 2026-10-22 through 2026-11-05: optional Gemini/leaderboard/Three work only after Must scope, plus fallbacks, testing, recording, and fixes.
- All Must features are due by 2026-10-21.
- 2026-11-06 through 2026-11-08 is feature freeze for rehearsal and Demo-blocking fixes only.
- The live presentation is 2026-11-09.

### Post-grilling capacity finding

The 2026 Taiwan government-office calendar leaves 42 working days in the development window after the 9/25, 9/28, 10/9, and 10/26 weekday holidays. Using the confirmed team allocations at conservative midpoints and a 75% delivery factor gives approximately 55.6 developer-days.

The optimized Must backlog is 63 cross-functional person-days: approximately 51.5 developer-days, 6 operations-days, and 5.5 UI/UX-days. It fits the full development window with little buffer, but it does not support completing every Must item by 2026-10-21. The generated executable plan therefore recommends:

- 2026-10-21: five-minute core path feature complete, approximately 52 cross-functional person-days / 43.5 developer-days.
- 2026-11-05: remaining memory-revisit, quality, runbook, recording, and rehearsal Must work complete.
- Should and Could work uses earned capacity only.

This is a scheduling reconciliation, not a product-scope change. It remains pending product-owner confirmation because it changes the previously confirmed interpretation of the 2026-10-21 gate.

To keep the core path date-safe, Must routing ranks six versioned, manually reviewed route templates rather than generating arbitrary live routes. The three task types share one parameterized completion pipeline. A future live Routes API call must be introduced as earned scope and retain the preset fallback.

## Five-minute presentation path

1. Sign in to `Cathay Walk | 國泰健康走` with Google.
2. Show several trees, today's steps, and the `光能`/`水滴`/`肥料` inventory.
3. Request a 15-minute after-work detour and receive the deterministic route recommendation.
4. Briefly show Gemini translating free text into bounded preferences, with the same deterministic fallback route available.
5. Simulate walking, take a water-station photo, and receive one `水滴`.
6. Complete nutrient delivery and receive one `肥料`.
7. Arrive at a tree near its 5,000-growth milestone.
8. Preview and confirm a light-energy/water allocation.
9. Show tree growth and the optional Three.js celebration if available.
10. Harvest 50 mock `小樹點` and select green-transport redemption or ESG donation.
11. Briefly show the memory grove, seeded friend contribution, and leaderboard.

- The two-minute fallback begins at step 7 with a preseeded account.

## Definition of done for Must stories

- Every acceptance criterion passes.
- Core logic has an appropriate unit test or Firebase Security Rules test.
- A Firebase Hosting Preview works in desktop Chrome.
- Seeded Demo Mode can complete the equivalent flow.
- Permission denial, network failure, and applicable external-service failure have the specified fallback.
- No console error blocks the user flow.
- At least one teammate reviews the pull request.
- The product owner runs the relevant happy path before closure.
- A direction-changing implementation updates this `CONTEXT.md`.
- A Must story never depends on completion of a Could item.
- Twelve bespoke GLB models, skeletal animation, AR, physics, 3D maps, forest roaming, real-time shadows, and post-processing are out of scope.

## Azure Boards import facts

- Azure Boards supports native CSV import for new work items.
- New-item CSV files require `Work Item Type` and title fields and must omit IDs.
- Parent-child hierarchy can be represented with indented title columns such as `Title 1`, `Title 2`, and `Title 3`; directly filling a `Parent` field is not the supported CSV mechanism.
- The target project sample export confirms the Agile-compatible types `Epic`, `Feature`, and `User Story`, plus the fields `Description`, `Acceptance Criteria`, `Priority`, `Story Points`, and `Tags` used by the full import CSV.
- The sample export also confirms the project-root `Area Path` and `Iteration Path` value `CUB-CAT_WALK_APP`; the initial import intentionally omits both paths so Azure applies the project root.
- Azure Boards currently limits a single CSV import to 1,000 work items. This demo backlog is expected to remain well below that limit.
- Generated deliverables include a hierarchy-preserving Agile CSV, a minimal compatibility CSV, a human-readable backlog, an independent estimate table, and an import guide. The full CSV is confirmed compatible with the target project's sampled work-item types and fields.

## Working agreements

- Use a design-tree interview in rounds. Ask all currently unblocked decisions in a round, include a recommendation for each, and wait for the user's answers before expanding dependent branches.
- Do not finalize scope, architecture, Azure Boards hierarchy, or estimates until the user confirms that shared understanding has been reached.
- Estimates must state their unit and capacity assumptions.
- Optimize for a reliable demo path. Production hardening should only enter scope when it directly protects that demo.

## Decision log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 2026-09-03 | Use Azure Boards for project planning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Time-box delivery to two months and prioritize demo completeness over production integrations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Keep the shared Matt Pocock skills inside this repository under `skills-main/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | `CAT` refers to the Cathay project prefix; the app must not use a cat theme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Use planting and growing trees as the central activity-reward metaphor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Target office workers who can be encouraged to walk farther after work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Make a browser-based simulated demo the minimum interactive delivery and Android real-device support the preferred delivery.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Include photo check-ins in the intended experience.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Superseded by the confirmed planting, water, and delivery photo rules                        |
| 2026-09-03 | Use GCP serverless services for backend responsibilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Superseded by the confirmed Firebase plus five TypeScript-functions architecture             |
| 2026-09-03 | Develop through 2026-11-05 and present on 2026-11-09 at Google's Banqiao office.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | Treat the target Azure Boards hierarchy as Epic → Feature → User Story → Task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed; underlying process is likely Agile and still requires verification                |
| 2026-09-03 | Position CAT WALK as a standalone public concept rather than an employee-only or existing-policyholder-only feature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Differentiate from `健康吧` through active walking tasks and game-like objectives while retaining passive Android step totals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Use mock `小樹點` to demonstrate reward value without a production loyalty integration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Superseded by the confirmed 5,000-growth harvest and catalog rules                           |
| 2026-09-03 | Use Traditional Chinese only for the demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Estimate Epic/Feature scope in person-days and User Story/Task execution in hours.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-03 | Provide a seeded local Demo Mode alongside the primary online GCP path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Adopt the Must/Should/Could platform priority described in this document.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Store each persistent tree in a location-associated personal forest so it can become a memory tied to past walks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Count unique daily steps once as an unallocated growth resource; use active check-ins and tasks to grant distinct water, fertilizer, or item resources.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Superseded by the confirmed `光能` / `水滴` / `肥料` formulas; `光能` remains a working name |
| 2026-09-03 | Demonstrate mock `小樹點` through a balance, small reward catalog, and ESG donation option.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Use waypoint photos for pickup, delivery, or arrival without AI image validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Keep individual progression as core and treat a seeded weekly leaderboard as optional; defer real friend interactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Allow official Cathay brand resources in the internal demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Use the available USD 500 GCP budget and approved GCP services.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Make the .NET engineer the overall technical, product, integration, and backend-coordination owner; treat Java engineers as supporting contributors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Use the personal Samsung Galaxy S22+ as the fallback Android test device and plan for APK distribution without a USB connection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed in principle; company policy and distribution channel remain open                  |
| 2026-09-03 | Keep location-associated trees private and store a Place ID, landmark name, and obfuscated coordinate rather than an exposed exact point.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Allow several persistent trees to grow through repeat milestones rather than maturing once and disappearing or becoming inactive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed; this supersedes the earlier single-tree 5–7 day lifecycle                         |
| 2026-09-03 | Support one-way and return-to-origin active tasks, constrained around the user's home/work corridor, with one pickup-to-delivery objective per task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed; exact anchors remain device-local and transient in route calls                    |
| 2026-09-03 | Make rules-based smart route recommendation mandatory and Gemini enhancement optional but desirable for the Google-office presentation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Curate three tasks around each of Xihu MRT Station and Google's Banqiao office rather than supporting arbitrary locations in the Demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Use GPS arrival in normal mode with simulated arrival always available in Demo Mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Avoid Java and .NET application backends; use Firebase-managed services plus a minimal five-function TypeScript trusted command layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed; expanded from four after resource allocation became a separate domain command     |
| 2026-09-03 | Use the documented Demo content and privacy baselines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Design the main presentation as a five-minute happy path, plus two-minute and prerecorded fallbacks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Keep exact home/work anchors device-local and transmit them only transiently for route calculation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Show memories and a seasonal collectible on tree revisits without issuing repeat `小樹點`; define a separate same-area replant loop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed through private memory groves, repeat planting, and once-per-day task rewards      |
| 2026-09-03 | Use structured route preferences as Must and optional Gemini free-text interpretation with deterministic fallback as Should.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Use Firebase Web Google Sign-In and spike a community Android Firebase plugin before falling back to an official Credential Manager bridge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Use Firebase App Distribution for signed APK delivery if company policy permits personal-device testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Pending company confirmation                                                                 |
| 2026-09-03 | Use the documented TypeScript/Firebase ownership split and primary UI surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Constrain task detours by extra walking time and bounded deviation from the user's current commute direction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed                                                                                    |
| 2026-09-03 | Treat Three.js as optional after a two-person-day spike; the Demo remains complete with its 2D fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Calibrate rewards against `健康吧`: steps earn non-cash activity points, 5,000 activity points convert to 50 `小樹點`, and `小樹點` retain a 1:1 NTD reference.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed; Demo resource, milestone, and catalog amounts are now specified                   |
| 2026-09-03 | Use versioned seed files rather than building a content-management interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed                                                                                    |
| 2026-09-03 | Make in-app reminders Must, Android local notifications Should, and Firebase Cloud Messaging out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Use the documented failure fallbacks for Gemini, Routes, permissions, uploads, GCP, WebGL, and sign-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Use the documented Sprint 0–4 calendar, finish Must scope by 2026-10-21, and freeze features after 2026-11-05.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Permit multiple simultaneously cultivated trees and let users allocate accumulated resources among them while near a tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Group repeated plantings at one landmark into a private memory grove and allow route replay with daily reward limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-03 | Use `光能` as the working step resource, plus `水滴`, `肥料`, and optional special items with the documented acquisition and growth effects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed; the team may later rename `光能` without changing mechanics                       |
| 2026-09-03 | Include friend contributions as non-monetary collaborative growth, represented only by seeded data in the Demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Use a warm Cathay-green low-poly art direction if the optional Three.js spike passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Provisional pending UI/UX review                                                             |
| 2026-09-03 | Treat `CAT-WALK` as the internal code name and use `Cathay Go｜大樹同行` as the working Demo name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Superseded by the `Cathay Walk                                                               | 國泰健康走` Demo naming decision on 2026-09-08 |
| 2026-09-03 | Apply the documented definition of done to every Must user story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Harvest 50 mock `小樹點` at every cumulative 5,000 tree-growth milestone without resetting the persistent tree, limited to one harvest per account per day in the Demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Require a seed plus a planting task and public-point photo check-in to create a tree; give new users one starter seed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Allow unlimited historical trees, group them by memory grove, and pin at most three followed trees on the dashboard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Limit special-item scope to one optional seeded `鳥巢`/resident-bird effect; omit real pest and tree-death systems.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Use planting, water, and nutrient-delivery as the three task types, with the documented photo and daily-award rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Require approximate 150-meter proximity for resource investment and harvest; show a non-reversible transaction preview and allow Demo Mode proximity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-03 | Restrict Demo planting to six curated public points and keep home/work as device-local route anchors only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Use four bottom tabs and progressive, just-in-time onboarding for the three-resource system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Omit live Weather API integration; any Demo weather is cosmetic and economically neutral.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Use the documented five-minute multi-resource presentation path and its two-minute preseeded fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Default the opt-in after-work reminder to 17:30, suppress it after goal completion, and omit background geofencing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Persist Demo resources without expiry or caps; defer production inflation controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Reconcile daily step sources by maximum cumulative total, isolate all simulated records with `isDemo=true`, and use the `Asia/Taipei` day boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Permit remote tree care but require physical proximity for an eligible `小樹點` harvest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed for Demo; revisit for production operations                                        |
| 2026-09-03 | Clearly badge and isolate Demo Mode, with presenter controls and one-click five-minute/two-minute seed states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Use the documented Windows browser, responsive layout, S22+, and performance acceptance matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Use Emulator Suite locally, one shared Demo Firebase project, Preview Channels, seed/reset scripts, structured logs, budget alerts, and no production environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-03 | Freeze the documented final Must/Should/Could/out-of-scope priority matrix for backlog planning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | Award `光能` progressively per completed 500-step block while preserving the daily totals of 30 at 5,000 steps and 50 at 7,500 steps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-03 | Do not queue multiple harvest milestones; allow one account-wide `harvestReady` milestone and atomically reject allocations that would cross another unavailable threshold.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | End the `grill-me` / `grilling` discovery phase and generate implementation, estimate, and Azure Boards artifacts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-03 | Use six versioned, manually reviewed route templates plus deterministic ranking as the date-safe Must implementation; treat arbitrary live route generation as earned scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Planning baseline                                                                            |
| 2026-09-03 | Interpret 2026-10-21 as core-path feature complete and 2026-11-05 as all-Must complete because the confirmed all-Must-by-10/21 goal exceeds conservative capacity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Recommended; awaiting product-owner confirmation                                             |
| 2026-09-03 | Use the full Azure Boards import CSV after a target-project sample export confirmed `Epic`, `Feature`, `User Story`, `Acceptance Criteria`, `Priority`, and `Story Points`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-07 | Start UI implementation with a responsive, mock-data Dashboard prototype covering daily steps, resources, a recommended task, followed trees, Demo controls, and four-tab navigation; defer final visual polish and data integration for later UI/UX and feature work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-08 | Use NgRx Signal Store 22 for client state management. Temporarily configure client npm installs with `legacy-peer-deps=true` because AngularFire 20.0.1 still declares Angular 20-only peers; NgRx 22 itself supports Angular 22.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-08 | Upgrade AngularFire from 20.0.1 to the explicitly pinned 21.0.0-rc.0 prerelease, accepting Firebase JS SDK 12 as a transitive dependency. Retain `legacy-peer-deps=true` because this AngularFire release declares Angular 21 rather than Angular 22 peers, and raise the production initial-bundle error budget from 1 MB to 1.1 MB to accommodate the measured Firebase 12 bundle increase.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed                                                                                    |
| 2026-09-08 | Standardize client implementation names on `Collection` instead of `Forest` and `Task` for the active-walk feature, matching the existing `/collection` and `/task` routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Superseded by the project-wide task naming decision on 2026-09-08                            |
| 2026-09-08 | Standardize `Task`／`task` project-wide across client code, Cloud Functions, Firestore paths, seed data, tests, and documentation. Use contracts such as `completeTask`, `taskId`, `taskCompletions`, and `tasks/{taskId}`; do not introduce new identifiers containing the deprecated English term.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-08 | Use `Cathay Walk \| 國泰健康走` as the working Demo public name. Retain the existing collision-risk warning and require internal brand/legal review before any public adoption.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed for Demo                                                                           |
| 2026-09-08 | Use Angular 22 `@Service()` as the project convention for new services and repositories; retain `@Injectable()` where explicit injectable provider metadata is needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-09 | Adopt Capacitor 8.5.1 for the Ionic 9 / Angular 22 client and add Android as the first native platform. Pin core, CLI, and Android to the same version; use `com.cathay.catwalk` and `dist/client/browser`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-14 | Make the home screen's initial visual focus a compact sky-and-ground growth scene with the seedling centered on the soil, resource clouds and a sun above it, and a secondary compact Google Map below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-24 | Make the bonus-game lobby and room experience responsive on phones smaller than the Samsung Galaxy S20. Players may actively leave only during room preparation; disconnecting or closing the window preserves membership and current game state for reconnection, while a departing room master transfers ownership to the next player in room order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-24 | At the end of each bonus-game round, reveal the current question's correct answer and hints alongside the players' identities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-24 | Use players' Google account portraits throughout the bonus game. Generate and show the question and hints during room preparation; let the room master edit the room name and AI prompt or regenerate the question before starting, and make game start proceed directly to role assignment and countdown without another AI call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-24 | Add `誰是偽藝術家` as a second bonus game using the existing lobby and room lifecycle. All players know the category; one random fake artist cannot see the drawing word; players draw two one-stroke turns each in distinct colors on a shared Angular Signature Pad canvas, then each casts one visible-attribution vote within 20 seconds before the fake artist is revealed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-24 | Add `間諜危機 Spyfall` as a third bonus game. Keep the location secret during preparation; on start assign one or two spies and location-specific occupations to civilians. The host configures 5–20 possible-location hints, a 1–10 minute speaking limit, and up to two spies, with two spies available only from six players. Speakers are repeatedly assigned at random until time expires. Civilians may nominate a suspect for a public majority vote; catching a spy makes civilians win, while a wrong majority accusation or expiry makes spies win.                                                                                                                                                                                                                                                                                                                                                                      | Confirmed                                                                                    |
| 2026-09-24 | Refactor the original 9UPPER route into a `RoomComponent` room shell and a child `NineUpperComponent` game module backed by one shared `NineUpperStore`. Centralize callable invocation and response validation for generated bonus-game content in `BonusGameAiService`, beginning with `generateNineUpperTopic`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-30 | Give all bonus-game pages a common iOS-safe presentation baseline: safe-area-aware viewport and Ionic toolbars, system-native Traditional Chinese font fallback, touch-first controls, and small-screen layouts that wrap rather than overflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-30 | In 「誰是偽藝術家」, completing the final player's second stroke starts a synchronized five-second final-artwork review before the existing 20-second secret vote; the voting screen continues to show the complete drawing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-30 | Add `傳情畫意` as an independent fourth bonus game, reusing the responsive signature-pad foundation without changing `誰是偽藝術家`. A non-playing host creates dynamically named QR-code groups, may reassign and order quick-join nickname/avatar players, and controls global pause/resume, per-group extensions, forced collection, and a manual projector reveal. Activity mode uses one hidden topic and one relay book per group: every player acts exactly once, alternating drawing and handwritten (not typed) guesses while seeing only the immediately previous page. Tabletop mode gives every player a distinct-topic book and continues until all books circle back. Drawing defaults to 75 seconds and guessing to 30 seconds, with host-selectable presets. Finished players can view only their own group in the UI and download a complete group PDF with cover, members, attributed pages, and original topic. | Confirmed                                                                                    |
| 2026-09-30 | Let `傳情畫意` players join either through a group-specific QR code or directly from the public game lobby. Lobby entrants first enter an unassigned waiting area and join any non-full group by selecting its card. During preparation they may leave their current group and return to the waiting area to correct a mistake. The non-playing host may move players or return them to the waiting area, and starting the game is blocked while any player remains unassigned.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-30 | Use a static `傳情畫意` topic pool made of common single-object nouns that can be drawn with a few outlines and identifying features. Exclude stories, actions, settings, characters, and overly obvious examples such as fruit or cars; keep the difficulty at recognizable but not instantly guessable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |

| 2026-09-30 | In `傳情畫意` tabletop mode, remove the group concept from the user interface: all participants join one table directly, and the host manages a single randomized, adjustable player order. Keep one hidden system relay container only as an implementation detail for circulating each player's book. Activity mode retains groups; when its unassigned-player allocator has no groups, show `尚無小組可分配` instead of an empty selector. | Confirmed |
| 2026-09-30 | Restrict `傳情畫意` PDF export by role. The non-playing host may export every player's book in tabletop mode or every group in activity mode as one combined PDF, and may still export one selected activity group. A tabletop player may export only the book originally assigned to them; an activity player may export only their own group's book. Enforce this in the store as well as the reveal UI. | Confirmed |
| 2026-09-30 | During `傳情畫意` public reveal, only the host sees the projector reveal controls; all players see a prompt to look at the large screen. When the host ends reveal, each player may review and export only their own group/book. Ended rooms are preserved for that review and are never reset by the host; each person may leave independently, while any later game uses a newly created room. | Confirmed |
| 2026-09-30 | The unauthenticated entry point now creates a Firebase Anonymous Authentication user instead of only switching to local Demo state. Anonymous players may use the game lobby and QR/direct game links under Firestore's authenticated-user rules; Google sign-in remains available and takes precedence when already present. | Confirmed |
| 2026-09-30 | In `傳情畫意` activity mode, an expired (or host-deferred) player moves to the final remaining turn without creating a skipped relay page. The following player inherits the same drawing or handwritten-guess task and timer; the deferred player remains eligible for the later final turn. If the final player expires, their timer restarts because no following player remains to inherit the task. | Confirmed |
| 2026-09-30 | `傳情畫意` requires 4–15 players in either mode. In activity mode, an odd-sized group gets one randomly selected non-first player appended as an extra final turn, ensuring the group relay always ends with a handwritten guess; the first player is excluded because they saw the original topic. The reveal controls include a direct jump to the final page for backwards playback. | Confirmed |
| 2026-09-30 | `傳情畫意` drawing and guessing timers may each be set to unlimited (`0` seconds). Unlimited turns never expire automatically and display `∞`; the host advances them using the existing per-group control, which follows the normal timeout/defer rule in activity mode and closes the outstanding tabletop round in tabletop mode. Pausing and resuming preserves their unlimited state. | Confirmed |
| 2026-09-30 | In `傳情畫意`, hide the host's global pause/resume control whenever no currently playing group has a finite timer. Before the host ends a current turn, show a confirmation dialog whenever there are unsubmitted players, naming them and explaining the applicable activity-mode defer or tabletop-mode skipped-page outcome. Make the unlimited-turn `結束目前回合` control visually larger. | Confirmed |
| 2026-09-30 | In `傳情畫意`, keep the Signature Pad event handlers explicitly synchronized with the player's active turn and restore them after a successful submission, preventing a visible-but-unwritable canvas. Replace the full-canvas clear control with `復原上一筆`; it removes only the most recent stroke and disables itself when no strokes remain. | Confirmed |
| 2026-09-30 | In `傳情畫意` activity-mode review, identify a relay book by its group name rather than an ordinal `第 X 冊`; tabletop mode retains ordinal book labels because it contains one book per player. | Confirmed |
| 2026-09-30 | Do not show, edit, or reroll an activity group's hidden topic in the host preparation UI, because the host screen may be projected to all players. Topics remain system-assigned and become visible only to the eligible first player and during the final public review. | Confirmed |
| 2026-09-30 | During activity-mode preparation, the host may delete any group. Deleting a populated group preserves its players in the room and automatically returns them to the unassigned waiting area for reassignment. | Confirmed |
| 2026-09-30 | During preparation, the host may remove a player from either activity-group or tabletop-player lists. The player is removed from the room roster and any group/order membership. A player choosing `離開房間` is likewise removed from the active room roster and local room/profile session; leaving is allowed in preparation or after the game ends, but not during play or public reveal so relay state remains intact. | Confirmed |
| 2026-09-30 | In activity-mode preparation, the remove control beside a grouped player means `移至未分組`: it preserves room membership and returns the player to the waiting area. The host can still explicitly kick an unassigned player from the waiting area. Tabletop mode retains direct player removal because it has no unassigned-group state. | Confirmed |
| 2026-09-30 | Anonymous `傳情畫意` quick join requires a department selection from 協理、設計、科研、運維、發展、開發、架構 and a nickname. Store and display the resulting player name as `科別-暱稱`; preserve that split when restoring a saved quick-join profile. | Confirmed |
| 2026-10-01 | Make `傳情畫意` host participation an explicit pre-game setting. In the default dedicated-host mode, the room owner is excluded from the player roster and uses their screen as the public display; during the relay they may review only submitted pages with each author's identity, never the hidden topic. In player-host mode, the room owner must join as a player while retaining pause, timing, skip, and force-collection controls; no in-progress public replay is shown, and the owner uses their screen for the normal final reveal. | Confirmed |
| 2026-10-01 | Add the same dedicated-host setting to `9UPPER` and `誰是偽藝術家`, while retaining player-host mode. In dedicated-host mode the owner is not a participant and assigns each joiner as a contestant or spectator before the game. Only contestants receive random game identities and take game actions; only spectators vote. `9UPPER` spectators have one `你是老實人` and one `你在公蝦毀` vote, each for a contestant. `誰是偽藝術家` spectators have one fake-artist vote for a contestant. The owner uses a desktop/projector layout: 9UPPER shows the question, hints, current speaker, and aggregate votes; Fake Artist shows the category but never the drawing word, along with current drawer, stroke attribution, and aggregate votes. Participant and spectator interfaces remain phone-first. | Confirmed |
| 2026-10-01 | Extend `傳情畫意`'s anonymous quick-join experience to `9UPPER` and `誰是偽藝術家`: before becoming a player, a joiner chooses a temporary avatar and nickname. Save that room-specific choice locally to prefill a later re-entry, while still allowing it to be changed before joining. A dedicated-host owner remains a non-playing host and does not need a player profile; a player-host must complete the same identity step. | Confirmed |
| 2026-10-01 | In `9UPPER` dedicated-host mode, every spectator is collectively a `猜題人`; contestants receive exactly one `老實人` identity and otherwise `唬爛人`, never `猜題人`. Require at least one spectator before the host can start. The preparation roster displays separate contestant and spectator cards; player-host mode retains its original unified roster and individual guesser flow. | Confirmed |
| 2026-10-01 | Determine `9UPPER` room ownership from the Firebase Authentication principal recorded at room creation, not a potentially stale global session/Demo identity. In dedicated-host mode this makes the creating device the sole default projector host. | Confirmed |
| 2026-10-01 | Use one 16:9 logical drawing canvas for every `誰是偽藝術家` player view and its dedicated-host projector. Stored normalized strokes therefore retain their geometry when viewed on a phone, a different phone, or the large display. | Confirmed |

| 2026-10-01 | Increase the bonus-game room-name limit from 8 to 20 characters for both room creation and room editing. | Confirmed |
| 2026-10-01 | During `傳情畫意` dedicated-host play, the in-progress projector replay shows only completed drawing pages and each drawing's author. It never displays handwritten guesses, skipped pages, group switchers, or book selectors. The host can choose manual previous/next navigation or a five-second automatic slideshow across all completed drawings. | Confirmed |
| 2026-10-01 | In `傳情畫意` public reveal, the host and player views use the same stable, viewport-filling stage-frame height for the initial topic cover and all later artwork pages. The public-reveal view removes unrelated bottom content padding so it does not create a needless page scrollbar. | Confirmed |
| 2026-10-01 | In `傳情畫意` public reveal, phones taller than 700px restore the original 58dvh artwork limit. Only compact screens at most 390px wide and 700px tall (including iPhone SE) use the single-row author layout and a fixed, nonzero 25dvh drawing/guess size, keeping artwork inside the frame without shrinking larger phones. | Confirmed |
| 2026-10-01 | In `傳情畫意` activity mode, assign each group's hidden topic only when the game starts, by shuffling the static topic pool. Do not reuse a topic stored during preparation, so every game start draws anew and groups receive distinct topics until the pool is exhausted. | Confirmed |
| 2026-10-01 | Set newly created `傳情畫意` rooms to unlimited drawing and guessing timers (`0` seconds) by default; the host may still select a finite preset before starting. | Confirmed; supersedes the earlier 75/30-second default |
| 2026-10-05 | Pause bonus-game development and return delivery focus to the walking-map and task-acquisition main demo path. Investigate a Mapbox-style map renderer because the desired visual direction resembles location-based walking games; the final map-provider choice remains open pending feasibility, cost, and technical-spike results. | Confirmed focus; provider undecided |
| 2026-10-05 | Keep the user's live location in a shared, in-memory `LocationStore`, keep route and Demo movement progress in a separate `WalkSessionStore`, and keep only task-specific location evidence snapshots in `TaskStore`. The location store may expose current position, permission, tracking state, source (`gps` or `demo`), and lifecycle controls; raw coordinates and complete walking tracks must not be persisted or logged. | Confirmed |
| 2026-10-05 | Retain `SessionStore` as the shared account-context seam. It now owns the Firebase identity summary, the Firestore profile snapshot, Demo/normal data scope, authentication/session status, and common profile selectors such as display name, portrait, email, daily goal, and profile loading/error state. Location, walking progress, inventory, tasks, collection, wallet, and bonus-game state remain separate stores. | Confirmed |
| 2026-10-13 | Keep Home map camera effects behind a feature-scoped `MapCameraController`. `WalkSessionStore` owns the Home walk phase, selected destination, route, and progress; `LocationStore` owns only live location concerns. The Mapbox map instance, sources, layers, listeners, readiness, and camera animation implementation remain inside `HomeMapComponent`. Home stage components emit domain events and never call Mapbox methods or reference layer/source IDs. Camera intents issued before map readiness use latest-intent-wins replay; walking location updates move the player marker without repeatedly refitting the route. | Confirmed |
| 2026-10-13 | The Home planning Demo shows at least five tree markers near the seeded starting point and three recommended trees. Recommendations first prefer candidates estimated at no more than 8,000 steps (the 7,500-step goal plus a small tolerance), then rank by the remaining growth needed for the next harvest and walking distance; farther candidates only fill a shortage. Selecting either a map marker or recommendation card uses the same route-selection flow, draws the seeded route, and fits the player, route, and target into the camera view. These are Demo tree markers and do not resolve the separate open decision on the six curated public task POIs. | Confirmed |
| 2026-10-13 | Use one provider-neutral `GeoPoint` shape for domain coordinates. `LocationPoint` extends it with accuracy, observation time, heading, and speed metadata; Mapbox `LngLat` remains confined to the map adapter. Both recommended and currently selected Home trees use the same recommendation enrichment so estimated steps, harvest status, and remaining growth stay consistent. | Confirmed |
| 2026-10-14 | Disable Ionic Router Outlet's swipe-to-go-back gesture and set `overscroll-behavior-x: none` on the document and Ionic scroll surface to prevent browser-level horizontal overscroll navigation inside the SPA. | Confirmed |

| 2026-10-19 | Add Azure Boards story US15.4 #1925623 under F15 #1882634 for the 2026-11-09 final presentation PowerPoint. Cover the user problem, target audience, core experience, business value, Demo scope/results and recommendations; distinguish mocked or unimplemented capabilities and provide an offline projection copy. Estimate: 12 hours / 3 Story Points, Must, Sprint 4. | Confirmed |
| 2026-10-19 | Require US15.4's final deck to address the supplied judging rubric: technical feasibility, business applicability, proposal completeness and BONUS items. Include cloud services, Agent/AI integration, architecture and PoC; user/business value, costs, ROI and scale assumptions; problem/solution fit, security/compliance/privacy and UX; plus presentation quality, teamwork/Q&A and distinctive project merits. | Confirmed |
| 2026-10-19 | Record the 2026-10-01 bonus-game load test as US14.5 #1925760 under F14 #1882629, with Tasks #1925761–#1925768. The user confirmed approximately 70 simultaneous participants against an original 100-person plan; exact run times, version, measured peak, success rate and the 100-person retest remain unverified. At registration, three Tasks were Closed, four Active and one New; the Story was Developing. This process uses Developing for in-progress Stories and Active for Tasks. Preserve the records, billing evidence and source hashes under docs/azure-boards/; three original CSVs are attached to the Story. Effort, Story Points and future scheduling remain unconfirmed and are not added to F14's original 4 pd baseline. | Confirmed |
| 2026-10-19 | Billing now loads and the user confirmed USD. The 2026-10-01 billing-day net cost is US$0.057720: Gemini US$0.037512 and Firestore reads US$0.020208. Recorded usage includes 108,637 reads, 1,145 writes, 3 deletes, 3,309 input and 9,342 output Tokens. Use 2026-09-10 only as a low-activity Firestore comparison and 2026-09-28 as an AI-active development-day comparison, not matched idle baselines. Whole billing-day totals are not isolated test or per-user costs and do not prove 100-user or walking-main-flow capacity. Functions invocation SKU usage is not the Gemini request count; zero net cost does not mean zero resource use. See docs/azure-boards/load-test-20261001.work-items.json and evidence/. | Confirmed |

## Open decisions

### Home task-point planning update (2026-10-14; merged 2026-10-15)

- Home planning combines destination selection and optional supply-station selection in one screen. After stations change, `更新預覽路線` updates the visible continuous route for review while remaining in planning. Only an up-to-date, successfully loaded preview enables the separate `確認路線` action to enter the active-route idle-style dashboard. Selecting a destination or adding a station never starts Walking automatically.
- As soon as a selected destination's main route is available, preview all extra supply stations on the map. Preview markers become interactive as soon as their challenge routes finish loading, without an intermediate destination-confirmation step.
- Task candidates are virtual Demo challenges generated from anchors along the original route: five water points and exactly one farther fertilizer point. Their initial placement targets 800–1,000 and 2,000–3,000 extra steps respectively, but the user confirmed retaining all six and displaying Mapbox's actual road-distance-based estimates even when outside those ranges. Adding detours does not expand the eligible candidate set.
- Do not present nearby task points as bottom cards. Keep tree recommendations, the map-station hint, and final confirmation together in the bottom panel. Players may change the destination after adding stations; doing so clears the previous station selection. Back cancels the whole plan and returns to idle.
- The user superseded the schematic-routing decision: use Mapbox Directions v5 `mapbox/walking`, with full GeoJSON geometry. Draw returned road geometry, never direct-line connectors or a silent seeded fallback. Display loading/error states and offer retry; block confirmation until routing succeeds. Coordinates are transmitted transiently to Mapbox for these user-requested routes and are not persisted or logged.
- Per endpoint selection, request one main route and six independent challenge previews in parallel after it loads. These out-and-back previews only estimate a single challenge's cost; they must not be stitched into the walking route as branches.
- Task selection is a draft. Pressing `更新預覽路線` requests one continuous route when the selected stations have changed, with waypoints ordered along the original route: origin → selected task points → destination, without mandatory returns to the original anchors. Keep the last successful route/distance visible with an explicit stale-result notice until preview updating succeeds; block confirmation until the selected set matches the successful routed set. Updating the preview does not enter Walking; explicit confirmation is still required. An error keeps planning open for retry.
- Updating a new task combination adds one Directions request (at most eight coordinates). Cache completed combinations in memory for the current plan; reusing a cached combination adds no API calls, and removing all tasks restores the original route without a call. Clear this cache on endpoint changes/cancellation/leaving Home. Abort superseded/cancelled requests, discard stale responses, and use a 20-second timeout per request. A cancelled request already sent to Mapbox may still count toward quota/billing.
- Adding/removing task points must not move the map camera. Planning camera framing follows the original route and candidate points, not task-selection detours; destination selection may frame the route, while confirmed departure switches to player-follow navigation.
- After selecting a destination, frame the map using the actual rendered upper/lower planning-panel edges rather than fixed screen percentages. Orient the destination toward the top and the player toward the bottom, placing both as close to the visible gap edges as route/candidate visibility allows. Reserve marker clearance so neither endpoint hides under a card; short routes may zoom closer than the old 15.5 limit. Task toggles still do not reframe the camera.
- Apply a small +0.15 zoom adjustment to the fitted planning camera after destination selection (capped at zoom 19), per the user's visual-tuning request. Use one camera animation rather than a second zoom after fitting. Walking navigation uses the separately defined follow-player camera instead of a fitted overview.
- Remove all green planting-task points from the Home route-planning map; keep the existing tree destination markers and the separate planting-task product concept unchanged. Demo water/fertilizer coordinates are generated per route, not approved public POIs, and do not resolve the six-POI field-check decision below.
- The displayed total distance/steps come from the complete updated Directions route, at 0.75 m/step, not the sum of independent challenge estimates. Marker estimates remain single-point references because a continuous route may share detours. Mapbox may still require a real-world U-turn or retracing a dead-end; the app no longer forces an out-and-back branch for each task.
- Selected task points belong to the current in-memory walk, remain visible after departure, and clear when the destination changes or the walk is cancelled. Adding points does not complete tasks, consume a seed, or award resources; check-in and task completion remain separate work.

### Home Demo supply-station and endpoint check-ins (2026-10-15)

- The user requested explicit supply-station check-in within the existing configurable 500 m cultivation radius, using the same Ionic modal pattern as tree care. Selected stations remain clickable during an active walk. The later interaction-feedback request supersedes the original disabled remote claim button: remote attempts show the shared proximity toast without granting resources. Revalidate location/session on submission.
- Supply rewards come from each station's `supply`, not its challenge kind or a fixed multiplier. The user approved adjusting this attribute: use typed `{ resource: 'water' | 'fertilizer', amount: positive integer }` data for preview labels, confirmation totals and actual inventory credit. Preserve the existing six stations' 10-water values unless their settings are changed.
- On 2026-10-16, the user changed the claim limit to once per station per Taipei calendar day across in-memory walks. The shared ProgressStore records the last successful claim day by station ID; each distinct station remains independently claimable. A new day allows another claim, while reload resets this Demo-only claim state along with its mock inventory.
- Proximity, opening the modal, or dismissing it does not grant resources; successful submission updates the shared inventory and records both daily station and current-walk claim status. Cancellation/completion/new planning clears only current-walk tracking, not the daily claim record or inventory already earned. Invalid reward settings, stale sessions, daily duplicates and range failures show explicit errors.
- The user confirmed that `確認打卡終點` completes the walk and clears the route rather than only marking arrival. Add this button only to the active destination's existing tree-care modal, subject to the same radius; keep care open afterward with an idle return phase and a completion message. Other trees retain ordinary care. No additional endpoint reward or requirement to claim all optional stations is introduced.
- This is a location-based Home Demo flow, not the production photo-check-in/backend task pipeline or daily-reward economics. No photo upload or real reward integration is added; state resets on reload.

### Home supply-station spinning interaction

- The user replaced the station claim button with horizontal icon spinning, inspired by the interaction concept rather than copied artwork. The user confirmed that actual flick speed determines momentum: slow flicks may rotate only slightly, fast flicks may continue rotating, and completing one revolution triggers a claim attempt. Do not force a small swipe to complete a turn. Use the existing original station icon.
- Revalidate live range, route and claim state at the full-turn threshold through the existing Home/store flow. Multiple revolutions from one flick must not repeatedly submit or duplicate supplies; successful status derives from credited store state. Keep remote attempts available for proximity feedback.
- The user requires station closure to match cultivation: full-height `[0, 1]` sheet, handle-only gesture dismissal, boolean `canDismiss`, no backdrop dismissal, and content gesture propagation blocked. Stop pending spinning and dismiss the shared warning at `willDismiss`, not after the closing animation. Destruction also releases listeners/capture and dismisses the overlay.
- Implementation details: signed rotation tracks net progress, partial turns persist during one opening, and reversing unwinds them. A new gesture after an attempted full turn starts fresh progress. Arrow keys provide 45-degree steps; reduced motion suppresses visual 3D rotation while preserving real progress and claim validation. These are implementation defaults, not additional user-confirmed product rules.

### Home endpoint settlement dialog (2026-10-15)

- Successful destination check-in opens a white, rounded settlement dialog matching the supplied reference: a success heading, encouragement, duration and claimed-station badges, a steps/distance card, and gray resource rows with orange earned amounts and current balances. Its only button is `太棒了!`; it does not navigate to a game.
- Show actual steps recorded after departure, estimated traveled distance at the existing 0.75 m/step rate, elapsed whole minutes, and only successfully claimed station supplies. Show light and water rows even when zero; include fertilizer when earned. Step/light accounting uses cumulative counters so spending resources or a Taipei-day rollover does not distort the result.
- Snapshot the result before clearing route/session data; endpoint completion grants no additional resources. Preserve the open tree-care modal and its idle return phase. The result is in-memory Demo data, not persisted across reloads.
- Per the user's request, validate with unit tests and build only; do not open a browser for this increment.

### Home walking recenter button (2026-10-14)

- The walking screen's recenter button enables continuous player following through a `MapCameraController` follow-player intent, initially returning to the latest `LocationStore` position with a 500 ms animation and zoom 17. On 2026-10-15, the user confirmed pitch 50 degrees and heading-up navigation instead of the previous north-up, flat-pitch camera; use north-up only until a simulated heading is available.
- On confirmed departure (2026-10-15), automatically use the same follow-player camera instead of fitting a walking-route overview. Cancelled or blocked departure does not enable following. Manual map dragging, rotation, or pitch adjustment pauses following until recenter is pressed; arrival and returning from cultivation preserve that choice rather than reframing the route or re-enabling following.
- The user superseded the original one-shot recenter behavior: while following is active, location updates move both the player marker and camera center without repeatedly refitting the route or resetting zoom or pitch. Camera bearing follows valid simulated heading; missing heading preserves the current bearing. Manual map dragging, rotation, or pitch adjustment cancels following; pressing the button enables it again. Zoom-only changes (wheel, pinch, double-click, or zoom buttons) retain following and the user's selected zoom, per the 2026-10-15 request; do not cancel on generic map movement events, since zoom also emits them. Other camera intents and map detachment/errors also clear following. The walking session and route remain unchanged, and a missing current position shows an explicit message.
- Web joystick movement simulates user facing as a clockwise-from-north heading, retained when the joystick is released. A blue directional arrow rotates with that heading even while camera following is paused. Camera rotation alone must not change the joystick's current geographic movement direction. This increment does not read phone compass/orientation sensors.
- The user subsequently clarified the joystick controls on 2026-10-15: 0 degrees moves forward, holding 90/270 degrees continuously turns right/left in place, and 180 degrees moves backward without reversing the player's facing. Split forward/back translation from steering; pure rotation awards no simulated steps. Initialize from the player's last heading (map bearing only when heading is unavailable), and do not feed following-camera rotation back into steering. This supersedes fixed absolute heading targets per gesture.
- After trying the hybrid pointer-correction behavior, the user confirmed pure forward/backward plus left/right rate steering on 2026-10-15. Horizontal stick displacement controls signed turn speed, and vertical displacement controls signed movement speed relative to the player's facing. Moving a right-side stick from 30 to 20 degrees reduces right-turn speed rather than briefly turning left; mirror this on the left. Remove angular pointer-delta corrections entirely. Apply 0.25-second angular-velocity damping to changes in turn speed, including crossing from right to left. Backward input does not reinterpret 180 degrees as a turn-around command. Neutral horizontal input stops turning; dead-zone entry and release stop all movement/turning immediately and preserve the last facing.
- On 2026-10-16, the user confirmed separate joystick rules based on camera follow mode. While following, retain forward/backward movement plus left/right turn-rate steering. When not following, move directly in the screen-relative stick direction at a speed determined by radial strength, with facing smoothly following movement via the existing shortest-arc heading damping; right/left input translates rather than rotating in place, and downward input moves toward the screen bottom rather than preserving facing in reverse. Read the shared `MapCameraController` follow state when a gesture starts. The user confirmed deferring mode changes until release and the next gesture; keep the gesture's map-bearing reference fixed as well to avoid recenter-induced rotation feeding back into ongoing screen-relative movement. Both modes retain dead-zone handling, elapsed-time limits, and step credit only for translation.
- Maximum held turn speed is initially 90 degrees/second, configured by `DEMO_JOYSTICK_TURN_SPEED_DEGREES_PER_SECOND`. Integrate angular velocity by elapsed time, wrap heading through 0/360 degrees, and cap each frame's simulation elapsed time at 0.1 seconds to avoid background catch-up. Both the player arrow and follow camera consume the same facing heading, independently of forward/backward movement direction.
- Per the 2026-10-15 dead-zone request, apply a radial joystick dead zone. Initial tuning is 15% of maximum knob travel, controlled by `DEMO_JOYSTICK_DEAD_ZONE_RATIO` in `client/src/environments/environment-dev.ts`. Inside or at that radius, do not move, change heading, or add simulated steps; retain visual knob feedback. Outside it, remap remaining travel continuously from zero to full strength, preserving direction and capping diagonal input at full speed. Returning to the dead zone stops movement immediately without resetting the last heading.
- Demo recentering uses the simulated player position; this change does not implement device GPS acquisition or permission handling.
- Render the recenter control as a 48 by 48 px circular, icon-only Ionic button with zero horizontal padding and a 50% border radius, rather than relying on the pill-shaped `shape="round"` default.
- The button's active appearance and `aria-pressed` reflect follow mode rather than coincidental geometric centering. A missing current position hides the active appearance until a position returns. The controller separately retains actual player-center status with an 8 CSS-pixel tolerance; map movements and location changes refresh that measurement.
- On 2026-10-15, the user tried Mapbox's experimental `clip` layer to remove foreground buildings/models in a navigation corridor. The clip layer cannot reuse the native zoom-out building shrink/disappear transition; the user declined replacing Standard buildings with custom building layers.
- Later on 2026-10-15, the user explicitly requested removing the clip effect. Remove the clip source/layer, corridor geometry, update scheduling and clip-only tests. Retain normal Standard 3D buildings, trees and landmark models, as well as pitch 50 navigation, heading smoothing, zoom-preserving following, route rendering and check-ins. No automatic building-occlusion removal is currently applied.

### External follow-ups

1. Firebase App Distribution and personal-device installation remain pending company approval; browser delivery is the Must fallback.
2. `光能` and `Cathay Walk | 國泰健康走` are working names subject to later internal naming review.
3. Three.js remains optional and only proceeds after its spike gate.
4. Confirm the capacity reconciliation: core-path feature complete on 2026-10-21, all Must complete on 2026-11-05.
5. Select and field-check the exact six public POIs before freezing task seed data.
6. Choose the map renderer/provider after the Mapbox feasibility assessment and a focused visual/performance spike; preserve deterministic seeded routes and the existing map-failure fallback regardless of provider.

The product design frontier is closed. Any later scope change must be recorded as a new decision rather than silently replacing this baseline.

### Collection Demo data connection (2026-10-20)

- User requested collection use the existing mock Demo tree data. Cards now
  derive names, species and POI locations from homeTreesWithProgress, and
  planting dates, growth stages and harvest readiness from ProgressStore.
  Exclude empty planting spots until planted; exclude the internal demo-tree.
  Preserve the existing two-column layout. Replace the mountain placeholder
  with the existing botanical tree illustration (a shared image, not a
  stage-specific model). Planting dates use Taipei time.
- The existing planting/harvest segments reflect current cultivation state;
  harvested trees follow the existing recovery lifecycle, not a permanent
  harvest archive. Long-absence duration and historical harvest retention
  remain unresolved; show an explicit pending-definition message for absence.

### Profile reference layout (2026-10-21)

- Match the supplied profile reference with four compact white sections: player
  level, 百樹夥伴 progress toward 100 trees, walking statistics, and recent
  transactions. Use olive progress bars, orange highlights, pale statistic cards
  and compact transaction rows. Ignore the blue dotted guides and green numbered
  comment markers in the reference. Preserve the existing shared identity header.
- Retain existing level/step preview values and the logout action. Reuse ShopStore
  for Demo lifetime mature-tree counts and the latest three transactions, linking
  查看全部 to /shop/history. Do not present seeded shop records as normal-account
  profile data. Real profile XP/statistics and normal-account shop integration
  remain unresolved; screenshot values do not define new reward rules.

### CMS feedback presentation (2026-10-21)

- User requires CMS informational feedback to use rootNgV2 toast notifications and errors to use dialogs, replacing the shell's inline alerts.

### Catalog table ownership (2026-10-21)

- The user requests the catalog table be implemented within the individual CMS
  pages so each can be tuned independently. Merchants, rewards, scenes, tasks
  and trees own their table markup and rootNgV2 imports; shared workspace state
  continues to provide row data and CRUD operations.

### Cultivation tree location and weather row (2026-10-27)

- Show the tree's place name and its weather/time/source details together in a
  shared information row beneath the tree name. Allow wrapping when the card is
  too narrow to fit both details on one line.
- Give the cultivation status chips solid, opaque backgrounds while retaining
  each status color and its matching contrast text color. Avoid Ionic's `color`
  attribute here because its chip host style forces a translucent background;
  use explicit status classes and the chip background/color variables instead.

## Reward avatar images (2026-10-21)

- User requires the CMS image preview to be 1:1. Use a 160px square with a centered icon; this specific sizing implements the requested preview geometry alongside existing rootNgV2 utilities.

- User requests reward create/edit image settings using a simple icon and background color avatar, without arbitrary image uploads. Icon choices come from the supplied cub_icon_name.txt and render as span.cub-icon-{name}.
- Implementation uses the supplied icon allowlist and six pastel background options, persisted through draft/publication and displayed in the CMS list and client catalog/details. Older records fall back to gift-money on mint green.

### Catalog table ownership (2026-10-21)

- The user requests the catalog table be implemented within individual CMS pages so each can be tuned independently. Merchants, rewards, scenes, tasks and trees own their table markup and rootNgV2 imports; shared workspace state continues to provide row data and CRUD operations.
