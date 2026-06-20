# Caius Birthday Game — Build Checkpoint (CONSOLIDATED)

**Updated:** 2026-06-19 (sound interstitial + unmuted default)
**Birthday:** 6/4 · **Party / true ship:** 6/6
**Status:** Single source of truth for the build. Lives in the repo; both the Mac session and the browser session read and update THIS file.

---

## TL;DR — where this actually is

- All art generation is COMPLETE (PixelLab work done; only regenerate if playtest surfaces something).
- **First Touch discovery game sprites generated** — `public/assets/sprites/objects/` contains 5 reaction sprite sheets (448×64, 7 frames each): obj_crinklebook_react, obj_rattle_react, obj_poe_react, obj_bumpyball_react, obj_oball_react. Not yet wired into any scene; build + sound design comes next.
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
Chapter homes: nursery M1/M2/M3/M4 (contiguous block) · master M5/M8 · dining M7 · living M6/M9/M11 + Super Baby bonus · garage M12 · bathroom + kitchen carry wild encounters.
**Wayfinding:** M8 (sleep training) lives in master-bedroom, NOT nursery — the old nursery gap (1,2,3,4,8) made players think 8 was next instead of leaving after 4. Keep nursery a clean 1-2-3-4 block; master holds M5+M8 (thematic: Soka naps on the master bed). Do not move M8 back. Ch08 uses a neutral dark bg + a code-drawn crib (no nursery-specific art), so it stages fine from either room; there's no completion-prereq lock — markers launch on contact, gating is purely spatial.

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

## MONTH 2 GAME REDESIGN — "First Focus" (6/5)

`Ch02_FirstSmile` (the Month 2 chapter; MonthCard shows "Month 2") was rebuilt from
scratch. The retired mechanic ("tap when her smile peaks", code-drawn circle faces,
mood rounds, soft-fail) is **gone**.

**First Focus** — Caius's newborn POV. The `chelsea-encouraging-standing` sprite drifts on a lazy
two-sine path, heavily blurred. The player holds + drags a soft focus reticle; while it
overlaps her, a focus meter fills and the blur resolves toward sharp. Off-target, the
meter decays slowly (never empties to a loss). **Progress is shown as a soft warm halo on
Mama** whose alpha tracks the meter LINEARLY (`HALO_MIN/MAX_ALPHA`, behind her, SCREEN-blend,
anchored to her drift) — NOT an arc ring on the reticle (that sat under the thumb on mobile,
and the blur resolves too slowly to read as progress early). The blur is kept purely for
atmosphere/payoff; the halo is the immediate readable cue. Filling the meter = win: she snaps sharp,
a warm pulse + hearts rise, then his own smile blooms (heart + sparkle — no `caius_happy`
sprite exists), then `completeChapter()`. **No fail state, no RetryPopup** (fill-to-win;
party-safe). Tunables at the top of the file (`FOCUS_FILL_RATE` ≈12s fill, `FOCUS_DECAY_RATE`,
`MAX_BLUR`). Blur uses **WebGL `postFX.addBlur`** driven by the meter (game is `Phaser.AUTO`
→ WebGL on all targets); Canvas fallback is a haze overlay that clears with focus.
MonthCard + IntroPanel wiring unchanged; IntroPanel instruction is "Find her face."

**⚠️ Spec divergence:** `caius-first-year-spec.md` and `edits-v1.1` still describe the
retired "smile peak" mechanic for this month. **The build is the source of truth** — the
spec is out of date for Month 2 / First Focus. Spec not edited; recorded here so it isn't
re-litigated.

---

## MONTH 3 GAME — "First Touch" (6/6)

`Ch03_EyesOpen` (Month 3; class/key/id kept, like Ch02's First Focus rename precedent) was
rebuilt. The retired mechanic ("soft cloud / 6 pages" card-flip with labeled circles — it
named textures the screen couldn't show) is gone.

**First Touch** — Caius sits at the bottom; 5 baby objects sit in a loose arc on a play-mat.
Tap an object → it plays its 7-frame reaction animation + its sound together (texture
conveyed through reaction, not labels). First tap of each = "discovered": emote-sparkle pop
+ one of 5 counter dots fills. All 5 discovered → heart/sparkle celebration → `completeChapter()`.
**No fail state, no timer, no RetryPopup.** IntroPanel instruction: "Touch everything!"
Generous explicit 128px hit rects per object (Ch03 hit-area lesson). MonthCard/IntroPanel/
completion wiring unchanged.

- **Objects + sounds:** crinklebook (scrunch), rattle (shake), poe (squish), bumpyball
  (wobble), oball (spin) — sheets `/assets/sprites/objects/obj_<id>_react.png` (448×64, 7×
  64px frames, loaded as spritesheets directly in the scene), sounds `/assets/audio/sfx/<id>.m4a`.
- **Audio:** Brandon's 5 `.m4a` files moved from `public/` root → `public/assets/audio/sfx/`;
  stray 1-byte `public/Audio` deleted. `SoundBank.preload(id, url?)` gained a custom-URL param
  so these route through SoundBank and respect the global mute flag (muted = silent reactions,
  animation still plays).
- **DUCKED CHAPTER:** the 5 reaction sfx are mechanic sounds — code comment marks this chapter
  music-ducked for when the music system lands.

**⚠️ Spec divergence** (same as Ch02): `caius-first-year-spec.md` / `edits-v1.1` still describe
the retired card mechanic for Month 3. Build is source of truth; spec not edited.

---

## INTERLUDE POSES + EMOTES + DOG WALK + BRANDON RECON (6/5)

**Interlude01 per-beat pose map** (each beat its own baby-in-arms Chelsea sprite, not just
a room change; single 64x64 frames, square-preserved, gentle motion):
| Beat | Caption | Pose sprite | Motion |
|---|---|---|---|
| 3 AM | Welcome home. | `chelsea-holding` (closest match) | bob |
| Sunrise | I've got you. | `chelsea-asleep`/rocking (closest match) | sway |
| Noon | We figured out the swaddle. | `chelsea-holding` | bob |
| Sunset | First bath, we both cried. | `chelsea-bath` | bob (no rotation) |
| **NIGHT (new)** | **Every two hours. Around the clock.** | `chelsea-feeding` | slow bob |
| Late night | She got him through the first weeks. | `chelsea-shoulder` | very subtle bob (quiet finale) |

- **New feeding beat** inserted between bath and late-night (setting pill "NIGHT", dimmed
  nursery, standard vignette). Six beats total; adjacent beats always differ visually
  (`holding` recurs on the two cradling beats — noted).
- The rocking re-export first landed as a duplicate-name upload (`chelsea_rocking (1).png`),
  since renamed to overwrite `chelsea_rocking.png` (clean path restored; old original is in
  git history). Still a single 64x64 frame (not a 128x64 sheet), so rocking stays sway-tween,
  not animated. New manifest keys: `chelsea-holding`, `chelsea-feeding`, `chelsea-shoulder`.

**Emote sprites wired** (Ch02 First Focus win): text `♥`/`✨` replaced with `emote-heart` /
`emote-sparkle` (32x32) via an `emote()` helper with text fallback. Keys `emote-heart`,
`emote-sparkle`.

**Text-emoji audit** (NOT changed — Brandon's call which to swap to emote sprites):
- `Ch10_Chatterbox.ts` — lives display **now uses `emote-heart` sprites** (full = alive, dim+dark-tint = lost); count/positions/update logic unchanged.
- `Ch05_HoliDadInn.ts:290` — `✈ Super Baby!` win banner.
- `Ch06_GrabBag.ts:307` — `★ STAR!` win banner.
- `HouseScene.ts:908` — `★` completed-chapter marker.
- `Interlude02_Mama.ts` — task icons (👚📞🍽🐶☕🤍): no matching emote sprites on disk.

**Ch06 dog walk animation** (fixes the static-sprite slide): `finn`/`nugget`/`eevee` now
load their 9-frame `walk/south/*` sequences (loaded directly in Ch06, not the manifest —
a frame sequence, not a single sprite), create the project's FIRST Phaser anims
(`dog-<id>-walk`, 12fps loop), render as `Sprite`s, play while moving + flipX for left,
idle on frame 0. Soka teleport-dashes (no velocity) → stays static. South frames only;
flipX for L/R — full directional walk could follow.

**Brandon recon** (task premise corrected — Brandon is NOT entirely unreferenced):
- **Ch05 HoliDad Inn**: Dad already renders as `dad-airplane` = `brandon_airplane.png`
  (60x100) on the bed; the "crawl to Dad's shoulder" phase targets it. Wired.
- **Ch10 Chatterbox**: `brandon-idle` = `brandon/south.png` is the "Dad" word-match target.
  Wired.
- **BonusChapter (Crime Fighting Super Baby)**: the code-drawn tan-rectangle "dad's airplane
  arms" is **now replaced** with the `dad-airplane` sprite (`brandon_airplane.png`, 64x64) —
  a full lifting-dad figure below/behind the caped Super Baby (baby on top). Rectangle
  removed. Position/scale may want a visual tweak (flip/offset) once eyeballed on device.
- On-disk Brandon: `brandon_airplane` (used), `brandon/south` (used), `brandon_bath`
  (unused — bath beat uses chelsea_bath), + 8-dir + 72-frame walk set (overworld; Brandon
  isn't a walkable character — unused).

---

## BUCKET A+ FIXES (6/5)

1. **Sound starts OFF every session.** `SettingsManager.load()` now forces `muted = true`
   regardless of any persisted value — the title promises "Sound starts off." The prior
   bug: a persisted `muted:false` made it start loud while the HUD glyph (set at the
   construction-time default `true`) stayed stale as 🔇. All audio already routes through
   `SoundBank.play()`, which returns early when muted. **RULE:** muted is the single
   global audio gate; sound is opt-in per session via the mute toggle. Mute now also
   `SoundBank.stopAll()`s in-flight clips.
2. Interlude01 closing caption → "She was the rock that held this household together."
3. Ch02 First Focus instruction → "Focus on Mama."
4. **Overlapping HUD text fixed.** Roomba: removed the `showLabel` whose title/subtitle
   (y=60/86) collided with the timer/status; intro() gate carries title+instruction. Ch06:
   moved the timer to the top-right so it can't double with the centered score.
5. **Dog game:** dogs ~3x (`DOG_SIZE=72`); Soka now glides toward toys via velocity (no
   teleport) and walk-animates like the others.
6. **Mo4 = Ch04_RollOut** rebuilt (same win): hand-authored 4-divider serpentine maze
   (alternating gaps, always solvable), **D-pad** movement (TouchControls + axis-separated
   wall collision, swipe removed), Caius ~2.5x (`caius-roll`, 66px).
7. **Mobility unlock:** small toast → **full-screen overlay** (IntroPanel-styled) — body
   "Caius has learned how to move now... but slowly at first.", button "Let's get crawling!".
   Overworld Caius now plays a **2-frame crawl animation** (`caius-crawl-l/r`, three-place,
   5fps, flipX) while moving — crawls instead of sliding.
8. **Ch05 HoliDad Inn staging:** Mom moved from floating in the bed to standing beside it;
   Caius 28→56px (crawl sprite); **dad waits as `brandon-idle` (no baby)** during the crawl
   and only switches to the `dad-airplane` held pose (which has a baby baked in) on arrival,
   with the crawling sprite hidden → one baby on screen always. **Side-effect fix:**
   BonusChapter's dad switched from `dad-airplane` (would double the baby) to `brandon-idle`.
9. **Washcloth (FaceWash):** opposite-dodge → **perpendicular dodge** — horizontal wipe
   dodged up/down, vertical wipe left/right; Caius steps one space aside then auto-returns;
   stepping along the wipe axis = hit. Win/lose structure unchanged.
10. **Roomba difficulty:** kept off-swipe controls (converted tap-to-move → **D-pad** for
    reactive dodging) and added a tunable **speed ramp** (`ROOMBA_SPEED_RAMP_MAX=1.9`, 1x→max
    over the round). Starts easy, gets tense, still first-try winnable.

---

## FLAGGED — open items
- [ ] `chelsea-asleep` maps to `chelsea_rocking.png` — no true sleeping pose on disk. Ch05 uses it as-is (stand-in).
- [ ] Ch06 dog directional walk — finn/nugget/eevee now walk-animate (south frames + flipX); full 8-direction walk still optional. Soka still static (teleporter).
- [ ] Programmatic stand-ins: Ch09 walker frame.
- **Ch07 First Bites staged:** real food sprites (food-puree/banana/cheerios/avocado/sweetpotato good; food-chili/lemon/broccoli-raw bad), caius-highchair seated pose in chair, chelsea-feeding at chair side, dimmed room-dining-bg backdrop. Mechanic/fail logic unchanged.
- [ ] Kitchen vs living-room object split (open-concept): some objects may overlap visually.
- **Overworld plushies (nursery + play-area):** all 6 real sprites wired (manifest + preload + room arrays). Wired in prior session; confirmed correct as of 2026-06-19.
- **Ch08 stuffies:** 7 real sprites wired (6 plushies + Poe). Layout 4/3 rows computed from roster length. Win = all 7 tucked. Labels removed. Tuck = dark tint + scale/alpha tween.

**Resolved this session:** dead `src/ui/ChapterCard.ts` removed (refit into `MonthCard`).

---

## MANIFEST AUDIT (6/5) — orphaned sprites on disk, not in SpriteBank

692 of 768 PNGs under `public/assets/sprites/` are not referenced by the manifest.
The vast majority are **directional / walk-cycle frame sets** (the manifest only
references a single representative `south.png` per character/dog), so those are
collapsed to one line per set below. Reconnaissance only — nothing wired beyond the
chelsea_bath swap. Notable standalone (non-animation) orphans Brandon can slot into
scenes:

**chelsea_scrubs/** (single-pose Chelsea, scrubs outfit, 64×64 — prime scene candidates)
- `chelsea_bath.png` — Chelsea + tub. **NOW WIRED** (`chelsea-bath`, Interlude01 bath beat).
- `chelsea_encouraging.png` — Chelsea cheering/encouraging pose (unused).
- `chelsea_encouraging_standing.png` — standing variant. **NOW WIRED** (`chelsea-encouraging-standing`,
  First Focus / Ch02 drifting mom).
- `chelsea_feeding.png` — Chelsea feeding the baby.
- `chelsea_holding.png` — Chelsea holding the baby (alt to chelsea_rocking).
- plus the full scrubs 8-dir + walk set (orphaned; overworld uses `chelsea/south.png`).

**brandon/** (Dad — PARTIALLY used: `brandon_airplane.png`=`dad-airplane` in Ch05,
`brandon/south.png`=`brandon-idle` in Ch10. Unused: `brandon_bath.png` + 8-dir + walk set).
`brandon_bath.png` flagged unused (do NOT composite with chelsea_bath — both bake a tub).
See Brandon recon above for the BonusChapter wiring opportunity.

**caius emotional variants** (unused): `caius-happy/`, `caius-sad/`, `caius-blue-happy/`,
`caius-blue-sad/` — happy/sad Caius with bounce + rock animations (8-dir each).
Singles: `caius-crawl-l.png`, `caius-crawl-r.png`, `caius-roll.png` (+ `_tan_backup/` copies).

**emotes/** (7, unused): `emote-heart`, `-sparkle`, `-exclamation`, `-question`, `-music`,
`-tear`, `-zzz`. Could replace the text ♥/✨ used in First Focus / encounters.

**dogs** (unused, full 8-dir + walk/sit/lay sets, 97 files each): `eevee/`, `finn/`,
`nugget/`, `soka/` — the family dogs (minigames reference `<dog>/south.png` only).

**poe/** (8, unused): `poe_base_*` 8-direction base poses — Poe companion.

**portable/** (2, unused): `obj_portable_bottle_empty.png`, `obj_portable_roomba_dock.png`.

**rooms/** (39, unused): backup/alternate room renders — `_original/` and `_sideon/`
variant sets; loose alt bgs (`room_backyard_bg`, `room_front_bg_dawn/day`,
`room_garage_bg_closed/open`, `room_livingkitchen_bg`, `room_master_bg`); plus
`backyard/` objects (gate, grill, outdoorchair) and `front/` objects (oaktree,
rocket_landed) — for cut/unbuilt backyard + front-yard rooms.

**transitions/** (4, unused): `transition_archway`, `_babygate`, `_frontdoor`,
`_stairs_bottom` — doorway/transition sprites.

---

---

## MUSIC LAYER (2026-06-19)

### Architecture
- **`src/systems/MusicManager.ts`** — new singleton (separate from SoundBank).
  SoundBank = one-shot SFX clones. MusicManager = one persistent looping HTMLAudioElement.
  They share the global mute flag but are otherwise independent.
- Volume tier system: **FULL / DUCKED (~28%) / OFF** — applied via `MusicManager.setTier(tier)`.
  Default tier is FULL; DUCKED is available for mechanic-heavy chapters where game audio competes.
- **`SCENE_MUSIC_MAP`** (exported from MusicManager.ts) — track-map dict `scene → { track, tier }`.
  Extend this to drop in per-chapter tracks without touching any scene code.

### Tracks shipped
| Track id | File | Volume | Plays on |
|---|---|---|---|
| `homescreen` | `public/assets/audio/music/GameAudio_Homescreen.mp3` (1.4 MB, 64 kbps) | 0.40 | BootScene, SoundNoticeScene, MenuScene |
| `free-roam`  | `public/assets/audio/music/GameAudio_FreeRoam.mp3`  (2.3 MB, 64 kbps) | 0.45 | HouseScene (overworld) |

### Home ↔ House transition
- **Entering house** (MenuScene → HouseScene): `crossfadeTo('free-roam', 500)` — homescreen fades out in first 250 ms, free-roam fades in over next 250 ms. Never both at full.
- **Returning home** (Home button → MenuScene): MenuScene.create() calls `play('homescreen')` — stops free-roam immediately and starts homescreen (brief natural silence during scene transition is acceptable per spec).

### Free-roam handoff rules
| Event | Music behaviour |
|---|---|
| Enter chapter | Music **continues** under MonthCard + IntroPanel; stops (400 ms fade) when player taps **Start** (gameplay begins) — wired in `ChapterBase.intro()` callback |
| Enter encounter | Same pattern — continues under encounter IntroPanel, stops on Start tap — wired in `EncounterBase.intro()` callback |
| Enter interlude / cutscene | Stops immediately (350 ms fade) in `InterludeBase.setupInterlude()` |
| Enter PostCreditsScene | Stops immediately (500 ms fade) in PostCreditsScene.create() |
| Return to free-roam | HouseScene.create() → `crossfadeTo('free-roam', 500)` — resumes from beginning |
| Mute toggle | `MusicManager.setMuted()` pauses/resumes the active element; wired in main.ts `onMuteChange` |

### API (MusicManager)
- `preload()` — buffer all 7 tracks (call once from main.ts on READY, before any user gesture)
- `play(id, tier?)` — start looping track; no-ops if already playing; remembers intent when muted
- `crossfadeTo(id, fadeMs?, tier?)` — fade out current, fade in new; falls back to play() if silent
- `stop(fadeMs?)` — stop with optional fade
- `setMuted(bool)` — called by main.ts onMuteChange; pauses/resumes active element
- `setTier(tier)` — FULL / DUCKED / OFF; applies immediately to active track

---

## PER-CHAPTER MUSIC (2026-06-19)

All 5 mood tracks + finale wired. `SCENE_MUSIC_MAP` is the single place to adjust any chapter's music.

### Tracks
| File | Size | Mood | kbps |
|---|---|---|---|
| `game_tender.mp3`    | 3.0 MB | tender    | 320 |
| `game_playful.mp3`   | 1.9 MB | playful   |  64 |
| `game_tension.mp3`   | 1.8 MB | tension   | 320 |
| `game_triumphant.mp3`| 2.7 MB | triumphant| 320 |
| `finale.mp3`         | 4.5 MB | finale    | 320 |

*`game_tension.mp3.mp3` (double extension from upload) was copied as `game_tension.mp3` — no stale refs.*

### Chapter → track map (full)
| Scene | Track | Tier | Notes |
|---|---|---|---|
| Ch01 Arrival | tender | DUCKED | Sound-localization game (tap where sound came from); ducked so directional audio cues read clearly. This IS the "sound-localization game with expanding rings" from the spec. |
| Ch02 First Focus | tender | DUCKED | Focus mechanic — blur/SFX must dominate |
| Ch03 First Touch | tender | DUCKED | Texture discovery — object SFX must dominate |
| Ch04 RollOut | tension | FULL | Maze-roll |
| Ch05 HoliDad Inn | playful | FULL | Tilting bed silliness, crawl to Dad |
| Ch06 GrabBag | playful | FULL | Dog toy grab chaos |
| Ch07 First Bites | tender | FULL | Warm family meal |
| Ch08 SleepTraining | tender | FULL | Night-time rhythm |
| Ch09 MazeWalker | tension | FULL | Walker obstacle maze |
| Ch10 Chatterbox | triumphant | FULL | First words milestone |
| Ch11 Ledges | triumphant | FULL | Cruising → first steps |
| Ch12 Liftoff | finale | FULL | Finale, dedicated track |
| BonusChapter | triumphant | FULL | Super Baby, heroic cape |
| SnotSucker | tension | FULL | Healthcare threat |
| FaceWash | playful | FULL | |
| BottleWait | playful | FULL | |
| ChangingTable | tension | FULL | |
| Roomba | tension | FULL | |

### Handoff
- **Free-roam → chapter**: music continues under MonthCard + IntroPanel; on Start tap → 600 ms crossfade from free-roam to chapter track at chapter's tier (wired in ChapterBase.intro() + EncounterBase.intro() via SCENE_MUSIC_MAP lookup).
- **Chapter → free-roam**: HouseScene.create() → crossfadeTo('free-roam', 500) handles all returns.
- **Interludes / PostCredits**: immediate stop (unchanged from prior commit).

---

## KEY DECISIONS — locked, do not re-litigate
| Topic | Decision |
|---|---|
| Ch02 First Focus progress | Both halo (warm glow on Mama) AND a slim scrubs-purple top bar. Bar fills left-to-right, fades in on gameplay start, never returns to the reticle/thumb zone. Constants: `BAR_FILL_COLOR` (vivid lavender 0xc084fc), `BAR_TRACK_COLOR` (dark purple 0x3b1b6e). |
| Modal freezes | **PROJECT RULE:** never use `tweens.pauseAll()` to freeze a scene behind a modal — Phaser 3.60+ halts the whole tween manager, freezing the modal's own animations too. Use `freezeScene()` (src/ui/sceneFreeze.ts) which pauses individual existing tweens + the clock. |
| Cutscene visuals | **PROJECT RULE:** interlude/cutscene beats use the shared **`CaptionBand`** (src/ui/CaptionBand.ts) for all caption/label/prompt text — a dark lower-third band (caption + in-band "Tap to continue") + a top-center setting pill, warm off-white `#F5EFE0`. No bare text on the background. **No code-drawn prop rectangles** (crib/table/window blocks) in cutscenes. **Every interlude beat — including text-only ones — is grounded in a dimmed baked room** (`dimmedRoomBackdrop`, existing `room-*-bg` keys) + a vignette spotlight (`addSpotlight`); never a lone sprite on a flat fill or bare black. Only one caption renders at a time (`captionBand.hide()` before a new screen). A held baby is composited at one shared chest offset (in front of the torso, below the face) on every beat — never on her face. |
| Interactive hit areas | **PROJECT RULE:** never make centered `Text` (or a container with a manual `Geom.Rectangle` hit area) directly interactive — the live area ends up an offset strip. Make an interactive **`Rectangle`/`Zone` sized to the visual with origin 0.5** the hit target (Phaser sizes a standard GameObject's hit area origin-aware), label as a sibling. For irregular silhouettes (triangle/star), overlay a generous centered Rectangle hit target — do NOT make the shape itself interactive and do NOT use pixel-perfect. Tap target ≥44px. Verified via headless `hitTestPointer` (left/center/right all hit). |
| Gameplay UI scope | Gameplay HUD/pause/keyboard exist ONLY while a gameplay scene is active; menus (Boot/SoundNotice/Menu) show none of it, and exiting to a menu fully stops the gameplay scene(s). |
| Exit to House (pause menu) | **Fixed 2026-06-20.** Bug: handler resumed the chapter then called game.scene.start('HouseScene') without stopping the chapter first → both scenes ran simultaneously, chapter on top, appeared to "do nothing." Fix: resume → killAll timers+tweens → game.scene.stop(chapter) → game.scene.start('HouseScene', {profile}). Pause menu offers: Resume (unpause) / Restart (retry same chapter) / Exit to House (abandon chapter → free-roam) / Home (autosave → profile select). |
| Crawl facings | **PROJECT RULE:** `caius-crawl-l` / `caius-crawl-r` are opposite-FACING poses (left / right), NOT frames of a crawl cycle. Do NOT build a looping anim from them — that strobes east↔west every frame in all directions. Swap the texture to face the travel direction ONLY on a horizontal-direction change (track `crawlFacing`; keep the last facing for pure N/S; never change per tick). There are no N/S crawl poses. A small managed bob tween conveys motion (stopped on idle; never `tweens.pauseAll()`). |
| Chapter marker unlock | **Strict sequential (wayfinding):** chapter N's marker is PLAYABLE only when N-1 is complete (M1 always; completed stay replayable; DevMode unlocks all) — `HouseScene.isChapterPlayable`. Three marker states in `drawMarkers`: **done** (amber ★, settled), **playable** (accent number, pulsing — the only one that pulses, to point the eye), **locked** (dim grey ring + 🔒, no pulse, still VISIBLE as a signpost). Tapping a locked marker shows a toast `Finish Month {N-1} first` and does NOT launch (no asset for a lock; 🔒 glyph used). This is ONLY the marker/launch gate — capability reveals (rolling→movement Ch4, crawling Ch5, walker Ch9, walking/garage Ch11) and **Ch12 (rocket `chapterTrigger`, conditional Ch11-complete) + Bonus (toychest `bonusTrigger`) keep their own special unlock conditions, untouched**. No strict-order vs ability conflicts found (movement is gained exactly when M5 first needs leaving the nursery; Ch12's Ch11-condition already matches sequential). Markers refresh on room re-entry (scene recreates), so completing N flips N+1 to playable. |
| Rooms | 10-room canonical list above; foyer split into two hallways; living/kitchen split; backyard cut (Super Baby → living room) |
| Tilemaps | Programmatic rooms only; top-down bgs via topdown_gen.py + texture_pass.py (originals in rooms/_original/) |
| Upstairs carpet | Warm heathered beige, nursery + master must match |
| Kitchen fridge | Two-tone Samsung Bespoke (blue upper / white lower). SMEG red = garage reveal |
| Generation | Mac only (PixelLab MCP). Browser session flags missing art, never generates |
| Tailwind | v4, @tailwindcss/vite, no config file |
| iOS audio unlock | Boot interstitial tap is the gesture; music starts after interstitial tap (SoundNoticeScene advance) |
| Sound default | **UNMUTED** (was forced-off). Persisted mute preference respected on return. Fresh = sound on. |
| Wild encounters | 3-10%, 60-sec cooldown |
| Ch10 win | 15 matches (sprite targets); fail at 5 misses (hearts) |
| Month 2 game | "First Focus" (newborn vision: drag a focus reticle onto blurred Chelsea to sharpen her; fill-to-win, NO fail state). Replaced the retired "tap when smile peaks" game. Build is source of truth; spec/edits-v1.1 diverge for this month. |
| Month 3 game | "First Touch" (discovery: tap 5 objects → reaction anim + sound; discover all 5 to win, NO fail state). Replaced the retired "soft cloud / 6 pages" card game. DUCKED chapter (mechanic sfx). Build is source of truth; spec/edits-v1.1 diverge. |
| Audio sfx | Mechanic sound clips live in `/assets/audio/sfx/*.m4a`; load via `SoundBank.preload(id, url)`. ALL audio routes through `SoundBank.play` (gated by the global mute flag). "DUCKED chapter" = a code comment tagging scenes whose sfx should duck under music later. |
| Poe | Travels with Caius (companion); in Ch5 stays in nursery |
| Ch12 intro words | "Mama. Dada." · Post-credits word: "Mama!" (joyful) |
| Cut order if behind | Ch3 → cutscene first; drop BottleWait + FaceWash; NEVER cut interludes / post-credits / Ch1 audio / Ch5 lullaby |
| Dedication | "For Chelsea, who made all of this possible." — non-negotiable |
| Deploy | Vercel Pro, single project (duplicate deleted), pushes to main trigger deploy |

**Room status:** ALL TEN ROOMS PLACED AND BAKED — nursery, master-bedroom, bathroom, hallway-upper, hallway-lower, kitchen, dining, living-room, play-area, garage.

---

## FAIL/RETRY ARCHITECTURE RULE (2026-06-20)

**PROJECT RULE:** Scenes that call `this.retry()` / `scene.restart()` MUST explicitly reset ALL mutable class fields at the top of `create()` (or in an `init()` override), because Phaser reuses the class instance on restart and field initializers (`private x = 0`) only run in the constructor — they do NOT re-run on `scene.restart()`. Stale values leak into the new run.

`resetRound()`-style scenes are exempt — they never restart the scene and directly zero only the fields they care about.

### Bug fixes applied (2026-06-20)
| Scene | Bug | Fix |
|---|---|---|
| **Ch07 FirstBites** | CRITICAL: `spoonIndex` and `correct` not reset → immediate re-fail loop on retry (nextSpoon evaluated stale spoonIndex=12 → evaluate() → retry popup again). HUD showed '0 of 12' while fail said 'Got 5'. | Reset `spoonIndex/correct/accepting/currentFood/spoonContainer/spoonTween/swipeStart` at top of `create()`. |
| **Ch06 GrabBag** | MODERATE: `grabbed/dogs/toys` not reset → stale grabbed count caused spurious wins; stale Dog array accumulated 4 destroyed-obj entries per retry. | Reset `grabbed=0; dogs=[]; toys=[]` at top of `create()`. |
| **SnotSucker** | LOW: `resetRound()` didn't kill pending `delayedCall` → frozen timer (thawed by RetryPopup) could double-fire `nextSwoop()` creating two concurrent swoop sequences. | Added `this.time.removeAllEvents(); this.swoopTween?.stop()` at top of `resetRound()`. |
| **RetryPopup** | LOW: second tap during 180ms dismiss fade could start a second fade and fire `onRetry()` twice. | Added `dismissing` boolean guard; checked at entry of `dismiss()`, cleared in `onComplete` and `destroy()`. |
