# Caius's First Year: A Year Around the Sun

**Claude Code Build Specification**

A mobile-first web game celebrating Caius's first birthday (June 4). Players guide Caius through 12 developmental milestones plus 2 Chelsea-focused interludes over his first year, culminating in a rocket launch and a journey around the sun back home.

- **Target play time:** 45 to 50 minutes
- **Target platform:** Mobile web (iOS Safari, Android Chrome), playable on desktop
- **Target deploy date:** June 1, 2026
- **Style:** Gen 3 Pokémon (Ruby/Sapphire/Emerald) top-down pixel art

---

## 1. Tech Stack

- **Game engine:** Phaser 3 (latest stable)
- **Build tool:** Vite
- **Language:** TypeScript (strict mode)
- **UI shell:** Tailwind CSS (menus, profile picker, share)
- **State / saves:** localStorage with named profiles
- **Analytics:** PostHog (free tier, posthog-js)
- **Hosting:** Vercel
- **Asset format:** PNG sprite sheets, OGG audio, Tiled JSON tilemaps
- **Resolution:** 480x800 base canvas, scaled to fit (portrait orientation)

## 2. Project Setup

```bash
npm create vite@latest caius-first-year -- --template vanilla-ts
cd caius-first-year
npm install phaser posthog-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `vite.config.ts` for asset handling and `tsconfig.json` for strict mode.

## 3. File Structure

```
caius-first-year/
├── public/
│   ├── assets/
│   │   ├── sprites/
│   │   ├── tilemaps/
│   │   ├── tiles/
│   │   ├── audio/
│   │   └── ui/
│   └── favicon.ico
├── src/
│   ├── main.ts
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── HouseScene.ts
│   │   ├── interludes/
│   │   │   ├── Interlude01_FirstDays.ts
│   │   │   └── Interlude02_Mama.ts
│   │   ├── chapters/
│   │   │   ├── Ch01_Arrival.ts
│   │   │   ├── Ch02_FirstSmile.ts
│   │   │   ├── Ch03_EyesOpen.ts
│   │   │   ├── Ch04_RollOut.ts
│   │   │   ├── Ch05_HoliDadInn.ts
│   │   │   ├── Ch06_GrabBag.ts
│   │   │   ├── Ch07_FirstBites.ts
│   │   │   ├── Ch08_SleepTraining.ts
│   │   │   ├── Ch09_MazeWalker.ts
│   │   │   ├── Ch10_Chatterbox.ts
│   │   │   ├── Ch11_Ledges.ts
│   │   │   └── Ch12_Liftoff.ts
│   │   ├── encounters/
│   │   │   ├── SnotSucker.ts
│   │   │   ├── FaceWash.ts
│   │   │   ├── BottleWait.ts
│   │   │   ├── ChangingTable.ts
│   │   │   └── Roomba.ts
│   │   ├── BonusChapter.ts
│   │   └── PostCreditsScene.ts
│   ├── systems/
│   │   ├── SaveManager.ts
│   │   ├── PlayerState.ts
│   │   ├── DialogueBox.ts
│   │   ├── EncounterManager.ts
│   │   └── Analytics.ts
│   ├── ui/
│   │   ├── ProfilePicker.ts
│   │   ├── ChapterCard.ts
│   │   └── TouchControls.ts
│   └── types.ts
├── index.html
├── tailwind.config.js
└── package.json
```

## 4. Save System

**Storage key:** `caius-game-saves`

**Schema:**
```typescript
type SaveProfile = {
  id: string;
  name: string;
  createdAt: number;
  lastPlayedAt: number;
  completedChapters: number[];
  completedInterludes: string[];        // ['first-days', 'mama']
  completedEncounters: string[];
  nicknamesCollected: string[];
  brutusUnlocked: boolean;
  bonusChapterUnlocked: boolean;
  bonusChapterCompleted: boolean;
  currentRoom: string;
  totalPlayTimeSeconds: number;
};

type GameSaves = {
  profiles: SaveProfile[];
  activeProfileId: string | null;
};
```

**Profile picker (MenuScene):**
- On launch, show all profiles + "New player" button
- Tap profile to load and resume in last room
- Long-press for delete confirmation
- Max 8 profiles per device

**Autosave:** after every chapter completion, interlude completion, encounter clear, and room transition.

## 5. Analytics (PostHog)

**Setup:** in `src/systems/Analytics.ts`

```typescript
import posthog from 'posthog-js';

posthog.init('YOUR_POSTHOG_KEY', {
  api_host: 'https://app.posthog.com',
  capture_pageview: true,
  autocapture: false,  // we send events manually
});

export function track(event: string, props?: Record<string, any>) {
  posthog.capture(event, props);
}
```

**Events to track:**
- `game_started` (profile_name, is_new_profile)
- `chapter_started` (chapter_id, profile_name)
- `chapter_completed` (chapter_id, profile_name, time_seconds, attempts)
- `chapter_failed` (chapter_id, profile_name, fail_reason)
- `interlude_completed` (interlude_id, profile_name)
- `encounter_triggered` (encounter_id)
- `encounter_completed` (encounter_id)
- `nickname_collected` (nickname)
- `brutus_unlocked` (path: 'bonus' | 'secret')
- `bonus_chapter_completed` (time_seconds)
- `game_completed` (total_play_time_seconds, profile_name)
- `session_ended` (session_duration_seconds, last_scene)

**Identify users by profile name** (no PII collection beyond first-name-only display name).

**PostHog dashboard:** lets you see drop-off funnels, replay anonymized sessions, and time-per-chapter heatmaps. Free tier handles this volume forever.

## 6. Player System

**Mobility states** (gated by chapter completion):

| State | Unlocked after | Movement |
|---|---|---|
| Stationary | start | No overworld movement, chapter auto-launches |
| Eyes only | Ch3 | Still can't traverse |
| Rolling | Ch4 | Slow, bumpy, ~60% speed |
| Crawling | Ch5 | ~80% speed |
| Walker | Ch9 | 100% speed, taller hitbox |
| Cruising | Ch11 in progress | Furniture-only |
| Walking | Ch11 complete | Full free movement, garage unlocks |

**Brutus alternate skin:** unlocked via bonus chapter or secret in Ch10. Toggleable from profile menu.

**Poe (lovey) follower:** trails Caius from Ch1 onward, except during Ch5 HoliDad Inn (stays in crib) and Ch8 Phase 1 (is one of the stuffies being tucked in).

## 7. The House (Overworld)

**Map:** Tiled top-down, ~30x40 tiles, all interior except backyard.

**Rooms:**

```
[ NURSERY ]----[ MASTER BEDROOM ]
   M1,M2,M3,M8     M5
        |               |
[ HALLWAY ]----[ HALLWAY ]
        |               |
[ KITCHEN ]----[ LIVING ROOM ]----[ GARAGE ]
   M7              M4,M6,M9,M11      M12 (locked)
        |               |
[ PLAY AREA ]   [ BACKYARD ]
   M10, Mama        (encounter zone)
```

- Doorways are 2-tile-wide gaps with soft fade transitions
- Glowing chapter markers in each room; star appears when complete
- Garage locked until Ch11 complete
- Wild encounters trigger in hallway/backyard tiles (5% to 20% ramp)
- Resume on load: drop player at last room/position

## 8. Interludes (Chelsea-Focused)

Interludes are not numbered as months. They are emotional beats that auto-trigger after specific chapters.

### Interlude I: First Days
**Triggers:** automatically after Ch1 completes, before returning to overworld.

- **Setting:** nursery, soft warm lighting
- **Mechanic:** tap to advance time. Each tap shifts the room's lighting and shows Chelsea in a new pose with Caius:
  1. **3am** - Chelsea in rocker, eyes half-closed, slowly rocking
  2. **Sunrise** - holding him at the window, looking out
  3. **Noon** - on the couch, smiling tiredly at him
  4. **Sunset** - swaddling him on the changing table
  5. **Late night** - asleep in the rocker with him on her chest
- Each pose shows a soft caption text at the bottom:
  - "Welcome home."
  - "I've got you."
  - "We figured out the swaddle."
  - "First bath, we both cried."
  - "She got him through the first weeks."
- Optional: play Chelsea's hummed lullaby softly under the whole scene.
- **End:** fade to "She did the first shift. All of them." Save and return to overworld.
- **Duration:** ~75 seconds.

### Interlude II: Mama
**Triggers:** automatically after Ch9 completes, before Ch10 unlocks.

- **Setting:** open floor plan, Caius on a play mat. Chelsea visible in adjacent rooms doing tasks.
- **Mechanic:** 6 rounds. Each round:
  1. Chelsea is shown doing a task in another room (folding laundry, on a call, washing dishes, soothing Soka, making coffee, finally just sitting nearby)
  2. A small "call" button pulses on screen (no words yet, this is preverbal)
  3. Tap the call button: she immediately stops her task, walks to Caius, picks him up, holds him close for a beat, sets him back down, and goes back
  4. Patience meter on Caius depletes if you wait too long, but failure isn't real - she still always comes
- **Round 6:** she doesn't return to a task. She sits down next to him and just stays.
- **End card:** "She always comes."
- **Duration:** ~3 minutes.
- **Track event:** `interlude_completed` with `interlude_id: 'mama'`.

## 9. Chapters (1 to 12)

Pattern for every chapter:
1. Intro: 1-2 dialogue boxes (~5 sec)
2. Gameplay (~2 to 3 min)
3. Outro: celebration + save
4. Return to overworld

### Ch1: Arrival
- **Setting:** dark nursery, dim spotlight on Caius in crib
- **Mechanic:** sound-wave UI pulses from one of three directions. **First sound is always Chelsea's voice/heartbeat** (the first sound he ever knew). Second is Dad's voice. Third is a dog bark. Tap the direction the sound came from. 3 rounds.
- **Intro card:** "The first sound he ever knew."
- **Win:** identify all 3 sounds
- **Unlocks:** nothing (still stationary)
- **After completion:** triggers Interlude I: First Days

### Ch2: First Smile
- **Setting:** living room, Chelsea sitting on the floor holding Caius
- **Mechanic:** rhythm game. **All three smiles are for Chelsea.** She makes faces (silly, surprised, loving). Tap the screen when her expression peaks to "smile back." 3 successful smiles total.
- **Intro card:** "His first smile was for her."
- **Win:** 3 smiles back at Chelsea
- **Unlocks:** nothing (still stationary)

### Ch3: Eyes Open
- **Setting:** under mobile, with a touch-and-feel book in view
- **Mechanic:** pages flip every 4 sec. Tap the textured object before flip. 6 pages.
- **Win:** 5 of 6 successful taps
- **Unlocks:** eyes-only state (cosmetic)

### Ch4: Roll Out
- **Setting:** living room rug
- **Mechanic:** tilt or swipe to roll Caius toward the VTech busy cube. Obstacles in the way. Roll has momentum.
- **Win:** reach the cube
- **Unlocks:** rolling movement on overworld

### Ch5: HoliDad Inn (two phases)

**Phase 1: Bed Dive-Bomb**
- Setting: parents' bed. Chelsea is asleep on her side of the bed (silent background presence, blanket gently rising/falling).
- Mechanic: inverted controls. Tilt left = lean right (he wants to dive off). Hold center for 20 sec as bed "tilts."
- Fail: rolls off, Dad swoops in (Super Baby airplane), reset to center.

**Phase 2: Crawl to HoliDad Inn**
- Setting: same room, Dad now sitting up
- Mechanic: first crawl. Tap-tap rhythm alternating L/R hands. Cross the bed to Dad's shoulder.
- Win: arrive at Dad's shoulder. Lullaby plays. Soft glow fade.
- Unlocks: crawling

### Ch6: Grab Bag
- **Setting:** living room floor, toys scattered
- **Mechanic:** rattles/rings spawn. Tap to grab. 4 dogs roam:
  - Finn: fast straight runs
  - Nugget: slow, greedy
  - Eevee: diagonal pounces
  - Soka: short teleport-style dashes
- 60 sec
- **Win:** 10+ items grabbed
- **Unlocks:** grab mechanic

### Ch7: First Bites
- **Setting:** high chair, kitchen. **Chelsea is the one holding the spoon.**
- **Mechanic:** spoon swings in. Foods:
  - Good (tap to eat): strawberries, blackberries, blueberries, Cheerios, chicken
  - Bad (swipe away): meat purées, brown mush
- 12 spoons. Chelsea reacts emotionally to each (delight on berries, laughs at purée rejection).
- **Win:** 10+ correct responses
- **Unlocks:** snacks cosmetic, chicken cargo for M12

### Ch8: Sleep Training (two phases)

**Phase 1: Goodnight to the Stuffies**
- Tap each of 6 stuffies (Poe is one) to say goodnight. Order doesn't matter.

**Phase 2: Night Cycle**
- Clock spins 8pm to 6am (~45 sec)
- Periodic "call for HoliDad Inn" urges appear as glowing buttons. **Resist by tapping a calming icon, which is a small photo/sprite of Chelsea.** Tapping briefly shows her face + plays a soft hummed lullaby (her recording).
- Snot sucker swoops in twice, must be dodged
- **Win:** survive the night
- **Unlocks:** nothing (he sleeps in his own bed now)

### Ch9: Maze Walker
- **Setting:** living room as a maze (cushions, ottoman, laundry baskets, dog beds)
- **Mechanic:** infant walker. D-pad with momentum/drift. Navigate to **Chelsea** (Mom now waits at the end).
- Time trial: under 90 sec for star
- **Win:** reach Chelsea
- **Unlocks:** walker state for overworld
- **After completion:** triggers Interlude II: Mama

### Ch10: Chatterbox
- **Setting:** play area, family around
- **Mechanic:** word bubbles float up:
  - Base words: mama, dada, Finn, Nugget, Eevee, Soka
  - Nicknames (auto-collected): bubbaman, pumpkin head, bing bot, Caius McButtersworth, super baby
- Match base words to right person/dog by drag or tap-pair.
- **Secret Brutus path:** "super baby" bubble leaves a glowing speck when collected. Tap the speck 5 times for hidden Poe dialog: "Pssst... want to hear a secret? They almost called him Brutus." Unlocks Brutus skin.
- **Win:** match 8+ base words
- **Bonus:** all 5 nicknames unlocks Crime Fighting Super Baby chapter
- **Unlocks:** speech (Caius gets text in later cutscenes)

### Ch11: Ledges
- **Setting:** living room, floor is "lava" (carpet glows playful orange)
- **Mechanic:** cruise furniture edges. Couch → ottoman → coffee table → armchair → final floor walk.
- Hold "grip" button to stay on furniture, release to step. 3 gaps.
- Last gap: release entirely, take first steps across the lava floor to **Chelsea**.
- **Win:** reach Chelsea
- **Unlocks:** walking (full overworld, garage opens)

### Ch12: Liftoff
- **Setting:** garage door opens to reveal a rocket ship
- **Mechanic:** 10 sub-systems, each ~10 sec, tied to a prior milestone:
  1. Smile fuels engines (rhythm tap)
  2. Eyes calibrate navigation (find 3 stars)
  3. Roll loads boosters (swipe)
  4. Crawl docks fuel line (tap-tap rhythm)
  5. Grab loads cargo (tap 5 toys onto rocket)
  6. First Bites fills snack drawer (tap good foods only)
  7. Sleep autopilot (hold a node for 5 sec)
  8. Walker positions gantry (d-pad to target)
  9. Words activate comms (tap "ready" bubbles)
  10. Ledges grip launch tower (hold to grip)
- Final tap: LAUNCH button. Cinematic ignition.
- **Win:** all 10 systems green, launch pressed
- **Unlocks:** post-credits

## 10. Wild Encounters

Random interrupts in hallway/backyard tiles, ~30-60 sec each. Clearing all 5 awards a cape cosmetic.

### Snot Sucker
- Swoops at Caius 3 times. Swipe opposite to dodge each. 3 dodges = win.

### Face and Hands Wash
- Washcloth from 4 cardinal directions in sequence. Tap opposite arrow. 4 avoids = win.

### Bottle Wait
- Bottle filling at top of screen. Patience meter depletes. Tap pacifier to refill meter. Don't hit zero before bottle is full (~30 sec).

### Changing Table
- Random tilts push Caius toward edge. Tap opposite side to recover. Survive 20 sec.

### Roomba
- Open room with furniture islands (under-table, behind couch, on dog bed). Roomba moves straight, turns at walls. Reach 3 safe zones in 60 sec.

## 11. Bonus Chapter: Crime Fighting Super Baby

- **Unlock:** collect all 5 nicknames in Ch10
- **Setting:** sky/clouds, cartoon city below
- **Mechanic:** Caius with cape, Dad's arms underneath in airplane pose. Falling toys from above. Tilt/drag to catch before they hit the ground. 60 sec. Combos of 3+ for bonus.
- **Win:** catch 15+ toys
- **Unlocks Brutus skin** (different cape color, sprite tint).

## 12. Post-Credits Sequence

Auto-plays after Ch12 launch.

1. Rocket exits atmosphere. Fade to space.
2. Camera pulls back. Earth visible, sun in distance.
3. Rocket traces orbital arc around the sun (first time orbit shown).
4. Passing the far side, background stars slowly form **Duckie's shape**, glow 4 sec, fade.
5. Rocket returns to Earth, lands in backyard.
6. **Camera lingers on Chelsea standing in the doorway alone for 3 seconds. She's the first one he sees.**
7. Family pours out behind her. Dogs included.
8. Title card: "Caius, one year around the sun. Happy birthday."
9. Credits roll over slow pan of the house.
10. "Made with love by Dad."
11. **Final dedication card:** "For Chelsea, who made all of this possible. He knows. We both know."

A separate AI-generated cinematic video may replace this later. Build the in-engine version first.

## 13. Build Priority (Not a Schedule)

Build in this order. Each phase is shippable as a playtest milestone.

**Phase 1: Foundation (must work before anything else)**
- Project scaffold (Vite + Phaser + TS)
- Profile picker, save system, localStorage
- PostHog analytics (event scaffold, even if no events fire yet)
- House overworld with all rooms and walkable Caius placeholder
- Chapter card UI
- Touch controls

**Phase 2: Core gameplay (the spine of the game)**
- Ch1, Ch4, Ch5 (Caius's mobility progression: arrival → roll → crawl)
- Ch11, Ch12 (the ending arc)
- This gives a playable beginning-middle-end demo

**Phase 3: Fill out the middle**
- Ch2, Ch3, Ch6, Ch7, Ch8, Ch9, Ch10
- Bonus chapter

**Phase 4: Heart**
- Interlude I: First Days
- Interlude II: Mama
- Post-credits with Duckie constellation and Chelsea doorway moment

**Phase 5: Side content**
- All 5 wild encounters
- Brutus skin secret unlock path
- Cape cosmetic

**Phase 6: Polish**
- Audio integration (music, SFX, voice recordings)
- Animation tuning
- Performance pass
- Bug fixes
- Final dedication cards

**Phase 7: Ship**
- Vercel deploy
- Multi-device testing
- Share link

If short on time, cut Ch3 to a cutscene and reduce wild encounters from 5 to 3. Do not cut interludes or post-credits.

## 14. Deploy

```bash
npm run build
vercel deploy --prod
```

Optional custom domain.

## 15. Implementation Notes

- **Mobile first.** Touch only. No hover. Test iOS Safari first.
- **Touch controls.** Virtual d-pad bottom-left, action button bottom-right when movement is needed. Hide during chapters that use only tap/swipe.
- **Performance.** 60fps target on iPhone 12+. Compress PNGs. <50 on-screen sprites.
- **Accessibility.** Text 18px+. High contrast. No flashing under 3Hz.
- **Failure handling.** Never show "Game Over." Always: gentle reset + Poe encouragement. Examples: "Try again, bubbaman!" "You almost had it."
- **Audio policy.** Start muted (iOS rules). One-tap unmute on first interaction.
- **No backend, no accounts.** Pure client-side. localStorage only. PostHog is the only external call.
- **PostHog key.** Add to `.env.local` as `VITE_POSTHOG_KEY`. Never commit.
- **Asset placeholders.** Start with labeled colored rectangles. Replace incrementally. Do not block code progress on art.
- **Resume.** Restore active profile's room/position on load. Mid-chapter exits restart that chapter from intro.

## 16. Future Hooks

Reserved space (do not build, but leave structure for):
- Hidden notes from Dad readable in a future "Letters from Dad" room (add a locked drawer in play area)
- Optional AI-generated cinematic for post-credits (scene swappable for a video tag)
- Year 2 expansion (placeholder)

---

**End of spec.**
