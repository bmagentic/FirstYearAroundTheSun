# Spec Edits V1.1 — 2026-05-20

**Source:** Claude Code spec review of `caius-first-year-spec.md`
**Purpose:** Resolved answers to all spec review questions. Lives alongside the spec. Spec remains source of truth; this captures clarifications and decisions made on 2026-05-20.

---

## Approach

Build notes captures resolved decisions and clarifications. Spec is not edited; this addendum is referenced where the spec is unclear or wrong.

---

## Resolved Items

### 1. Ch10 win condition
Change to **"5 of 6 base word matches."** Don't expand the word list.

### 2. Ch11 gaps
Clarified as **"3 furniture gaps (couch → ottoman → coffee table → armchair) plus 1 floor walk to Chelsea."** Total of 4 transitions.

### 3. Poe in Ch5
Stays behind in the **nursery**, not the crib. Spec wording (Section 6) is wrong.

### 4. iOS tilt
Build a **"Tilt to play"** prompt before any tilt-required chapter. **Swipe fallback is mandatory** for accessibility, not just permission denials. Some players will be one-handed holding a baby.

### 5. iOS audio unlock
Unmute prompt fires on **Boot/Menu scene, before Ch1 ever loads.** The "first sound he ever knew" beat needs audio enabled. Do not defer to Ch1.

### 6. Tailwind
**v4.** Uses `@tailwindcss/vite` plugin + `@import "tailwindcss";` in CSS. No `tailwind.config.js`, no postcss config.

### 7. Timeline cuts (in priority order if needed)
- Ch3 to cutscene (acceptable)
- Wild encounters 5 → 3 (drop Bottle Wait and Face Wash; keep Snot Sucker, Roomba, Changing Table for variety)
- **Do not cut:** interludes, post-credits, Ch1 audio, Ch5 Phase 2 lullaby moment

### 8. Voice recordings
**Permanent music-box lullaby placeholder** ships in v1. Chelsea recordings get added later as a personal v1.1 update if and when they happen. No creative dependency blocking launch. Build the audio pipeline so any clip can be swapped via filename replacement without touching code.

### 9. Tilemaps
**Skip Tiled.** Build programmatically. Migrate to Tiled later if expansion warrants.

### 10. Post-Ch10 speech (what Caius says)
- **Ch12 intro:** "Mama. Dada." (two soft words, as if naming his crew before launch)
- **Post-credits when family runs out:** "Mama!" (one joyful word)
- **Final card lead-in:** no dialog, just his recorded laugh
- Keep preverbal-believable. He's 12 months, words are precious.

### 11. Ch6 quota
**6+ to win, 10+ for star.** Confirmed.

### 12. Wild encounters
**3 to 10% ramp.** Add a **60-second cooldown** after any encounter clears so you can't hit two back to back.

### 13. Pause
Small pause icon top-right during chapters. Tap shows: **Resume, Restart, Exit to House.** Exit triggers the spec's "restart from intro" on next entry.

### 14. Sound toggle
Persistent mute icon next to the pause button. **Available in every scene including overworld.**

### 15. Bonus chapter trigger
After Ch10 completes with all 5 nicknames collected, a **glowing red cape appears in the play area** as a visible reward marker. Caius walks to it in the overworld to launch the bonus chapter. This makes the unlock feel earned and gives the player agency over when to play it.

---

**Status as of 2026-05-20:** Phase 1 foundation in progress.
