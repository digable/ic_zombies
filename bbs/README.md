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

**Player name.** On the BBS, player 1 is named after the logged-in user: the door reads `DOOR32.SYS` from the node
directory Synchronet gives it (`$SBBSNODE`). Locally, use `--name Digable`, or `--dropfile path/to/door32.sys`.

## Try it in VS Code

From the repo folder, in VS Code's terminal (make it at least 80×24):

```bash
node bbs/door.js --utf8               # solo
node bbs/door.js --utf8 --players 2   # hot-seat
```

Press `q` twice to quit (or Ctrl+C).

## How a turn looks

The steps run across the top (**tile, fight, cards, roll, move, zombies, discard, end**) with the current one lit.
In the sidebar, the lit key is the one to press next; **Space** always does that next step. Drawing cards and moving
the zombies happen on their own, since there's nothing to decide (`a` turns that off).

## Keys

| When | Keys |
|---|---|
| Anytime | `Space` next step, `1`–`5` look at a card in your hand (then `p` play it, or `d` discard it at the discard step), `i` items in front of you (then `a` to use one), `m` look around the map with the arrow keys (your character doesn't move), `?` help, `Esc` close a box or stop looking, `q` `q` quit |
| Tile | `t` draw; it shows in yellow with its zombies/hearts/bullets in the sidebar. Arrows (or `Tab`) pick a spot, `r` rotates, `Enter` places |
| Fight | `c`; if the roll misses, a fight box shows your roll, what you need, and each option's outcome (the good choice is green): `b` bullet, `h` heart reroll, `f` First Aid Kit, `k` Lucky Shot, `1`–`9` a weapon item, `l` lose |
| Roll / move | `r`; arrows or `w` `a` `s` `d` to move, `x` to stop early |
| Discard | pick a card, `d`; or `n` to keep your hand |
| End turn | `Enter` |

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
| BBS Drop File Type | DOOR32.SYS (so the game uses the player's BBS name) |
| Place Drop File In | Node Directory |
| I/O method | Standard (stdio) |
| Multiple Concurrent Users | Yes |

Each player runs their own Node process (roughly 40–60 MB), which is fine for the BBS's 4 nodes.
