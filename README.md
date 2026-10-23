# VC IC Zombies

A browser-based board game adaptation of zombie survival. Draw tiles to build the city, fight zombies, scavenge loot, and reach the Helipad — or rack up 25 kills before anyone else does.

[![Play Now](https://img.shields.io/badge/Play%20Now-digable.github.io-orange)](https://digable.github.io/vc_ic_zombies/)
![Build](https://img.shields.io/badge/Build-None%20Required-brightgreen)

Clone and open `index.html` locally for single-device play — no build step required. For online multiplayer and bug reports, run `npm start` to launch the self-hosted server (needs the `sqlite3` module or Node 22.13+).

---

## Features

- **Tile-based city building** — draw and place map tiles each turn; roads must align via compass connectors; named buildings spawn zombies and loot on placement
- **Isometric view** — toggle 3D perspective at any time; tilt/spin sliders, zoom (0.3×–3.0×), click-drag pan; pawns counter-rotate to always face the camera; zombie dogs render as a low dog silhouette
- **Online multiplayer** — 4-character room codes, host-controlled start, automatic state sync every 1.5 s via polling; rejoining via invite link is always supported
- **Combat** — d6 + bonuses; spend bullets or hearts to reroll/boost; weapon items; mid-movement combat resolves and resumes; knockout respawns you at the nearest start tile
- **Zombie AI** — moves toward nearest player each phase; respects walls, doors, and connectors; government-enhanced zombies move 2 spaces; zombie dogs move 2 spaces, deal ½ heart damage, and can stack 2 per subtile; zombie clowns are zone-separated to Z7 tiles only and have a unique sprite and token
- **Event cards** — draw up to 3 per turn, play one; includes player buffs, opponent disruption, zombie manipulation, and Book of the Dead page cards (Z4)
- **Air ducts (Mall Walkers)** — duct subtiles offer teleport to any adjacent duct store; costs your next movement roll; zombies cannot use ducts
- **Book of the Dead (Z4)** — stage pages in front of you (uses your event play slot); remove one per round for effects; staged pages reduce the Cabin Spell roll target
- **Cabin Spell win condition (Z4)** — clear all dogs from Cabin building subtiles, be on a building subtile, roll d6 ≥ 6 minus staged page count
- **Subway stations (Z6)** — enter any subway station building to skip your next turn (combat only); on the following turn teleport to any other station on the board; exiting the building cancels the subway use
- **Sewer Tokens (Z6 variant)** — each player starts with 2 tokens to place on road spaces; enter the sewer at any token to move through any subtile and skip zombie combat; pay 1 life or guts per turn to remain underground; exit at any token; knockout surfaces you instantly; manhole cover icon marks placed tokens on the board
- **Send in the Clowns (Z7)** — Funhouse 2×2 block (Fun House 1–4) and Ticket Booth auto-placed at game start; collect the Clown Car item in the funhouse to unlock the Z7 escape win condition; leaving a funhouse tile causes it to randomly rotate, reshuffling its layout; reaching the funhouse perimeter lets the player to your left assign you a 4-Way exit point; rolling a 1 after exiting teleports you back to the funhouse and loses the Clown Car; clown zombies are zone-separated from regular zombies; Z7 event cards include reactive plays (Cotton Candy, Stuffed Animal), clown zombie manipulation (That's not a mask!, Important Clown Business, Send in the Clowns!), movement disruption (Whoaaa!, That's not an exit!, What do you mean funny?!?), and hand-lock (What the ____!?!)
- **Dodge (Z8 / Jailbreak variant)** — when enabled, rolling a 3 in combat dodges the zombie (no kill, no damage, continue moving); with a Straight Jacket item, any roll of 3+ dodges; auto-enabled when Z8 tiles or cards are selected
- **Save / Load** — 5 localStorage slots; export/import as timestamped `.json`; saving blocked during pending actions
- **Bug reports** — in-game modal attaches game state + last 20 log entries and opens a GitHub issue automatically
- **Mobile UI** — bottom tab bar (Controls / Map / Game Info / Hand); turn-strip accordion on the Map tab; pass-device lock screen for same-device multiplayer
- **Deck management** — "Show cards" dropdown lists the remaining deck; drag-and-drop reordering in both map and event deck panels
- **School's Out Forever (Z5)** — campus tile set; introduces **guts tokens** (start with 3, max 5): roll a natural 6 in combat to gain 1, roll a natural 1 to lose 1; guts count (0–5) sets your event hand limit; you always keep at least 1 event card regardless; death resets guts to 3; the school helipad uses a `DESIGNATED` connector and can only be reached by passing through a named building; Z5 player event cards include campus items (Bat, Pool Cue, I've got a bike!), guts manipulation (Shots, Electro-Shock Therapy, Sedatives, Straight Jacket, Pillow Fight), deck management (Cram Session, Valedictorian), and social cards (Student Loan, Go Team Go!!!, Raise your hand..., Where's the Admin Bldg.?, Scalpel)
- **Collections** — tile and event decks configured independently at setup; standalone collections (Z2, Z3, Z4, Z5, IC) get zone-isolated decks with gateway tiles unlocking them in mixed play; Z6 tiles and cards shuffle directly into the base deck

---

## Turn Order

| Step | Action |
|------|--------|
| 1 | **Draw & Place Tile** |
| 2 | **Combat Current Space** |
| 3 | **Draw to 3 Events** |
| 4 | **Roll & Move** — place sewer token before rolling (Z6 variant); air duct or subway teleport offer if applicable |
| 5 | **Move Zombies** |
| 6 | **Discard Event** (optional) |
| 7 | **End Turn** |

---

## Win Conditions

| Condition | Requirement |
|-----------|-------------|
| Escape | Reach the center subtile of the Helipad |
| Last Stand | Accumulate 25 zombie kills |
| Cabin Spell *(Z4)* | Clear dogs from Cabin building, roll d6 ≥ (6 − staged pages) |
| Clown Car Escape *(Z7)* | Collect the Clown Car in the Funhouse, exit the Funhouse, reach the Ticket Booth center subtile |

---

## Zombie Types

| Type | Kill Roll | Movement | Damage | Notes |
|------|-----------|----------|--------|-------|
| Regular | 4+ | 1 space | 1 heart | |
| Government-Enhanced | 5+ | 2 spaces | 1 heart | |
| Zombie Dog | 5+ | 2 spaces | ½ heart | Up to 2 per subtile; player may spend ½ heart to reroll |
| Zombie Clown *(Z7)* | 4+ | 1 space | 1 heart | Zone-separated to Z7 tiles; unique sprite |

---

## Collections

| Key | Code | Description |
|-----|------|-------------|
| `DIRECTORS_CUT` | Z1 | Base game — standalone |
| `ZOMBIE_CORPS_E_` | Z2 | Standalone / expansion — isolated zone when mixed |
| `MALL_WALKERS` | Z3 | Standalone / expansion — mall tiles, air ducts, 2-floor mechanics |
| `NOT_DEAD_YET` | Z3.5 | Event cards only — no map tiles |
| `THE_END` | Z4 | Standalone / expansion — bridge zone, BOTD pages, Cabin Spell |
| `SCHOOLS_OUT_FOREVER` | Z5 | Standalone / expansion — school campus; helipad only reachable through a named building's designated rooftop connector |
| `SIX_FEET_UNDER` | Z6 | Expansion (requires Z1) — tiles and cards mix directly into the base deck; subway stations, sewer token variant rule |
| `SEND_IN_THE_CLOWNS` | Z7 | Standalone / expansion — circus-themed; Funhouse 2×2 block + Ticket Booth auto-placed at start; zombie clowns zone-separated to Z7 tiles; Clown Car item + alternate escape win condition; funhouse tiles rotate on exit and teleport on roll-of-1 return |
| `JAILBREAK` | Z8 | Standalone / expansion — jailbreak theme; enables the Dodge variant rule; Straight Jacket item |
| `IOWA_CITY` | IC | Standalone / expansion — Iowa City locations |
| `SUBSCRIPTION` | SUB | Event cards only — no map tiles; add to any game |

---

## Variant Rules

| Variant | Enabled By | Description |
|---------|-----------|-------------|
| Guts Tokens | Z5 (auto-enabled) | Hand limit = guts count (0–5); gain 1 on natural 6, lose 1 on natural 1 in combat; death resets to 3 |
| Sewer Tokens | Z6 (auto-enabled) | Each player gets 2 tokens to place on road spaces; underground movement skips zombie combat; pay 1 life or guts per turn to stay under |
| Dodge | Z8 (auto-enabled) | Roll of 3 in combat dodges the zombie — no kill, no damage, movement continues; with Straight Jacket item any roll of 3+ dodges |

---

## Project Structure

```
vc_ic_zombies/
├── index.html                        # Game UI
├── tile-editor.html                  # Tile debug / editor panel
├── README.md                         # This file
├── LICENSE                           # MIT License
├── RULES_REFERENCE.md                # Official Zombies!!! rules & FAQ summary
├── package.json                      # npm start script
├── server.js                         # Self-hosting server: static files + /api routes
├── api/
│   ├── _db.js                        # SQLite connection, schema (sessions, rate_limit_hits), query queue
│   ├── _helpers.js                   # CORS, error helpers, code generator
│   ├── _rateLimit.js                 # Per-IP rate limiting (expiring records)
│   ├── games.js                      # POST /api/games — create session
│   ├── bug-report.js                 # POST /api/bug-report — create GitHub issue
│   └── games/[code]/
│       ├── index.js                  # GET poll + POST state push
│       ├── join.js                   # POST join session
│       ├── start.js                  # POST start game (host only)
│       └── leave.js                  # POST leave session
├── scripts/
│   ├── constants.js                  # All immutable config: TILE_DIM, WIN_KILLS, STEP, COLLECTIONS,
│   │                                 #   COLLECTION_META, DIRS, DOOR_LOCAL, ZOMBIE_TYPE, CONNECTOR_RULE,
│   │                                 #   TILE_DECK, SAVE_SLOTS, and collection helper functions
│   ├── core.js                       # Runtime state object and shared helpers (key, playerKey, etc.)
│   ├── bootstrap.js                  # Event listener wiring, game boot
│   ├── tile-debug.js                 # Tile editor page logic
│   ├── subtile-editor-row.js         # Subtile editor row renderer
│   ├── render/
│   │   ├── helpers.js                # Rendering utilities (formatTileCode, collection labels, road lines, air duct SVG)
│   │   ├── board.js                  # Board grid, player trail SVG, move status
│   │   ├── panels.js                 # Sidebar panels, combat UI, log, knockout banner, duct choice panel
│   │   ├── debug.js                  # Tile editor / map deck debug rendering
│   │   ├── render.js                 # Render orchestrator (updateButtons + render())
│   │   ├── save-load-panel.js        # Save/Load slot panel rendering
│   │   └── compass-checkboxes.js     # Compass direction checkbox helper (tile editor)
│   ├── actions/
│   │   ├── setup.js                  # Game setup, tile draw/place, companion tile logic
│   │   ├── combat.js                 # Combat resolution and knockout
│   │   ├── movement.js               # Player movement roll/step/end; subway and sewer token logic
│   │   ├── zombies.js                # Zombie movement phase
│   │   ├── events.js                 # Event hand draw/play/discard, pending action handlers
│   │   ├── turn-end.js               # End-turn cleanup, sewer toll, multiplayer sync
│   │   ├── save-load.js              # Save/load/export/import game state
│   │   ├── multiplayer.js            # Online session create/join/start/leave/poll/sync
│   │   ├── bug-report.js             # Bug report modal, compression, API call
│   │   └── win.js                    # Win condition checks (helipad, kills, Cabin Spell)
│   ├── rules/
│   │   ├── placement.js              # Tile placement, connector validation, zone isolation
│   │   ├── combat-flow.js            # Combat/zombie-step skip gating
│   │   ├── movement.js               # Step legality, air duct and subway destination finding
│   │   ├── zombie-ai.js              # Zombie targeting and one-step movement
│   │   └── board-bounds.js           # Dynamic board render bounds
│   └── data/
│       ├── map-tiles.js              # Barrel — assembles namedTiles from per-collection files below
│       ├── map-tiles/                # Per-collection tile definitions (load before map-tiles.js)
│       │   ├── road.js               # roadTiles — shared road/intersection tiles (all collections)
│       │   ├── z1.js                 # namedTilesZ1 — Director's Cut named tiles
│       │   ├── z2.js                 # namedTilesZ2 — Zombie Corps(e) named tiles
│       │   ├── z3.js                 # namedTilesZ3 — Mall Walkers named tiles
│       │   ├── z4.js                 # namedTilesZ4 — The End named tiles
│       │   ├── z5.js                 # namedTilesZ5 — School's Out Forever named tiles
│       │   ├── z6.js                 # namedTilesZ6 — Six Feet Under named tiles
│       │   ├── z7.js                 # namedTilesZ7 — Send in the Clowns named tiles
│       │   ├── ic.js                 # namedTilesIC  — Iowa City named tiles
│       │   └── special.js            # specialTiles  — win/start tiles (Helipad variants)
│       ├── map-deck.js               # buildMapDeck(), buildStartTile(), tile filtering/shuffling
│       ├── event-deck.js             # Event deck builder
│       └── event-cards/
│           ├── helpers.js            # Shared event utilities
│           ├── player-cards.js       # Player buff/recovery cards (Z1/Z2/Z3)
│           ├── player-cards-z35.js   # NOT_DEAD_YET player cards
│           ├── player-cards-z4.js    # THE_END (Z4) player cards
│           ├── player-cards-z5.js    # SCHOOLS_OUT_FOREVER (Z5) player cards
│           ├── player-cards-z6.js    # SIX_FEET_UNDER (Z6) player cards
│           ├── player-cards-z7.js    # SEND_IN_THE_CLOWNS (Z7) player cards
│           ├── player-cards-ic.js    # IOWA_CITY player cards
│           ├── player-cards-subscription.js # SUBSCRIPTION player cards (no map tiles)
│           ├── opponent-cards.js     # Opponent disruption cards
│           ├── zombie-cards.js       # Zombie spawn/remove/move cards
│           └── page-cards.js         # Book of the Dead page cards (Z4)
└── styles/
    ├── base.css                      # Design tokens, CSS custom properties (colors, spacing, player palette),
    │                                 #   and global element defaults
    ├── layout.css                    # Page layout, panels, topbar
    ├── components.css                # Tiles, micro-grid, badges, markers, multiplayer UI, bug report modal
    └── tile-debug.css                # Tile editor specific styles
```

---

## Technical Notes

- **Pure Vanilla JS** — no frameworks, no bundler, no build step; everything loads via `<script>` tags in order; global scope throughout
- **Constants / core split** — `constants.js` holds all immutable config (`STEP`, `COLLECTIONS`, `COLLECTION_META`, `DIRS`, `TILE_DECK`, etc.) and loads first; `core.js` holds only the runtime `state` object and helpers; tile data loads after both
- **3×3 subtile grid** — each map tile has a 3×3 movement grid with per-subtile walkability, walls, doors, and air ducts defined in `subTilesTemplate`
- **Incremental board rendering** — cells are fingerprinted each render; only changed cells rebuild their DOM; global occupant map computed once per render pass; player lookups use a `Map` keyed by id
- **CSS design tokens** — `base.css` defines all colors, spacing, and player palette as CSS custom properties (`--player-P1`, `--cell-width`, `--wall-thickness`, `--lane-color`, etc.); components reference variables, not raw values
- **Self-hosted backend** — `server.js` (Node built-ins only) serves the game and `/api` routes; SQLite (`data/game.db`) for multiplayer sessions and bug reports; polling-based sync (no WebSockets); rate-limited per IP via expiring records
- **Zone isolation** — standalone collection tiles connect only to their own zone except through a gateway tile with a `DISABLE_ON_SOLO` connector; gateway tile unlocks the standalone deck when placed
- **Connector rule system** — per-connector placement rules on each tile: `SAME` (same collection), `ANY` (any tile), `ONLY` (specific tile name), `DESIGNATED` (requires neighbor to have `ONLY` targeting this tile), and collection-key rules for cross-zone restrictions; bidirectional — both sides of a road connection must agree
- **Companion tiles** — some tiles auto-place one or more tiles from the deck (or a set-aside reserve) when drawn; companions can be placed with a rotation offset relative to the main tile (e.g. Big Top 2 rotates 180° to connect N-to-N with Big Top 1); `companionOnly: true` tiles are never shuffled into any deck
- **Mixed-deck expansion** — Z6 tiles and cards have `standaloneDeck: false` and `requiresBase: DIRECTORS_CUT`; they are filtered directly into the main deck by `buildMapDeck()` with no zone isolation or gateway tiles

---

## Rules Reference

Full rule summaries, card rulings, and FAQ answers from the official Zombies!!! rulebooks are in [RULES_REFERENCE.md](RULES_REFERENCE.md).

---

## Original Game

Fan adaptation of **Zombies!!!** by Twilight Creations, Inc. Consider supporting the original creators.

**[▶ Shop at Twilight Creations](https://www.twilightcreationsinc.com/)**

---

## Thanks

Special thanks to **Chris Troyer** and **Brian Walker** — playtester, great person, and an essential part of making this game better.

---

## License

MIT © 2026 digable — see [LICENSE](LICENSE) for full text.

---

*Made with ❤️ for Iowa City*
