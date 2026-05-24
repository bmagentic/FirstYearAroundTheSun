# Art Assets Needed

Drop sprites into `public/assets/sprites/<id>.png` — the code already references these IDs and will swap in real art automatically. No code changes required.

**Style reference:** Gen 3 Pokémon (Ruby/Sapphire/Emerald). Top-down pixel for overworld, side-view pixel for in-bed/in-furniture chapters. Caius's palette: warm skin tone, light hair, soft cheeks.

**Suggested base sizes:** 24×24 for Caius and dogs (overworld), 32×32 for furniture, 64×64 for hero objects (rocket, crib).

---

## Characters

| ID | Description | Used in |
|---|---|---|
| `caius` | Idle pose, front-facing | Overworld, Ch1, Ch2, Ch5, Ch7, Ch9, Ch10 |
| `caius-walk-front` `caius-walk-back` `caius-walk-left` `caius-walk-right` | 2-3 frame walk cycles | Overworld walker/walking state |
| `caius-roll` | Side-view, rolling pose | Ch4 |
| `caius-crawl-l` `caius-crawl-r` | Side-view, alternating hands | Ch5 Phase 2 |
| `caius-cape` | Cape variant for bonus chapter | Bonus, post-bonus skin toggle |
| `chelsea-idle` | Sitting on floor, holding | Ch2, Ch9, Ch11 |
| `chelsea-spoon` | Holding a spoon | Ch7 |
| `chelsea-asleep` | Asleep on her side, blanket | Ch5 Phase 1 background |
| `chelsea-rocker` | In rocking chair holding Caius | Interlude I |
| `chelsea-window` | Holding Caius at window | Interlude I |
| `chelsea-doorway` | Standing in doorway (post-credits) | Post-credits |
| `dad-airplane` | Super Baby airplane catch pose | Ch5 Phase 1 fail, bonus chapter |
| `dad-sitting` | Sitting up in bed | Ch5 Phase 2 |
| `poe` | The lovey (small stuffed companion) | Overworld follower, Ch8 |

## Dogs

| ID | Description |
|---|---|
| `finn` | Fast-runner dog |
| `nugget` | Slow, greedy dog |
| `eevee` | Diagonal-pouncing dog |
| `soka` | Teleport-dashing dog |

## Stuffies (Ch8 Phase 1)

| ID | Description |
|---|---|
| `stuffy-1` through `stuffy-6` | One slot is Poe, others are anonymous plushies |

## Rooms (overworld floor + walls)

Programmatic for now; can be replaced with tilemaps later. If you want to skip ahead and provide them, drop tiled JSONs in `public/assets/tilemaps/`.

## Set pieces

| ID | Description | Used in |
|---|---|---|
| `crib` | Wooden crib, top-down or 3/4 view | Ch1, Nursery |
| `mobile` | Hanging mobile | Ch3 |
| `touch-book` | Touch-and-feel book pages | Ch3 |
| `vtech-cube` | VTech busy cube | Ch4, Living Room marker |
| `bed` | Parents' bed (side-view) | Ch5 |
| `high-chair` | Kitchen high chair | Ch7 |
| `food-strawberry` `food-blueberry` `food-blackberry` `food-cheerio` `food-chicken` | Good foods | Ch7, Ch12 |
| `food-puree` `food-mush` | Bad foods | Ch7 |
| `furniture-couch` `furniture-ottoman` `furniture-coffee-table` `furniture-armchair` | Ch11 furniture cruise | Ch11 |
| `cape` | Red superhero cape | Bonus chapter pickup |
| `rocket` | Tall pixel rocket | Ch12, Garage |
| `garage-door-closed` `garage-door-open` | Garage entrance | Living Room |
| `duckie-constellation` | Star cluster shaped like a duck | Post-credits |

## UI

| ID | Description |
|---|---|
| `ui-dpad-bg` `ui-dpad-up` `ui-dpad-down` `ui-dpad-left` `ui-dpad-right` | D-pad styling |
| `ui-grip-button` | Ch11 grip button |
| `ui-step-button` | Generic action button |
| `star-complete` | Star drawn on completed chapter markers |

## Audio (parallel ask, drop in `public/assets/audio/<id>.ogg`)

| ID | Description |
|---|---|
| `chelsea-heartbeat` | Low warm thump (placeholder is synthesised) |
| `dad-voice` | "Hey buddy" warm hum |
| `dog-bark` | Friendly puppy bark |
| `success-chime` | Win sting |
| `soft-fail` | Gentle "try again" tone |
| `lullaby` | Music-box version of Chelsea's hummed lullaby (placeholder per build-notes §8) |
| `rocket-launch` | Ignition rumble for Ch12 |
| `caius-laugh` | Recorded laugh for post-credits |

When real recordings exist, replace the file at that path — no code changes needed.
