# Caius Birthday Game — Build Checkpoint (CONSOLIDATED)

**Updated:** 2026-06-05
**Birthday:** 6/4 · **Party / true ship:** 6/6
**Status:** Single source of truth for the build. Lives in the repo; both the Mac session and the browser session read and update THIS file.

---

## TL;DR — where this actually is

- All art generation is COMPLETE (PixelLab work done; only regenerate if playtest surfaces something).
- Top-down room system is built and proven: floor zones, foot-anchored sprites, depth sorting by feet, dev-mode drag-to-position tool.
- **ALL TEN ROOMS placed and baked** — nursery, master-bedroom, bathroom, hallway-upper, hallway-lower, kitchen, dining, living-room, play-area, garage. Objects drag-tuned, arrays committed.
- All chapter scenes and encounters wired to real sprites via SpriteBank (circle/rect primitives removed).
- Fail states + RetryPopup standard across every minigame and encounter.
- **Opening = newborn auto-launch sequence** (Ch1 auto → Ch2/Ch3 beat-and-launch while stationary → free roam from Ch4). Chapter flow runs through three shared components: **MonthCard → IntroPanel → game** (retries skip the cards).
- Chelsea-doorway and cape sprites wired. Door-label fog-of-war and marker re-arm guard active.
- Deployed on Vercel Pro (single project, duplicate deleted).

---

## CANONICAL HOUSE (rooms.ts matches this — verified)
Upstairs: nursery, master-bedroom, bathroom — all off hallway-upper. Stairs to hallway-lower.
Main floor: hallway-lower → kitchen + living-room (open-concept direct door). Dining + play-area off kitchen. **Garage off living-room = M12 finale.** Backyard CUT.
Chapter homes: nursery M2/M3/M4/M8 · master M5 · dining M7 · living M6/M9/M11 + Super Baby bonus · garage M12 · bathroom + kitchen carry wild encounters.

---

## TONIGHT'S COMPLETED WORK (6/3–6/4 session)

### Sprite swaps — all scenes now use real sprites
- **Chapters:** Ch04 (caius-roll, vtech-cube), Ch05 (bed, chelsea-asleep, dad-airplane, caius), Ch07 (caius, chelsea-idle, obj-dining-highchair), Ch11 (caius, chelsea-idle, furniture-sectional/coffeetable/sidetable/barstool)
- **Encounters:** SnotSucker (caius), FaceWash (caius), BottleWait (caius, obj-portable-bottle-filled), ChangingTable (caius, obj-master-changingtable), Roomba (caius, obj-portable-roomba)
- **BonusChapter:** caius sprite (buildings + cape stay programmatic by design)
- **Still programmatic:** Ch06 dog-stealing circles (dog sprites exist but small; functional), Ch08 crib/stuffies (no stuffy sprites), Ch09 walker frame + obstacles + Chelsea rect (no walker sprite exists), Ch12 subsystem panel interiors, food circles in Ch07

### Fail states + RetryPopup standard
Shared `RetryPopup` component (dims scene, shows message, pauses timers/tweens, tap-to-retry).
| Scene | Fail condition | Threshold |
|---|---|---|
| Ch05 HoliDadInn | Falls off bed (ph1) | 3 falls |
| Ch06 GrabBag | Timer ends below WIN | <6 grabbed |
| Ch07 FirstBites | Wrong responses (early-out) | Can't reach 10 |
| Ch08 SleepTraining | Urge misses (ph2) | 3 misses → restart night |
| Ch09 MazeWalker | Obstacle collisions | 5 hits (500ms cooldown) |
| Ch10 Chatterbox | Missed matches (hearts) | 5 misses (win = 15 matches) |
| Ch11 Ledges | Early grip releases | 3 slips |
| Ch12 Liftoff | **No fail state** | Finale is not losable |
| BonusChapter | Missed toys | >6 misses (of 20 drops, need 14) |
| SnotSucker | Hit by sucker | 2 of 3 swoops hit |
| FaceWash | Cloth hits or wrong tap | 2 misses |
| BottleWait | Patience reaches zero | Patience bar empty |
| ChangingTable | Rolls off edge | Immediate |
| Roomba | Contact or timeout | Immediate |

### Infrastructure patterns
- **Rocket-as-M12-trigger:** garage room's rocket object has `chapterTrigger: 12`, gated by `locked?` check until all prior chapters complete.
- **Cape-chest-as-Bonus-trigger:** play-area toychest has `bonusTrigger: true`. Two-phase flow: `revealBonusCape` (chest tap → cape arcs to center-left floor) → `launchBonusChapter` (walk to landed cape → bonus launches). Strict re-arm between phases. Cape trigger radius ~26px.
- **Door-label fog-of-war:** room door labels only show rooms the player has visited (completed chapters whose room matches the door target).
- **Marker re-arm guard:** `markersArmed` flag starts false on room entry, re-arms only after player exits ALL marker/trigger radii. Prevents auto-fire on room load.
- **Chelsea-doorway sprite:** wired as doorway sprite in room transitions.

---

## SECOND-WAVE WORK (6/4–6/5 session)

### Opening flow — newborn auto-launch sequence
Fresh profiles are `stationary` (speed 0) until rolling unlocks at Ch4, so early chapters can't be walked to. On entering the nursery while immobile (and not DevMode), the room holds a ~1.5s establishing beat, pulls the camera to the next incomplete chapter's marker, then auto-launches it: **Ch1 auto → Ch2 → Ch3 → Ch4**, each still gated by the IntroPanel Start tap. Once rolling unlocks (Ch4 done, speed > 0) auto-launch stops and a one-time "you can move now" hint shows; player free-roams from there. Resumes correctly on reload mid-sequence (e.g. Ch2 done/Ch3 not → beats then launches Ch3). DevMode keeps its walking shortcut and is exempt. Dead `canTraverse()` removed from PlayerState.

### Three shared chapter-flow components
**MonthCard + IntroPanel + RetryPopup.** Fresh chapter entry: **trigger (marker or auto-launch) → MonthCard → IntroPanel → game.**
- **MonthCard** — full-screen "Month N" title (N = chapter#; chapters only, never interludes/encounters/bonus). First-ever play per profile holds a mandatory 2.0s (no skip) then auto-advances; replays are tap-to-continue. Tracked via `seenChapterCards` on the save.
- **IntroPanel** — instructions + Start button; freezes scene until tapped.
- **RetryPopup** — fail-state retry. **Retries skip the MonthCard + IntroPanel** (via `ChapterBase.retry()` setting a skip flag — Phaser re-sends scene data on `restart()`, so an instance flag distinguishes retry from fresh entry); gameplay resets directly. Ch12's bespoke flow integrates unchanged.

### Other infra
- **Pause menu Home button** → autosave → return to profile select.
- **Sound interstitial** (SoundNoticeScene) shown after the first tap.
- **Spawn-door fix** — re-entry spawns at the door whose `to === room you exited` (matched by destination room id, not wall side) with per-door re-arm; fixes wrong-door spawn on walls with two doors (hallway-lower).
- **M8 marker** moved to the nursery right column, clear of the spawn point.
- **Ch10 Chatterbox** — real sprite targets, 15-match win, miss-based fail (5-miss hearts).

---

## WALKTHROUGH FIXES (6/5)

First real fresh-profile, DevMode-off playthrough surfaced a cluster of bugs of one
class — **game-layer UI/input alive outside gameplay** — plus the newborn sequence's
first live blocker. All fixed and on main.

| # | Bug | Fix | Commit |
|---|-----|-----|--------|
| 1 | Profile **delete click-through** (confirm also launched the profile beneath) | Custom DOM modal whose backdrop `stopPropagation()`s every pointer event + a `suppressSelect` guard cleared on next pointerdown | `d4ebfb7` |
| 2 | **WASD swallowed** while typing a profile name | TouchControls added keys with Phaser's default global capture (preventDefault on window). Now `addKey(code, false)` — capture off; in-game `isDown`/movement unaffected | `d4ebfb7` |
| 3 | **Ch1 stuck / no MonthCard / no audio** (newborn sequence's first run) | Root cause: Phaser 3.60+ `tweens.pauseAll()` sets a manager-level paused flag whose `update()` guard halts **all** tweens, including ones added afterward → MonthCard's fade→counter→dismiss chain never ran, intro promise never resolved, panel never shown, sounds never reached. Fixed with **`freezeScene()`** helper (pause individual existing tweens + the clock, not the whole manager) wired into IntroPanel, RetryPopup, and ChapterBase.intro(). "No audio" was a secondary symptom of the stuck state | `d4ebfb7` |
| 4 | **Pause icon on title/profile screens** | HUD was created once at boot and never hidden. Now a POST_STEP sync drives HUD visibility from scene state (`gameplayScenePresent` = active or paused gameplay scene); hidden on Boot/SoundNotice/Menu. HUD starts hidden | `2464728` |
| 5 | **Home overlaid the profile screen over a live HouseScene** | `onHomeRequested` now `stopAllGameplayScenes()` (resume-then-stop every active/paused/sleeping non-menu scene, not just the paused one) + hides the HUD before starting MenuScene; profile-picker backdrop made fully opaque | `2464728` |

Bugs 3 and 4/5 were **runtime-verified headless** against the real Phaser TweenManager
and SceneManager respectively (browser/Chromium download is blocked by the env network
allowlist, so full on-device play wasn't possible). The headless SceneManager test caught
a real mistake pre-merge: `isVisible()` reports never-started scenes as present (scenes
default visible:true), so HUD visibility keys off `isActive || isPaused` instead.

**Class takeaway:** gameplay HUD, keyboard movement, and pause exist ONLY while a gameplay
scene is on screen; any exit to a menu fully stops the gameplay scene(s) and their UI.

---

## FLAGGED — open items
- [ ] `chelsea-asleep` maps to `chelsea_rocking.png` — no true sleeping pose on disk. Ch05 uses it as-is (stand-in).
- [ ] Ch06 dog walk-frames — dogs use south-facing sprites only; could use directional frames.
- [ ] Programmatic stand-ins (no art on disk): Ch07 food circles, Ch08 stuffies, Ch09 walker frame.
- [ ] Kitchen vs living-room object split (open-concept): some objects may overlap visually.

**Resolved this session:** dead `src/ui/ChapterCard.ts` removed (refit into `MonthCard`).

---

## KEY DECISIONS — locked, do not re-litigate
| Topic | Decision |
|---|---|
| Modal freezes | **PROJECT RULE:** never use `tweens.pauseAll()` to freeze a scene behind a modal — Phaser 3.60+ halts the whole tween manager, freezing the modal's own animations too. Use `freezeScene()` (src/ui/sceneFreeze.ts) which pauses individual existing tweens + the clock. |
| Cutscene visuals | **PROJECT RULE:** interlude/cutscene beats use the shared **`CaptionBand`** (src/ui/CaptionBand.ts) for all caption/label/prompt text — a dark lower-third band (caption + in-band "Tap to continue") + a top-center setting pill, warm off-white `#F5EFE0`. No bare text on the background. **No code-drawn prop rectangles** (crib/table/window blocks) in cutscenes. **Every interlude beat — including text-only ones — is grounded in a dimmed baked room** (`dimmedRoomBackdrop`, existing `room-*-bg` keys) + a vignette spotlight (`addSpotlight`); never a lone sprite on a flat fill or bare black. Only one caption renders at a time (`captionBand.hide()` before a new screen). A held baby is composited at one shared chest offset (in front of the torso, below the face) on every beat — never on her face. |
| Interactive hit areas | **PROJECT RULE:** never make centered `Text` (or a container with a manual `Geom.Rectangle` hit area) directly interactive — the live area ends up an offset strip. Make an interactive **`Rectangle`/`Zone` sized to the visual with origin 0.5** the hit target (Phaser sizes a standard GameObject's hit area origin-aware), label as a sibling. For irregular silhouettes (triangle/star), overlay a generous centered Rectangle hit target — do NOT make the shape itself interactive and do NOT use pixel-perfect. Tap target ≥44px. Verified via headless `hitTestPointer` (left/center/right all hit). |
| Gameplay UI scope | Gameplay HUD/pause/keyboard exist ONLY while a gameplay scene is active; menus (Boot/SoundNotice/Menu) show none of it, and exiting to a menu fully stops the gameplay scene(s). |
| Rooms | 10-room canonical list above; foyer split into two hallways; living/kitchen split; backyard cut (Super Baby → living room) |
| Tilemaps | Programmatic rooms only; top-down bgs via topdown_gen.py + texture_pass.py (originals in rooms/_original/) |
| Upstairs carpet | Warm heathered beige, nursery + master must match |
| Kitchen fridge | Two-tone Samsung Bespoke (blue upper / white lower). SMEG red = garage reveal |
| Generation | Mac only (PixelLab MCP). Browser session flags missing art, never generates |
| Tailwind | v4, @tailwindcss/vite, no config file |
| iOS audio unlock | Boot/Menu before Ch1; tilt prompt + mandatory swipe fallback |
| Wild encounters | 3-10%, 60-sec cooldown |
| Ch10 win | 15 matches (sprite targets); fail at 5 misses (hearts) |
| Poe | Travels with Caius (companion); in Ch5 stays in nursery |
| Ch12 intro words | "Mama. Dada." · Post-credits word: "Mama!" (joyful) |
| Cut order if behind | Ch3 → cutscene first; drop BottleWait + FaceWash; NEVER cut interludes / post-credits / Ch1 audio / Ch5 lullaby |
| Dedication | "For Chelsea, who made all of this possible." — non-negotiable |
| Deploy | Vercel Pro, single project (duplicate deleted), pushes to main trigger deploy |

**Room status:** ALL TEN ROOMS PLACED AND BAKED — nursery, master-bedroom, bathroom, hallway-upper, hallway-lower, kitchen, dining, living-room, play-area, garage.
