# IC Zombies: BBS edition (spike)

An ASCII / ANSI version of IC Zombies for terminals and the sodamachine BBS. It runs **the same game
code as the web version**, in Node, with no copy of the rules and no old JavaScript.

| File | What it does |
|---|---|
| `engine.js` | Loads the web game's scripts into Node, unchanged, in the order `index.html` lists them. Page-only things (`document`, buttons) get harmless stand-ins, and `render()` is pointed at the door's screen. |
| `screen.js` | Draws the game as an 80×24 grid: the map (each space is a 4×2 block with walls and doors), the players, the turn step, your hand and the key hints, plus the last two log lines. |
| `ansi.js` | Turns that grid into ANSI color codes, converting box-drawing and block characters to the BBS character set (CP437), or plain UTF-8 with `--utf8`. |
| `door.js` | The program itself: keyboard input, the turn steps, and drawing after every change. |

No packages to install; it only uses Node's built-in modules.

## Try it in VS Code

From the repo folder, in VS Code's terminal (make it at least 80×24):

```bash
node bbs/door.js --utf8               # solo
node bbs/door.js --utf8 --players 2   # hot-seat
```

Press `q` twice to quit (or Ctrl+C).

## Keys

| Step | Keys |
|---|---|
| Draw tile | `t` draw; the tile shows in yellow where it would go. Arrows (or `Tab`) jump between the spots it fits, `r` rotates it, `Enter` places it |
| Combat | `c` fight; if it goes badly: `b` spend a bullet, `h` spend a heart (reroll), `l` lose |
| Draw events | `e` |
| Roll | `r` |
| Move | arrows or `w` `a` `s` `d`, `x` to stop early |
| Zombies | `z` (they move on their own) |
| Discard | `1`–`3` discard that card, `n` keep your hand |
| End turn | `Enter` |
| Anytime | `Space` does the next step (draw, place, fight, draw cards, roll, zombies, keep hand, end turn); `1`–`9` play a card or pick an option; `?` help screen with every key and map symbol; `q` `q` quit |

## On the map

| Looks like | Means |
|---|---|
| `@` (one color per player) | players |
| `Z` green / `Z` red / `d` / `c` | zombie / government-enhanced zombie / dog / clown, followed by a number if several share a space |
| red `+` (♥ in UTF-8) | heart token |
| yellow `■` | bullet token |
| brown blocks | building interiors |
| yellow `+` in a wall | door |
| `...` `"""` `:::` | road, grass, parking |
| yellow walls / `░` | the drawn tile, previewed at the chosen spot / other spots it fits |

## What works in this spike

Drawing and placing tiles, combat and its choices, drawing and playing event cards, event-card choice
menus, rolling and moving (including forced moves), zombie movement, discarding, ending turns, and
hot-seat play. The game's own rules decide everything, exactly as on the web.

**Not yet:** cards that ask you to click a space on the board (Rocket Launcher, Dynamite, Minefield,
air ducts and similar) show a "web version only for now" note; there's no online multiplayer, no
save/load, and only the base collection (Z1) is used. Online rooms can come later by talking to the
same `/api/games` server the website uses, so BBS and web players could share a game.

## Putting it on the BBS (later, once you push this)

`update-zombies.sh` already copies the whole repo to `/srv/apps/ic_zombies`, so `bbs/` arrives on the
Atom with every push. Then add it to Synchronet once, in `sudo -u sbbs /sbbs/exec/scfg`:
**External Programs → Online Programs (Doors)**, add a section (e.g. *Games*), then a program:

| Setting | Value |
|---|---|
| Name | IC Zombies |
| Internal Code | `ICZOMBIE` |
| Start-up Directory | `/srv/apps/ic_zombies` |
| Command Line | `/usr/bin/node bbs/door.js` |
| Native Executable/Script | Yes |
| I/O method | Standard (stdio) |
| Multiple Concurrent Users | Yes |

Each player runs their own Node process (roughly 40–60 MB), which is fine for the BBS's 4 nodes.