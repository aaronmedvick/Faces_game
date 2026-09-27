# TV Companion

A reality-TV prediction game. Pick a show and season nobody's watched yet, rate the
cast blind, then score points as the season actually plays out.

## Folder

- `index.html` — the game. Self-contained (all cast data + boot orders baked in).
  This is the file the hub launches. Set the TV Companion URL in `admin.html` to
  `tv_companion/`.
- `survivor_casts.json`, `antm_casts.json`, `beast_games_casts.json` — **source**
  rosters (name, age, hometown, profession). Rosters only, no results.
- `elimination_order.json` — **source** answer key: final boot order per season,
  first out → winner. Host-only.
- The game embeds baked copies of the above. The JSONs are the source of truth —
  edit them, then re-bake `index.html`.

## Scoring (current rules)

Your 1–20 rating on a cast member is a bet on how deep they go.

- Every round they **survive** → **+your rating**
- Every round **after** they're booted → **−your rating**
- The **winner** survives every round and is never booted → full upside

So a high pick who flames out early bleeds points all season; a high pick who reaches
the finale keeps almost all of it. Rate everyone the same and you net **exactly zero** —
your score is entirely how well you separated the deep runs from the early exits. No
budget cap needed.

### Dials
- **Bonus pick (★)** — drop bonus points (default 10) on one contestant. It rides
  inside that person's value: bigger reward if they go deep, bigger hit if they don't.
- **Endgame premium** — ×1.2 per late round (off by default). Makes finalists and the
  winner worth more, for a livelier endgame.
- **Penalty weight** — where a pick flips from hurting to helping.
  `1.0` = must beat the median (harsh, reads matter). `0.5` = forgiving (a respectable
  run stays near even). `0` = reward only (old model).

## Notes / TODO
- Boot order is **final placement**, which equals episode boot order in clean seasons
  but not in twist seasons with returns (Redemption Island, Edge of Extinction,
  Blood vs. Water; ANTM recalls). Fine for scoring; refine to episode-level later.
- Beast Games has no real result on file — the game shuffles a random boot order so you
  can still exercise scoring.
- **Spoiler note:** because the game is self-contained, the answer key is baked into
  `index.html` and is technically visible in the page source. Fine for solo/among
  friends. For real multiplayer, the answer key must move server-side (Supabase,
  host-only) so players can load rosters without the results.
