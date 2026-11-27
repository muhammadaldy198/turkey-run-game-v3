# GOBBLE OR GONE: The Long Run to Dawn

[![make.fun · turkey-run-game-01](https://make.fun/badge/turkey-run-game-01.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![make.fun · rank](https://make.fun/badge/turkey-run-game-01/muhammadaldy198/turkey-run-game-v3/rank.svg)](https://make.fun/bounty/turkey-run-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)
[![make.fun · reward](https://make.fun/badge/turkey-run-game-01/muhammadaldy198/turkey-run-game-v3/reward.svg)](https://make.fun/bounty/turkey-run-game-01?utm_source=github&utm_medium=readme&utm_campaign=turkey-run-game-01)

**A turkey runs 1500 metres through farmyard, barn, kitchen and a playable dawn woods, outrunning a farmer who chases, searches and corners — against a 120-second dinner bell a clean run only just beats.**

## How to run

```sh
node serve.ts        # serves the game on http://localhost:8080
```

Open http://localhost:8080 and play: Space jumps, Down slides, Shift dashes, H hides, G gobbles, P pauses. `?shot=chase|title|gate|escaped&seed=N` stages a screenshot scene.

## The game

- **4 zones, 1500 m:** farmyard (hay, fences, mud) → barn (beams, crates) → kitchen (oven jets, falling carving knives) → woods (roots, branches, fallen logs, fireflies). The woods is a playable fourth zone, not a backdrop.
- **The bell bites:** a clean run takes ~104 s of the 120 s bell. Every stumble, every hide and every mud patch eats the time bonus — run out of time and the bell rings dinner.
- **Hide (H):** duck into a haystack, a pantry crate or a bush. The farmer runs past — but the clock keeps ticking, and if you stay hidden he stops and searches the haystack. Stay and he finds you.
- **Dash (Shift):** a stamina-costed burst. It opens the gap and clears long hazard stretches, but stamina is finite and golden feathers are the only refill.
- **Gobble (G):** scare the farmer back 80 px, on an 8-second cooldown.
- **The farmer chases, searches and corners:** he runs a little faster than you, doubles his pace under 20 seconds on the bell, searches any haystack you hide in too long, and cuts the corner at every gate.
- **Gates:** three beam gates — jump the beam for the upper path (golden feather +65) or slide under for the lower path (+10). The Dawn Gate at 1500 m is the finish.
- **Score:** corn × 10 + gates & golden + distance (1 point per metre, wired in as `distBonus`) + time bonus (seconds left × 5). 3 feathers: lose one each time the farmer catches you.

## Method

The track is generated from a seeded generator (`?seed=N` replays the same track), the simulation runs at a fixed 1/60 s step, and the four screenshots are staged by an autopilot that plays the real rules — no frame is posed by hand. Sounds are synthesized in the browser; the game loads nothing over the network.

## License

MIT — see [LICENSE](LICENSE).
