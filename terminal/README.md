# IC Zombies: terminal version

`zombies.sodamachine.net/terminal/` plays the BBS door (`../bbs/door.js`) in a browser tab, drawn on
an emulated 80×24 ANSI screen (CP437). It's the same game as the BBS and the website: the door plays
by the web game's own scripts, and online games (`/api/games`) are shared with web and BBS players.

Nothing is copied: the page loads `../bbs/*.js` and the web game's scripts from the site, so a push
that changes the game or the door changes this page too.

| File | What it does |
|---|---|
| `index.html`, `style.css` | The page: the screen, on-screen keys (and `abc` for a phone's keyboard), short help. |
| `main.js` | Loads the door and the web game's scripts, asks for the player's name (kept in this browser), starts the door and passes keys to it. |
| `node.js` | Just enough of Node for the door to run unchanged: `require`, `Buffer`, `process` (keys in, screen out, `exit`), `fs` (the door's saves, kept in this browser's localStorage), `path`, `os`. |
| `engine.js` | Stands in for `../bbs/engine.js`: runs the web game's scripts (in the order `../index.html` lists them, without `bootstrap.js`) in a hidden frame holding the web page's markup, instead of Node's `vm`. |
| `term.js` | The screen: an ANSI parser drawing CP437 cells on a canvas (from IC Disc Golf's emulator). |

**Saves.** Each browser keeps its own saved game per name, the way the BBS keeps one per user. The web
version's own saved game is never touched: the game scripts here get an in-memory `localStorage`.

**Changing the door.** Anything new it needs from Node must be added to `node.js` (the browser has no
`fs`, `process` or `Buffer`). Check the page after door changes: open `/terminal/`, play a turn, quit.

No build step and no packages: plain ES modules, served as they are.
