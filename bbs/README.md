# IC Zombies: BBS edition

An ASCII / ANSI version of IC Zombies for terminals and the sodamachine BBS. It runs **the same game
code as the web version**, in Node, with no copy of the rules and no old JavaScript.

| File | What it does |
|---|---|
| `engine.js` | Loads the web game's scripts into Node, unchanged, in the order `index.html` lists them. Page-only things (`document`, buttons) get harmless stand-ins, and `render()` is pointed at the door's screen. |
| `screen.js` | Draws the game as an 80×24 grid: the map (each space is a 4×2 block with walls and doors), the players, the turn step, your hand and the key hints, plus the last two log lines. |
| `ansi.js` | Turns that grid into ANSI color codes, converting box-drawing and block characters to the BBS character set (CP437), or plain UTF-8 with `--utf8`. |
| `door.js` | The program itself: the new-game screen, keyboard input, the turn steps, and drawing after every change. |
| `saves.js` | Keeps one saved game per BBS user, so you can quit and continue later. |

No packages to install; it only uses Node's built-in modules.

**Player name.** On the BBS, player 1 is named after the logged-in user: the door reads `DOOR32.SYS` from the node
directory Synchronet gives it (`$SBBSNODE`). Locally, use `--name Digable`, or `--dropfile path/to/door32.sys`.

## Try it in VS Code

From the repo folder, in VS Code's terminal (make it at least 80×24):

```bash
node bbs/door.js --utf8               # opens on the new-game screen
node bbs/door.js --utf8 --players 2   # same, starting at 2 players (hot-seat)
node bbs/door.js --utf8 --new         # skip the new-game screen: Director's Cut, no variants
```

Press `q` twice to quit (or Ctrl+C); your game picks up at the start of the turn you were on.

## New game screen

Pick the number of players (left/right), tick collections with their letters, and tick variant rules with
`x` (Guts), `y` (Sewer tokens), `z` (Dodge). It follows the web setup's rules: Six Feet Under turns on
Director's Cut, mixing two expansions turns on Director's Cut, and School's Out / Six Feet Under / Jailbreak
turn on their variant. Send in the Clowns stays off until it's finished on the web. `Enter` starts.

## Saving

The game saves itself at the start of every turn (each player's turn, in hot-seat). If you get
disconnected or quit partway through a turn, you come back to the start of that turn.

When you come back with a game saved, the door asks first: `c` continue it, or `n` start a new one
(which asks you to confirm with `y`, since starting over deletes the saved game). Each BBS user can have
one game going at a time: the save is per user, and if the same user opens the door on a second node,
it says the game is already open elsewhere. The save is removed when the game ends.

On the BBS saves go in `/sbbs/data/iczombies/` (one `.json` per user, plus a `.lock` while it's open);
locally in `~/.iczombies/` (or `--savedir DIR`).

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
| End turn | `Enter`; `v` casts the Cabin spell when you can (The End, Z4) |
| Cards that pick a space | Rocket Launcher, Dynamite, Mine Field, Frisbee, We're Screwed, This Isn't So Bad and the rest: spaces you can pick turn green. Arrows move the cursor, `Tab` jumps to the next green space, `Enter` picks, `x` finishes or cancels |
| Other card boxes | Zombie Dice Challenge: `1` `2` a bullet on a die, `3` `4` a heart to reroll, `Enter` accept. Air duct: `1`–`9` a store, `s` stay. Forced moves (Brain Cramp...): arrows move that player, `x` stops |
| Sewer tokens (Z6) | `o` place a token on a road, `u` drop into / climb out of the sewer |
| Book of the Dead (Z4) | page cards: `p` stages one; `i` shows pages in front of you, then a letter and `u` to use one |
| Expansion decks | once an expansion's gateway tile is out, `t` asks which deck to draw from |

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
| green spaces | spaces a card lets you pick |
| cyan name in a tile's top wall | the tile's name, shortened to fit (plain road and woods tiles have none); the sidebar's "at" line gives the full name of where you are |

## What works

The whole game: every collection that's playable on the web (with their tile decks, event cards and
variants), every card, including the ones that pick a space on the board, all the pop-up choices, the
Cabin spell, sewer tokens, hot-seat play for up to the game's maximum, and saving. The game's own rules
decide everything, exactly as on the web.

**Not yet:** online multiplayer. That can come next by talking to the same `/api/games` server the website
uses, so BBS and web players could share a game.

**Testing hook:** `ICZ_TEST_SETUP=file.js` runs that script inside the game right after setup (to deal a
certain card, say). Only someone who can set environment variables on the server can use it.

## Putting it on the BBS (later, once you push this)

`update-zombies.sh` already copies the whole repo to `/srv/apps/ic_zombies`, so `bbs/` arrives on the
Atom with every push. Then add it to Synchronet once, in `sudo -u sbbs /sbbs/exec/scfg`:
**External Programs → Online Programs (Doors)**, add a section (e.g. *Games*), then a program:

| Setting | Value |
|---|---|
| Name | IC Zombies |
| Internal Code | `ICZOMBIES` |
| Start-up Directory | `/srv/apps/ic_zombies` |
| Command Line | `/usr/bin/node bbs/door.js` |
| Native Executable/Script | Yes |
| BBS Drop File Type | DOOR32.SYS (so the game uses the player's BBS name) |
| Place Drop File In | Node Directory |
| I/O method | Standard (stdio) |
| Multiple Concurrent Users | Yes |

Each player runs their own Node process (roughly 40–60 MB), which is fine for the BBS's 4 nodes.
