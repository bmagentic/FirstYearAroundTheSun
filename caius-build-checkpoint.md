# Caius Birthday Game — Build Checkpoint (CONSOLIDATED)

**Updated:** 2026-06-03
**Birthday:** 6/4 · **Party / true ship:** 6/6
**Status:** Single source of truth for the build. Lives in the repo; both the Mac session and the browser session read and update THIS file.

---

## TL;DR — where this actually is

- All art generation is COMPLETE (PixelLab work done; only regenerate if playtest surfaces something).
- Top-down room system is built and proven: floor zones, foot-anchored sprites, depth sorting by feet, dev-mode drag-to-position tool that prints a paste-ready ROOM_OBJECTS array to the browser console.
- **Nursery = finished reference room** (objects placed, sized, baked, committed).
- **Living room = wired, awaiting drag-placement** (manifest keys added, LIVINGROOM_OBJECTS array with rough positions, drag tool generalized).
- Remaining gap: place the other rooms, wire chapter scenes to real sprites, walk the game end to end, deploy, playtest.

## THE ROOM LOOP (repeat per room)
1. Confirm the room's object sprites are on disk AND in the SpriteBank manifest (plushies taught us: on disk ≠ mapped).
2. Build/confirm its ROOM_OBJECTS array with rough positions.
3. Dev mode on → drag-place in browser → copy newest console array.
4. Bake the array into HouseScene, tsc clean, commit, push.

**Room status:** nursery DONE · living-room wired/unplaced · master, kitchen, dining, bathroom, garage, play-area, hallway-upper, hallway-lower not started.

---

## CANONICAL HOUSE (rooms.ts matches this — verified)
Upstairs: nursery, master-bedroom, bathroom — all off hallway-upper. Stairs to hallway-lower.
Main floor: hallway-lower → kitchen + living-room (open-concept direct door). Dining + play-area off kitchen. **Garage off living-room = M12 finale.** Backyard CUT.
Chapter homes: nursery M2/M3/M4/M8 · master M5 · dining M7 · living M6/M9/M11 + Super Baby bonus · garage M12 · bathroom + kitchen carry wild encounters.

---

## FLAGGED — do not lose
- [ ] Living room may have M2/M4 chapter markers wrongly assigned (terminal reported chapters 2,4,6,9,11 there). Verify markers in-room; fix rooms.ts assignment if wrong.
- [ ] Remove `caius-roll`, `caius-crawl-l`, `caius-crawl-r` from SpriteBank MISSING set (files exist now) so Ch4/Ch5 use real art.
- [ ] Kitchen vs living-room object split (open-concept): decide which pieces render in which room when placing the kitchen.
- [ ] M11 cruise chain (sectional → coffee table → side table → bar stool) must be placed in a traversable line — layout feeds the chapter mechanic.

## GARAGE: locked-state visual + unlock beat (M12)
- **Locked-door visual (build with garage room):** door must clearly read LOCKED all game. System exists (`locked?` check, tinted door, toast + bump-back in checkDoorways). Upgrade: lock/chain icon on the door gap + garage-specific "won't budge" feedback.
- **Unlock caption (build with M12 flow):** on locked→unlocked after final rocket sub-system, fire one-time caption pointing the player to the garage. Potential line (not final): *"\*click\* ...was that the garage door unlocking? - Caius"*.

---

## REMAINING WORK (priority order)
1. **Place remaining rooms** (room loop above). Living room next.
2. **Wire chapter scenes to real sprites** (most scenes still placeholder; only Ch4/Ch5/Ch11 + HouseScene reference SpriteBank).
3. **Walk it end to end:** boot → menu → house → Ch1 → Interlude I; then Ch11 → Ch12 → PostCredits (Chelsea doorway 3-sec linger). Fix transition sequencing.
4. **Encounters** wired to HouseScene zones; save/load restores room; mobility gating verified; iOS tilt prompt + swipe fallback (Ch4, Ch5p1, Ch8, Bonus); Brutus unlock; Ch10 red cape.
5. **Remaining sprites (non-generation-blocking):** Chelsea doorway (non-negotiable) / asleep / window; dad-sitting; Poe walk+sit; Duckie constellation; stuffies; food + UI can placeholder.
6. **Audio:** music-box lullaby placeholder (Ch5p2, Interludes); per-chapter SFX; Chelsea recording is v1.1 by filename swap. Brandon has audio files to organize.
7. **Deploy to Vercel EARLY** for real iOS testing; then friend playtest; then edits.
8. **LAST: title card + end/dedication card**, styled to the cinematic look once the Midjourney anchor is locked. Dedication text locked: "For Chelsea, who made all of this possible."

## Parallel: cinematic session (separate context)
Produces the 63-sec post-credits cinematic (Midjourney + Kling) + title/end card art; hands files back; makes NO game/room decisions. Drop-in target: PostCreditsScene.

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
