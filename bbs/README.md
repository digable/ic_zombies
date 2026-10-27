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
turn on their variant. Send in the Clowns stays off until it's finished on the web. `Enter` starts a game
on this keyboard (hot-seat); `o` is for online games (below).

## Online games

Players on different BBS nodes, and on the website, can play the same game. It uses the same server and
rules as the website's online rooms (`/api/games` on the zombies service), so a BBS player can join a game
started on the web and the other way round.

- **Host:** on the new-game screen pick collections and variants, then `o`, `h`. You get a 4-letter code
  and a lobby that lists everyone who joins. Press `Enter` to start once at least one other person is in.
- **Join from the BBS:** IC Zombies, `o`, `j`, type the code, `Enter`.
- **Join from the web:** `zombies.sodamachine.net/?game=CODE` (or the Join box on the site).
- **Playing:** on your turn you play as usual. Everyone else watches it happen: each change (a tile, a
  card, a roll, a move, the zombies) reaches the other BBS and web players within a couple of seconds, log
  included. When you end your turn, the next player gets it (the BBS beeps and says "Your turn!"). While
  someone else is playing you can look around the map (`m`) and at your own cards, but not act.
  Your hand is always your own cards, never anyone else's.
- **Dropped or quit:** your seat is kept. Coming back to IC Zombies asks to rejoin (`c`) or leave the game
  for good (`l`). If it was your turn, you start that turn again (the server keeps the game as of the end
  of the last finished turn). Like the website, the others wait for you; there's no turn timer yet.
- **One game at a time** still holds: online games count, so there's no local save while you're in one.
- **Steering someone else (Brain Cramp, "Lots of running and screaming"):** when the mover rolls, the
  controls go to the player who played the card ("You're steering!"); they move the other player with the
  arrows and `x` to stop, then the controls go back. A fight on the way is answered by the player in it.
  This works between BBS players; if the steering player is on the website, the mover moves themselves,
  as on the website.

The door talks to `http://127.0.0.1:3000` (the zombies service on the same machine); `--api URL` or
`ICZ_API` points it elsewhere. Locally, run `node server.js` in another terminal first, then
`node bbs/door.js --utf8 --api http://127.0.0.1:3000`. All that's stored locally is which game you're in
(`<handle>.online.json` next to the saves).

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

When the zombies move, each move is replayed one at a time: the zombie about to move has its space lit red,
then it's shown lit red in the space it ended up in. With many zombies the frames speed up, so the
whole replay takes about 4 seconds. Any key skips the rest of the replay.

Only the parts of the screen that changed are sent after each key (usually under 100 bytes instead
of a 5 KB full screen), which keeps the door quick on slow connections. For the rest
of the turn, zombies that moved sit on a red background.

## Keys

| When | Keys |
|---|---|
| Anytime | `Space` next step, `1`–`5` look at a card in your hand (up/down flips through the others; `p` plays it, `d` discards it at the discard step), `i` items in front of you (then `a` to use one), `m` look around the map with the arrow keys (your character doesn't move), `?` help, `Esc` close a box or stop looking, `Ctrl+L` redraw the screen if it gets garbled, `q` quit (press it again to confirm) |
| Tile | `t` draw; it shows in yellow with its zombies/hearts/bullets in the sidebar. Arrows (or `Tab`) pick a spot, `r` rotates, `Enter` places |
| Fight | `c`; if the roll misses, a fight box shows your roll, what you need, and each option's outcome (the good choice is green): `b` bullet, `h` heart reroll, `f` First Aid Kit, `k` Lucky Shot, `1`–`9` a weapon item, `l` lose |
| Roll / move | `r`; arrows or `w` `a` `s` `d` to move, `x` to stop early |
| Discard | pick a card, `d`; or `n` to keep your hand |
| End turn | `Enter`; `v` casts the Cabin spell when you can (The End, Z4) |
| Cards that pick a space | Rocket Launcher, Dynamite, Mine Field, Frisbee, We're Screwed, This Isn't So Bad and the rest: spaces you can pick turn green. Arrows move the cursor, `Tab` jumps to the next green space, `Enter` picks, `x` finishes or cancels |
| Pop-up boxes (double-lined) | Zombie Dice Challenge: `1` `2` a bullet on a die, `3` `4` a heart to reroll, `Enter` accept. Air duct: `1`–`9` a store, `s` stay. Forced moves (Brain Cramp...): arrows move that player, `x` stops |
| Sewer tokens (Z6) | `o` place a token on a road, `u` drop into / climb out of the sewer |
| Book of the Dead (Z4) | page cards: `p` stages one; `i` shows pages in front of you, then a letter and `u` to use one |
| Expansion decks | once an expansion's gateway tile is out, `t` asks which deck to draw from |

## On the map

| Looks like | Means |
|---|---|
| `@` (one color per player) | players; the `@` of the player whose turn it is flashes in their color |
| green / grey cards in the hand | cards you can play right now / cards you can't (the card's box says why) |
| `Z` green / `Z` red / `d` / `c` | zombie / government-enhanced zombie / dog / clown, followed by a number if several share a space |
| a zombie on red | it moved this turn (a whole space lit red: the zombie moving right now, in the replay) |
| red `+` (♥ in UTF-8) | heart token |
| yellow `■` | bullet token |
| brown `▒` | building interiors (purple `▒`: mall stores) |
| yellow `+` in a wall | door |
| `...` green `░` `:::` | road, grass, parking |
| red outline, yellow walls / grey `░` | the drawn tile, previewed at the chosen spot / other spots it fits |
| green spaces | spaces a card lets you pick |
| grey `▓` with an `H` in the middle | the helipad (the way out) |
| `Θ` | a sewer token (Z6) |
| cyan name in a tile's top wall | the tile's name, shortened to fit (plain road and woods tiles have none); the sidebar's "at" line gives the full name of where you are |

## What works

The whole game: every collection that's playable on the web (with their tile decks, event cards and
variants), every card, including the ones that pick a space on the board, all the pop-up choices, the
Cabin spell, sewer tokens, hot-seat play for up to the game's maximum, saving, and online games with
other BBS and web players. The game's own rules decide everything, exactly as on the web.

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
