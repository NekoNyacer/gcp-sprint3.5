# CAT WALK project context

Last updated: 2026-09-24

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
- Tree visual thresholds are 0 seed, 500 seedling, 1,500 young tree, 3,000 mature tree, and 5,000 large tree.
- Every cumulative 5,000 growth value enables a 50 `小樹點` harvest without removing or resetting the tree. Later milestones are 10,000, 15,000, 20,000, and so on.
- After rendered size reaches a sensible limit, later levels use rings, stars, seasonal decoration, and resident animals rather than unbounded physical scale.
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
  - `光能` (working name): the common step-generated resource. The team may rename it later without changing its mechanics. From 0–5,000 daily steps, each completed 500-step block grants 3 `光能`, totaling 30. From 5,001–7,500, each additional completed 500-step block grants 4, bringing the daily total to 50. Steps above 7,500 remain visible but grant no additional `光能`. One `光能` becomes one tree-growth value when allocated.
  - `水滴`: acquired by reaching and checking in at a designated public water-source task point. Each eligible source grants one per day, and one `水滴` provides 10 tree-growth value.
  - `肥料`: acquired from a pickup-and-delivery task. One use gives the current allocation a 20% growth bonus, limited to once per tree per day.
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
- The nurture interaction uses a light-energy amount slider plus optional water/fertilizer toggles. Before confirmation it previews each resource deduction, base growth, bonuses, and resulting tree progress. Confirmed resource spending is integer-valued and cannot be undone.
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
- Weather API, Firebase Cloud Messaging, and a content-management UI.
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
- No content-management UI is included. Tree types, curated tasks, mock catalog items, and leaderboard profiles are versioned seed data.

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

- Three.js is a Could item rather than a Demo requirement. If capacity permits, use it only as a controlled, reusable 3D tree showcase, not as a 3D game world.
- Use direct `three` integration rather than an Angular-specific wrapper. Pin an exact version for the project.
- Reuse one `TreeSceneComponent` on the home dashboard, task-growth result, and memory-tree detail.
- Keep Google Maps, route preview, collection-map markers, lists, navigation, and all required workflows independent of Three.js.
- Generate three stylized low-poly tree species and four growth stages parametrically rather than commissioning twelve separate detailed models.
- The provisional art direction is warm, stylized low-poly geometry led by Cathay green with restrained seasonal color variation. The UI/UX advisor will review this direction before optional implementation.
- Use a short `THREE.Points` particle burst with approximately 128–256 leaves or light points for growth and reward celebrations. Do not add a separate particle engine.
- Keep a permanent WebP/SVG/CSS fallback for WebGL initialization, context-loss, performance, or reduced-motion cases.
- Allow only one active renderer at a time. Stop animation when an Ionic page is left, the tab is hidden, or no animation is required.
- Cap mobile device pixel ratio, avoid real-time shadows and post-processing, and dispose all Three.js resources explicitly.
- Run a two-person-day spike before committing the feature. Test desktop Chrome, S22+ Chrome, and later the Android WebView.
- Spike acceptance targets:
  - At least 30 FPS during the particle effect on S22+, targeting 45–60 FPS.
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

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-09-03 | Use Azure Boards for project planning.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Time-box delivery to two months and prioritize demo completeness over production integrations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Keep the shared Matt Pocock skills inside this repository under `skills-main/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | `CAT` refers to the Cathay project prefix; the app must not use a cat theme.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Use planting and growing trees as the central activity-reward metaphor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Target office workers who can be encouraged to walk farther after work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Make a browser-based simulated demo the minimum interactive delivery and Android real-device support the preferred delivery.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Include photo check-ins in the intended experience.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Superseded by the confirmed planting, water, and delivery photo rules                        |
| 2026-09-03 | Use GCP serverless services for backend responsibilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Superseded by the confirmed Firebase plus five TypeScript-functions architecture             |
| 2026-09-03 | Develop through 2026-11-05 and present on 2026-11-09 at Google's Banqiao office.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-03 | Treat the target Azure Boards hierarchy as Epic → Feature → User Story → Task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed; underlying process is likely Agile and still requires verification                |
| 2026-09-03 | Position CAT WALK as a standalone public concept rather than an employee-only or existing-policyholder-only feature.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Differentiate from `健康吧` through active walking tasks and game-like objectives while retaining passive Android step totals.                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Use mock `小樹點` to demonstrate reward value without a production loyalty integration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Superseded by the confirmed 5,000-growth harvest and catalog rules                           |
| 2026-09-03 | Use Traditional Chinese only for the demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Estimate Epic/Feature scope in person-days and User Story/Task execution in hours.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Provide a seeded local Demo Mode alongside the primary online GCP path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Adopt the Must/Should/Could platform priority described in this document.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Store each persistent tree in a location-associated personal forest so it can become a memory tied to past walks.                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Count unique daily steps once as an unallocated growth resource; use active check-ins and tasks to grant distinct water, fertilizer, or item resources.                                                                                                                                                                                                                                                                                                                                                                                                       | Superseded by the confirmed `光能` / `水滴` / `肥料` formulas; `光能` remains a working name |
| 2026-09-03 | Demonstrate mock `小樹點` through a balance, small reward catalog, and ESG donation option.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | Use waypoint photos for pickup, delivery, or arrival without AI image validation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Keep individual progression as core and treat a seeded weekly leaderboard as optional; defer real friend interactions.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Allow official Cathay brand resources in the internal demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | Use the available USD 500 GCP budget and approved GCP services.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Make the .NET engineer the overall technical, product, integration, and backend-coordination owner; treat Java engineers as supporting contributors.                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Use the personal Samsung Galaxy S22+ as the fallback Android test device and plan for APK distribution without a USB connection.                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed in principle; company policy and distribution channel remain open                  |
| 2026-09-03 | Keep location-associated trees private and store a Place ID, landmark name, and obfuscated coordinate rather than an exposed exact point.                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Allow several persistent trees to grow through repeat milestones rather than maturing once and disappearing or becoming inactive.                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed; this supersedes the earlier single-tree 5–7 day lifecycle                         |
| 2026-09-03 | Support one-way and return-to-origin active tasks, constrained around the user's home/work corridor, with one pickup-to-delivery objective per task.                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed; exact anchors remain device-local and transient in route calls                    |
| 2026-09-03 | Make rules-based smart route recommendation mandatory and Gemini enhancement optional but desirable for the Google-office presentation.                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Curate three tasks around each of Xihu MRT Station and Google's Banqiao office rather than supporting arbitrary locations in the Demo.                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Use GPS arrival in normal mode with simulated arrival always available in Demo Mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Avoid Java and .NET application backends; use Firebase-managed services plus a minimal five-function TypeScript trusted command layer.                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed; expanded from four after resource allocation became a separate domain command     |
| 2026-09-03 | Use the documented Demo content and privacy baselines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Design the main presentation as a five-minute happy path, plus two-minute and prerecorded fallbacks.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Keep exact home/work anchors device-local and transmit them only transiently for route calculation.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Show memories and a seasonal collectible on tree revisits without issuing repeat `小樹點`; define a separate same-area replant loop.                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed through private memory groves, repeat planting, and once-per-day task rewards      |
| 2026-09-03 | Use structured route preferences as Must and optional Gemini free-text interpretation with deterministic fallback as Should.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Use Firebase Web Google Sign-In and spike a community Android Firebase plugin before falling back to an official Credential Manager bridge.                                                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | Use Firebase App Distribution for signed APK delivery if company policy permits personal-device testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Pending company confirmation                                                                 |
| 2026-09-03 | Use the documented TypeScript/Firebase ownership split and primary UI surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Constrain task detours by extra walking time and bounded deviation from the user's current commute direction.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-03 | Treat Three.js as optional after a two-person-day spike; the Demo remains complete with its 2D fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed                                                                                    |
| 2026-09-03 | Calibrate rewards against `健康吧`: steps earn non-cash activity points, 5,000 activity points convert to 50 `小樹點`, and `小樹點` retain a 1:1 NTD reference.                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed; Demo resource, milestone, and catalog amounts are now specified                   |
| 2026-09-03 | Use versioned seed files rather than building a content-management interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-03 | Make in-app reminders Must, Android local notifications Should, and Firebase Cloud Messaging out of scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Use the documented failure fallbacks for Gemini, Routes, permissions, uploads, GCP, WebGL, and sign-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Use the documented Sprint 0–4 calendar, finish Must scope by 2026-10-21, and freeze features after 2026-11-05.                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Permit multiple simultaneously cultivated trees and let users allocate accumulated resources among them while near a tree.                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Group repeated plantings at one landmark into a private memory grove and allow route replay with daily reward limits.                                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Use `光能` as the working step resource, plus `水滴`, `肥料`, and optional special items with the documented acquisition and growth effects.                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed; the team may later rename `光能` without changing mechanics                       |
| 2026-09-03 | Include friend contributions as non-monetary collaborative growth, represented only by seeded data in the Demo.                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Use a warm Cathay-green low-poly art direction if the optional Three.js spike passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Provisional pending UI/UX review                                                             |
| 2026-09-03 | Treat `CAT-WALK` as the internal code name and use `Cathay Go｜大樹同行` as the working Demo name.                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Superseded by the `Cathay Walk                                                               | 國泰健康走` Demo naming decision on 2026-09-08 |
| 2026-09-03 | Apply the documented definition of done to every Must user story.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-03 | Harvest 50 mock `小樹點` at every cumulative 5,000 tree-growth milestone without resetting the persistent tree, limited to one harvest per account per day in the Demo.                                                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-03 | Require a seed plus a planting task and public-point photo check-in to create a tree; give new users one starter seed.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Allow unlimited historical trees, group them by memory grove, and pin at most three followed trees on the dashboard.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Limit special-item scope to one optional seeded `鳥巢`/resident-bird effect; omit real pest and tree-death systems.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Use planting, water, and nutrient-delivery as the three task types, with the documented photo and daily-award rules.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-03 | Require approximate 150-meter proximity for resource investment and harvest; show a non-reversible transaction preview and allow Demo Mode proximity.                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Restrict Demo planting to six curated public points and keep home/work as device-local route anchors only.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Confirmed                                                                                    |
| 2026-09-03 | Use four bottom tabs and progressive, just-in-time onboarding for the three-resource system.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Confirmed                                                                                    |
| 2026-09-03 | Omit live Weather API integration; any Demo weather is cosmetic and economically neutral.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Confirmed                                                                                    |
| 2026-09-03 | Use the documented five-minute multi-resource presentation path and its two-minute preseeded fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-03 | Default the opt-in after-work reminder to 17:30, suppress it after goal completion, and omit background geofencing.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Persist Demo resources without expiry or caps; defer production inflation controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Reconcile daily step sources by maximum cumulative total, isolate all simulated records with `isDemo=true`, and use the `Asia/Taipei` day boundary.                                                                                                                                                                                                                                                                                                                                                                                                           | Confirmed                                                                                    |
| 2026-09-03 | Permit remote tree care but require physical proximity for an eligible `小樹點` harvest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Confirmed for Demo; revisit for production operations                                        |
| 2026-09-03 | Clearly badge and isolate Demo Mode, with presenter controls and one-click five-minute/two-minute seed states.                                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-03 | Use the documented Windows browser, responsive layout, S22+, and performance acceptance matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confirmed                                                                                    |
| 2026-09-03 | Use Emulator Suite locally, one shared Demo Firebase project, Preview Channels, seed/reset scripts, structured logs, budget alerts, and no production environment.                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Freeze the documented final Must/Should/Could/out-of-scope priority matrix for backlog planning.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-03 | Award `光能` progressively per completed 500-step block while preserving the daily totals of 30 at 5,000 steps and 50 at 7,500 steps.                                                                                                                                                                                                                                                                                                                                                                                                                         | Confirmed                                                                                    |
| 2026-09-03 | Do not queue multiple harvest milestones; allow one account-wide `harvestReady` milestone and atomically reject allocations that would cross another unavailable threshold.                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-03 | End the `grill-me` / `grilling` discovery phase and generate implementation, estimate, and Azure Boards artifacts.                                                                                                                                                                                                                                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-03 | Use six versioned, manually reviewed route templates plus deterministic ranking as the date-safe Must implementation; treat arbitrary live route generation as earned scope.                                                                                                                                                                                                                                                                                                                                                                                  | Planning baseline                                                                            |
| 2026-09-03 | Interpret 2026-10-21 as core-path feature complete and 2026-11-05 as all-Must complete because the confirmed all-Must-by-10/21 goal exceeds conservative capacity.                                                                                                                                                                                                                                                                                                                                                                                            | Recommended; awaiting product-owner confirmation                                             |
| 2026-09-03 | Use the full Azure Boards import CSV after a target-project sample export confirmed `Epic`, `Feature`, `User Story`, `Acceptance Criteria`, `Priority`, and `Story Points`.                                                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-07 | Start UI implementation with a responsive, mock-data Dashboard prototype covering daily steps, resources, a recommended task, followed trees, Demo controls, and four-tab navigation; defer final visual polish and data integration for later UI/UX and feature work.                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-08 | Use NgRx Signal Store 22 for client state management. Temporarily configure client npm installs with `legacy-peer-deps=true` because AngularFire 20.0.1 still declares Angular 20-only peers; NgRx 22 itself supports Angular 22.                                                                                                                                                                                                                                                                                                                             | Confirmed                                                                                    |
| 2026-09-08 | Upgrade AngularFire from 20.0.1 to the explicitly pinned 21.0.0-rc.0 prerelease, accepting Firebase JS SDK 12 as a transitive dependency. Retain `legacy-peer-deps=true` because this AngularFire release declares Angular 21 rather than Angular 22 peers, and raise the production initial-bundle error budget from 1 MB to 1.1 MB to accommodate the measured Firebase 12 bundle increase.                                                                                                                                                                 | Confirmed                                                                                    |
| 2026-09-08 | Standardize client implementation names on `Collection` instead of `Forest` and `Task` for the active-walk feature, matching the existing `/collection` and `/task` routes.                                                                                                                                                                                                                                                                                                                                                                                   | Superseded by the project-wide task naming decision on 2026-09-08                            |
| 2026-09-08 | Standardize `Task`／`task` project-wide across client code, Cloud Functions, Firestore paths, seed data, tests, and documentation. Use contracts such as `completeTask`, `taskId`, `taskCompletions`, and `tasks/{taskId}`; do not introduce new identifiers containing the deprecated English term.                                                                                                                                                                                                                                                          | Confirmed                                                                                    |
| 2026-09-08 | Use `Cathay Walk \| 國泰健康走` as the working Demo public name. Retain the existing collision-risk warning and require internal brand/legal review before any public adoption.                                                                                                                                                                                                                                                                                                                                                                               | Confirmed for Demo                                                                           |
| 2026-09-08 | Use Angular 22 `@Service()` as the project convention for new services and repositories; retain `@Injectable()` where explicit injectable provider metadata is needed.                                                                                                                                                                                                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-09 | Adopt Capacitor 8.5.1 for the Ionic 9 / Angular 22 client and add Android as the first native platform. Pin core, CLI, and Android to the same version; use `com.cathay.catwalk` and `dist/client/browser`.                                                                                                                                                                                                                                                                                                                                                   | Confirmed                                                                                    |
| 2026-09-14 | Make the home screen's initial visual focus a compact sky-and-ground growth scene with the seedling centered on the soil, resource clouds and a sun above it, and a secondary compact Google Map below.                                                                                                                                                                                                                                                                                                                                                       | Confirmed                                                                                    |
| 2026-09-24 | Make the bonus-game lobby and room experience responsive on phones smaller than the Samsung Galaxy S20. Players may actively leave only during room preparation; disconnecting or closing the window preserves membership and current game state for reconnection, while a departing room master transfers ownership to the next player in room order.                                                                                                                                                                                                        | Confirmed                                                                                    |
| 2026-09-24 | At the end of each bonus-game round, reveal the current question's correct answer and hints alongside the players' identities.                                                                                                                                                                                                                                                                                                                                                                                                                                | Confirmed                                                                                    |
| 2026-09-24 | Use players' Google account portraits throughout the bonus game. Generate and show the question and hints during room preparation; let the room master edit the room name and AI prompt or regenerate the question before starting, and make game start proceed directly to role assignment and countdown without another AI call.                                                                                                                                                                                                                            | Confirmed                                                                                    |
| 2026-09-24 | Add `誰是偽藝術家` as a second bonus game using the existing lobby and room lifecycle. All players know the category; one random fake artist cannot see the drawing word; players draw two one-stroke turns each in distinct colors on a shared Angular Signature Pad canvas, then each casts one visible-attribution vote within 20 seconds before the fake artist is revealed.                                                                                                                                                                              | Confirmed                                                                                    |
| 2026-09-24 | Add `間諜危機 Spyfall` as a third bonus game. Keep the location secret during preparation; on start assign one or two spies and location-specific occupations to civilians. The host configures 5–20 possible-location hints, a 1–10 minute speaking limit, and up to two spies, with two spies available only from six players. Speakers are repeatedly assigned at random until time expires. Civilians may nominate a suspect for a public majority vote; catching a spy makes civilians win, while a wrong majority accusation or expiry makes spies win. | Confirmed                                                                                    |
| 2026-09-24 | Refactor the original 9UPPER route into a `RoomComponent` room shell and a child `NineUpperComponent` game module backed by one shared `NineUpperStore`. Centralize callable invocation and response validation for generated bonus-game content in `BonusGameAiService`, beginning with `generateNineUpperTopic`.                                                                                                                                                                                                                                            | Confirmed                                                                                    |

## Open decisions

### External follow-ups

1. Firebase App Distribution and personal-device installation remain pending company approval; browser delivery is the Must fallback.
2. `光能` and `Cathay Walk | 國泰健康走` are working names subject to later internal naming review.
3. Three.js remains optional and only proceeds after its spike gate.
4. Confirm the capacity reconciliation: core-path feature complete on 2026-10-21, all Must complete on 2026-11-05.
5. Select and field-check the exact six public POIs before freezing task seed data.

The product design frontier is closed. Any later scope change must be recorded as a new decision rather than silently replacing this baseline.
