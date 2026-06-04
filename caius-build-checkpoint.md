# Caius Birthday Game — Build Checkpoint (CONSOLIDATED)

**Updated:** 2026-06-04
**Birthday:** 6/4 · **Party / true ship:** 6/6
**Status:** Single source of truth for the build. Lives in the repo; both the Mac session and the browser session read and update THIS file.

---

## TL;DR — where this actually is

- All art generation is COMPLETE (PixelLab work done; only regenerate if playtest surfaces something).
- Top-down room system is built and proven: floor zones, foot-anchored sprites, depth sorting by feet, dev-mode drag-to-position tool.
- **ALL TEN ROOMS placed and baked** — nursery, master-bedroom, bathroom, hallway-upper, hallway-lower, kitchen, dining, living-room, play-area, garage. Objects drag-tuned, arrays committed.
- All chapter scenes and encounters wired to real sprites via SpriteBank (circle/rect primitives removed).
- Fail states + RetryPopup standard across every minigame and encounter.
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
| Ch10 Chatterbox | Queue empty, not enough matches | <5 base matches |
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

## FLAGGED — open items
- [ ] `chelsea-asleep` maps to `chelsea_rocking.png` — no true sleeping pose on disk. Ch05 uses it as-is.
- [ ] Ch06 dog walk-frame polish — dogs use south-facing sprites only, could use directional frames.
- [ ] Ch09 has no walker sprite — uses programmatic shapes (circle body + rect frame). No walker art exists on disk.
- [ ] Ch08 stuffies are programmatic circles — no stuffy sprites on disk.
- [ ] Food circles in Ch07 are programmatic — no food sprites.
- [ ] Kitchen vs living-room object split (open-concept): some objects may overlap visually.

---

## KEY DECISIONS — locked, do not re-litigate
| Topic | Decision |
|---|---|
| Rooms | 10-room canonical list above; foyer split into two hallways; living/kitchen split; backyard cut (Super Baby → living room) |
| Tilemaps | Programmatic rooms only; top-down bgs via topdown_gen.py + texture_pass.py (originals in rooms/_original/) |
| Upstairs carpet | Warm heathered beige, nursery + master must match |
| Kitchen fridge | Two-tone Samsung Bespoke (blue upper / white lower). SMEG red = garage reveal |
| Generation | Mac only (PixelLab MCP). Browser session flags missing art, never generates |
| Tailwind | v4, @tailwindcss/vite, no config file |
| iOS audio unlock | Boot/Menu before Ch1; tilt prompt + mandatory swipe fallback |
| Wild encounters | 3-10%, 60-sec cooldown |
| Ch10 win | 5 of 6 word matches |
| Poe | Travels with Caius (companion); in Ch5 stays in nursery |
| Ch12 intro words | "Mama. Dada." · Post-credits word: "Mama!" (joyful) |
| Cut order if behind | Ch3 → cutscene first; drop BottleWait + FaceWash; NEVER cut interludes / post-credits / Ch1 audio / Ch5 lullaby |
| Dedication | "For Chelsea, who made all of this possible." — non-negotiable |
| Deploy | Vercel Pro, single project (duplicate deleted), pushes to main trigger deploy |

**Room status:** ALL TEN ROOMS PLACED AND BAKED — nursery, master-bedroom, bathroom, hallway-upper, hallway-lower, kitchen, dining, living-room, play-area, garage.
