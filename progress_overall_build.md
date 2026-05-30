# Caius Birthday Game — Build Checkpoint
**Date:** 2026-05-29  
**Target deploy:** 2026-06-01 (Caius's birthday: June 4)

---

## What's Done

### Foundation (Phase 1) — Complete
- Phaser 3 + Vite + TypeScript strict scaffold
- `main.ts` fully wired: all 12 chapters, 2 interludes, 5 encounters, BonusChapter, PostCreditsScene registered and imported
- `HouseScene.ts` — overworld with rooms, walkable Caius placeholder (436 lines)
- `SaveManager.ts` — localStorage profiles, autosave, session time flush on tab close/background
- `PlayerState.ts` — mobility state gating (Stationary → Eyes → Rolling → Crawling → Walker → Cruising → Walking)
- `Analytics.ts` — PostHog scaffold, all event names defined
- `Settings.ts` — persistent mute/settings
- `SoundBank.ts` — audio synthesis system, iOS WebAudio context shared with Phaser (245 lines)
- `SpriteBank.ts` — sprite placeholder system
- `DevMode.ts` + `DevModeOverlay.ts` — dev tooling
- `EncounterManager.ts` — encounter trigger/cooldown logic
- `ProfilePicker.ts` — profile picker UI (228 lines)
- `HUD.ts` — pause button, mute toggle, pause menu (Resume/Restart/Exit to House) (132 lines)
- `TouchControls.ts` — virtual d-pad + action button
- `ChapterCard.ts` — chapter intro/outro UI
- `rooms.ts` — room layout definitions

### All Scenes Scaffolded
Every scene file exists with meaningful implementation (not empty stubs):

| Scene | Lines | Notes |
|---|---|---|
| Ch01_Arrival | 219 | Sound-wave direction tap, Chelsea's heartbeat first |
| Ch02_FirstSmile | 203 | Rhythm game, all 3 smiles for Chelsea |
| Ch03_EyesOpen | 171 | Page-flip tap timing |
| Ch04_RollOut | 181 | Tilt/swipe roll with momentum |
| Ch05_HoliDadInn | 329 | Two phases: inverted tilt + crawl tap-tap |
| Ch06_GrabBag | 255 | 4 dogs, 60-sec toy grab |
| Ch07_FirstBites | 225 | Spoon tap/swipe, Chelsea holds the spoon |
| Ch08_SleepTraining | 268 | Stuffie goodnight + night cycle resist |
| Ch09_MazeWalker | 163 | Walker d-pad maze, ends at Chelsea |
| Ch10_Chatterbox | 277 | Word match, nicknames, Brutus secret path |
| Ch11_Ledges | 273 | Furniture cruise + floor walk to Chelsea |
| Ch12_Liftoff | 388 | 10 sub-systems recap + cinematic launch |
| Interlude01_FirstDays | 274 | 5 time-of-day poses, Chelsea with Caius |
| Interlude02_Mama | 247 | 6-round call mechanic, she always comes |
| BonusChapter | 177 | Crime Fighting Super Baby airborne catch |
| PostCreditsScene | 463 | Orbit, Duckie constellation, Chelsea in doorway |
| HouseScene | 436 | Overworld |
| BootScene | 110 | iOS audio unlock on first interaction |
| MenuScene | 48 | Profile picker entry point |
| SnotSucker | 136 | Swipe-dodge encounter |
| FaceWash | 126 | Arrow-tap encounter |
| BottleWait | 115 | Patience meter encounter |
| ChangingTable | 93 | Tilt recovery encounter |
| Roomba | 198 | Safe-zone navigation encounter |

**Total source:** ~7,200 lines across src/

---

## What's NOT Done Yet

### Assets — Nothing Real Exists
All visual and audio output is placeholder (colored rectangles, synthesized tones). No real sprites, no real audio files, no tilesets. This is the largest remaining gap between "it runs" and "it feels like the game."

- [ ] Caius sprite sheet (all mobility states: stationary, rolling, crawling, walker, walking)
- [ ] Chelsea sprite (multiple poses for interludes, Ch2, Ch7, Ch9, Ch11)
- [ ] Dogs: Finn, Nugget, Eevee, Soka
- [ ] Poe (lovey follower)
- [ ] House tileset / room backgrounds
- [ ] UI sprites (chapter markers, glowing stars, red cape, pause icon)
- [ ] Rocket (Ch12 + post-credits)
- [ ] Audio: background music, SFX per chapter, music-box lullaby placeholder

### Code — Likely Needs Depth Work
Scene files are scaffolded with meaningful structure but have not been playtested end-to-end. Likely gaps:
- [ ] Chapter-to-chapter transition flow (HouseScene ↔ chapter ↔ interlude sequencing)
- [ ] Encounter trigger integration with HouseScene tile zones
- [ ] Save/load restoring correct room position
- [ ] Mobility state actually gating overworld movement
- [ ] iOS tilt permission prompt + swipe fallback in Ch4, Ch5 Phase 1, Ch8, BonusChapter
- [ ] PostCreditsScene Chelsea doorway moment (the 3-second linger)
- [ ] Brutus skin unlock flow end-to-end
- [ ] Ch10 glowing red cape appearance after all 5 nicknames

### Not Started
- [ ] Audio pipeline for voice recording slot (music-box placeholder → Chelsea recording swap via filename only)
- [ ] Vercel deploy + `.env.local` PostHog key wired to production
- [ ] Multi-device testing (iOS Safari, Android Chrome)
- [ ] Share link / social card

---

## Key Decisions Already Made (don't re-litigate)

| Topic | Decision |
|---|---|
| Tailwind | v4, `@tailwindcss/vite` plugin, no `tailwind.config.js` |
| Tilemaps | Skip Tiled — programmatic rooms only |
| iOS audio unlock | Boot/Menu scene, before Ch1 ever loads |
| iOS tilt | "Tilt to play" prompt + mandatory swipe fallback |
| Voice recordings | Music-box placeholder ships in v1; Chelsea is v1.1 |
| Wild encounter ramp | 3–10%, 60-second cooldown |
| Ch10 win condition | 5 of 6 base word matches |
| Ch11 gaps | 3 furniture gaps + 1 floor walk to Chelsea |
| Poe in Ch5 | Stays in nursery (spec says crib — spec is wrong) |
| Ch12 intro words | "Mama. Dada." |
| Post-credits word | "Mama!" (joyful) |
| Cut order if behind | Ch3 → cutscene first; drop BottleWait + FaceWash; never cut interludes/post-credits/Ch1 audio/Ch5 lullaby |
| Dedication | "For Chelsea, who made all of this possible." — non-negotiable |

---

## Recommended Next Steps (in order)

1. **Run the game and walk it.** `npm run dev` → boot → menu → house → enter Ch1. See what's broken in the actual flow before building more. Fix scene transition sequencing first.
2. **Drop in placeholder art that looks like something.** Even simple pixel-art colored character sprites (not rectangles) will make playtesting feel real and reveal hitbox/scale issues early.
3. **Ch1 → Interlude I → House flow.** Lock down the emotional opener end-to-end. If this beat lands, the rest has a north star.
4. **Ch11 → Ch12 → PostCredits.** The ending arc. Ship a playable beginning and end before filling the middle.
5. **Wire up encounters in HouseScene.** Tile-zone trigger + EncounterManager integration.
6. **Audio pass.** Music-box lullaby placeholder for Ch5 Phase 2 lullaby moment and Interlude I/II.
7. **Vercel deploy.** Get a real URL as early as possible for mobile testing on actual iOS Safari.

---

## Deploy Checklist (for June 1)
- [ ] `npm run build` clean (no TS errors)
- [ ] `.env.local` has `VITE_POSTHOG_KEY`
- [ ] Tested on iPhone (iOS Safari)
- [ ] Tested on Android (Chrome)
- [ ] `vercel deploy --prod`
- [ ] Share URL confirmed working
