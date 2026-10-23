/**
 * sprites.js — pixel-art SVG sprites for ic_zombies
 *
 * Drop this file in:  scripts/data/sprites.js
 * Add to index.html BEFORE board.js:
 *   <script src="scripts/data/sprites.js"></script>
 *
 * Usage in board.js / panels.js:
 *   el.innerHTML = getSprite('zombie_regular', 32);
 *   el.innerHTML = getSprite('player_blue', 32);
 *   el.innerHTML = getSprite('tile_road_straight', 48);
 *
 * All sprites use shape-rendering:crispEdges for the pixel-art look.
 * Anchor point is bottom-center so isometric counter-rotation works correctly.
 *
 * Sprite naming conventions:
 *   player_{color}         — one per player color (blue/green/red/yellow/white/orange)
 *   zombie_regular         — standard zombie (kill roll 4+, 1 space, 1 heart)
 *   zombie_govt            — government-enhanced (kill roll 5+, 2 spaces, 1 heart)
 *   zombie_dog             — zombie dog (kill roll 4+, 2 spaces, ½ heart)
 *   tile_road_straight     — road tile, N-S orientation
 *   tile_road_corner       — road tile, corner
 *   tile_road_t            — road tile, T-junction
 *   tile_road_cross        — road tile, 4-way intersection
 *   tile_building          — generic named building
 *   tile_helipad           — win condition tile
 *   tile_mall              — Z3 mall / air-duct tile
 *   tile_subway            — Z6 subway station
 *   tile_cabin             — Z4 cabin (Cabin Spell win condition)
 *   tile_campus            — Z5 school campus
 *   marker_heart           — life token
 *   marker_bullet          — ammo token
 *   marker_sewer           — Z6 sewer token (road placement)
 *   marker_guts            — guts token (Z5)
 *   marker_botd_page       — Book of the Dead page (Z4)
 */

'use strict';

// ---------------------------------------------------------------------------
// INTERNAL: raw SVG pixel data — coordinate unit = 1px, crispEdges enforced
// All viewBoxes are normalised to 16×28 for upright characters, 20×16 for dog,
// 48×48 for tiles, 14×16 for small markers.
// ---------------------------------------------------------------------------

const _SVG_DEFS = {

  // ── PLAYERS ────────────────────────────────────────────────────────────────
  // One survivor silhouette, six colour variants.
  // Only jacket (body + arms), collar, and legs change — everything else is identical.
  // Jacket = main colour, collar/legs = darker shade of same colour.

  player_blue: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#1a3388"/>
  <rect x="2" y="11" width="12" height="8" fill="#2244aa"/>
  <rect x="0" y="11" width="2" height="6" fill="#2244aa"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#2244aa"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#1a3388"/>
  <rect x="9" y="21" width="4" height="5" fill="#1a3388"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  player_green: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#166633"/>
  <rect x="2" y="11" width="12" height="8" fill="#22aa44"/>
  <rect x="0" y="11" width="2" height="6" fill="#22aa44"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#22aa44"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#166633"/>
  <rect x="9" y="21" width="4" height="5" fill="#166633"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  player_red: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#991111"/>
  <rect x="2" y="11" width="12" height="8" fill="#cc2222"/>
  <rect x="0" y="11" width="2" height="6" fill="#cc2222"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#cc2222"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#991111"/>
  <rect x="9" y="21" width="4" height="5" fill="#991111"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  player_yellow: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#996600"/>
  <rect x="2" y="11" width="12" height="8" fill="#cc9900"/>
  <rect x="0" y="11" width="2" height="6" fill="#cc9900"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#cc9900"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#996600"/>
  <rect x="9" y="21" width="4" height="5" fill="#996600"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  player_white: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#999999"/>
  <rect x="2" y="11" width="12" height="8" fill="#cccccc"/>
  <rect x="0" y="11" width="2" height="6" fill="#cccccc"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#cccccc"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#999999"/>
  <rect x="9" y="21" width="4" height="5" fill="#999999"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  player_orange: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <rect x="4" y="0" width="8" height="3" fill="#3a2510"/>
  <rect x="4" y="3" width="8" height="6" fill="#f4c07e"/>
  <rect x="5" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="9" y="5" width="2" height="2" fill="#2a1a0a"/>
  <rect x="6" y="8" width="4" height="1" fill="#c08060"/>
  <rect x="4" y="9" width="8" height="2" fill="#bb5500"/>
  <rect x="2" y="11" width="12" height="8" fill="#ee7700"/>
  <rect x="0" y="11" width="2" height="6" fill="#ee7700"/>
  <rect x="0" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="14" y="11" width="2" height="6" fill="#ee7700"/>
  <rect x="14" y="17" width="2" height="2" fill="#f4c07e"/>
  <rect x="16" y="13" width="4" height="2" fill="#888"/>
  <rect x="18" y="12" width="2" height="2" fill="#666"/>
  <rect x="2" y="19" width="12" height="2" fill="#1a1a1a"/>
  <rect x="6" y="19" width="4" height="2" fill="#888"/>
  <rect x="3" y="21" width="4" height="5" fill="#bb5500"/>
  <rect x="9" y="21" width="4" height="5" fill="#bb5500"/>
  <rect x="2" y="26" width="5" height="2" fill="#3a2010"/>
  <rect x="9" y="26" width="5" height="2" fill="#3a2010"/>
</svg>`,

  // ── ZOMBIES ────────────────────────────────────────────────────────────────

  zombie_regular: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <!-- matted hair -->
  <rect x="3" y="0" width="10" height="3" fill="#2a2a1a"/>
  <!-- rotting head -->
  <rect x="3" y="3" width="10" height="6" fill="#7daa6a"/>
  <!-- glowing red eyes -->
  <rect x="4" y="5" width="3" height="2" fill="#cc4422"/>
  <rect x="9" y="5" width="3" height="2" fill="#cc4422"/>
  <!-- mouth -->
  <rect x="5" y="8" width="6" height="2" fill="#cc6644"/>
  <rect x="6" y="8" width="1" height="2" fill="#2a0a0a"/>
  <rect x="8" y="8" width="1" height="2" fill="#2a0a0a"/>
  <rect x="10" y="8" width="1" height="2" fill="#2a0a0a"/>
  <!-- torn shirt -->
  <rect x="2" y="10" width="12" height="8" fill="#4a7a3a"/>
  <rect x="3" y="11" width="2" height="3" fill="#3a5a2a"/>
  <rect x="9" y="13" width="3" height="3" fill="#3a5a2a"/>
  <!-- arms — one outstretched -->
  <rect x="0" y="10" width="2" height="7" fill="#7daa6a"/>
  <rect x="0" y="10" width="9" height="2" fill="#7daa6a"/>
  <rect x="14" y="10" width="2" height="7" fill="#7daa6a"/>
  <!-- clawed hands -->
  <rect x="0" y="17" width="2" height="2" fill="#6a9a5a"/>
  <rect x="14" y="17" width="2" height="2" fill="#6a9a5a"/>
  <!-- pants -->
  <rect x="3" y="18" width="4" height="6" fill="#3a6a2a"/>
  <rect x="9" y="18" width="4" height="6" fill="#3a6a2a"/>
  <!-- dragging feet -->
  <rect x="2" y="24" width="5" height="4" fill="#2a4a1a"/>
  <rect x="9" y="24" width="5" height="4" fill="#2a4a1a"/>
</svg>`,

  zombie_govt: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <!-- govt headgear / implant -->
  <rect x="3" y="0" width="10" height="4" fill="#220044"/>
  <rect x="3" y="0" width="3" height="6" fill="#ffaa00"/>
  <rect x="10" y="0" width="3" height="6" fill="#ffaa00"/>
  <rect x="5" y="1" width="6" height="2" fill="#334455"/>
  <!-- head -->
  <rect x="3" y="4" width="10" height="5" fill="#8a6ab0"/>
  <!-- glowing eyes -->
  <rect x="4" y="5" width="3" height="2" fill="#ffaa00"/>
  <rect x="9" y="5" width="3" height="2" fill="#ffaa00"/>
  <!-- exposed teeth -->
  <rect x="5" y="8" width="6" height="2" fill="#cc6688"/>
  <rect x="6" y="8" width="1" height="2" fill="#eeeeee"/>
  <rect x="8" y="8" width="1" height="2" fill="#eeeeee"/>
  <rect x="10" y="8" width="1" height="2" fill="#eeeeee"/>
  <!-- body armour / uniform -->
  <rect x="1" y="10" width="14" height="8" fill="#3a2060"/>
  <rect x="3" y="11" width="10" height="6" fill="#4a2a80"/>
  <rect x="6" y="12" width="4" height="4" fill="#220044"/>
  <!-- arms (wider, stronger) -->
  <rect x="0" y="10" width="2" height="8" fill="#8a6ab0"/>
  <rect x="0" y="10" width="9" height="2" fill="#8a6ab0"/>
  <rect x="14" y="10" width="2" height="8" fill="#8a6ab0"/>
  <rect x="14" y="18" width="2" height="2" fill="#6a4a90"/>
  <rect x="0" y="18" width="2" height="2" fill="#6a4a90"/>
  <!-- pants -->
  <rect x="2" y="18" width="5" height="6" fill="#2a1040"/>
  <rect x="9" y="18" width="5" height="6" fill="#2a1040"/>
  <!-- boots -->
  <rect x="1" y="24" width="6" height="4" fill="#1a0828"/>
  <rect x="9" y="24" width="6" height="4" fill="#1a0828"/>
</svg>`,

  zombie_clown: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 28" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <!-- wild orange hair -->
  <rect x="0" y="0" width="16" height="2" fill="#cc5500"/>
  <rect x="1" y="2" width="14" height="2" fill="#ee7700"/>
  <!-- rotting zombie face -->
  <rect x="3" y="3" width="10" height="6" fill="#7daa6a"/>
  <!-- glowing red eyes -->
  <rect x="4" y="5" width="3" height="2" fill="#cc4422"/>
  <rect x="9" y="5" width="3" height="2" fill="#cc4422"/>
  <!-- big round red nose -->
  <rect x="7" y="7" width="2" height="2" fill="#ff2020"/>
  <!-- wide painted clown smile -->
  <rect x="3" y="8" width="10" height="2" fill="#ff44aa"/>
  <rect x="5" y="8" width="1" height="2" fill="#2a0a0a"/>
  <rect x="8" y="8" width="1" height="2" fill="#2a0a0a"/>
  <rect x="11" y="8" width="1" height="2" fill="#2a0a0a"/>
  <!-- white ruffled collar -->
  <rect x="0" y="10" width="16" height="2" fill="#eeeeee"/>
  <rect x="2" y="11" width="12" height="2" fill="#dddddd"/>
  <!-- purple polka-dot suit body -->
  <rect x="2" y="12" width="12" height="7" fill="#882299"/>
  <rect x="4" y="13" width="2" height="2" fill="#ffee00"/>
  <rect x="10" y="13" width="2" height="2" fill="#ffee00"/>
  <rect x="7" y="16" width="2" height="2" fill="#ffee00"/>
  <!-- zombie arms (green, one outstretched) -->
  <rect x="0" y="12" width="2" height="7" fill="#7daa6a"/>
  <rect x="0" y="12" width="9" height="2" fill="#7daa6a"/>
  <rect x="14" y="12" width="2" height="7" fill="#7daa6a"/>
  <!-- clawed hands -->
  <rect x="0" y="19" width="2" height="2" fill="#6a9a5a"/>
  <rect x="14" y="19" width="2" height="2" fill="#6a9a5a"/>
  <!-- baggy striped pants -->
  <rect x="3" y="19" width="4" height="5" fill="#882299"/>
  <rect x="9" y="19" width="4" height="5" fill="#882299"/>
  <rect x="3" y="20" width="4" height="1" fill="#ffee00"/>
  <rect x="9" y="20" width="4" height="1" fill="#ffee00"/>
  <rect x="3" y="22" width="4" height="1" fill="#ffee00"/>
  <rect x="9" y="22" width="4" height="1" fill="#ffee00"/>
  <!-- huge red clown shoes (overflow viewBox for extra width) -->
  <rect x="-2" y="24" width="9" height="4" fill="#dd2211"/>
  <rect x="9"  y="24" width="9" height="4" fill="#dd2211"/>
  <rect x="-2" y="24" width="9" height="1" fill="#ff4433"/>
  <rect x="9"  y="24" width="9" height="1" fill="#ff4433"/>
</svg>`,

  zombie_dog: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 16" style="image-rendering:pixelated;shape-rendering:crispEdges;overflow:visible">
  <!-- body -->
  <rect x="4" y="6" width="14" height="6" fill="#6a7a4a"/>
  <!-- head -->
  <rect x="14" y="2" width="8" height="8" fill="#7a8a5a"/>
  <!-- snout -->
  <rect x="20" y="4" width="4" height="4" fill="#8a9a6a"/>
  <!-- eye -->
  <rect x="16" y="3" width="2" height="2" fill="#cc4422"/>
  <!-- ear -->
  <rect x="16" y="0" width="3" height="4" fill="#5a6a3a"/>
  <!-- jaw / teeth -->
  <rect x="20" y="7" width="4" height="2" fill="#cc6644"/>
  <rect x="21" y="7" width="1" height="2" fill="#eeeeee"/>
  <rect x="23" y="7" width="1" height="2" fill="#eeeeee"/>
  <!-- tail -->
  <rect x="0" y="4" width="4" height="2" fill="#8a9a6a"/>
  <rect x="0" y="2" width="2" height="4" fill="#7a8a5a"/>
  <!-- legs -->
  <rect x="5" y="12" width="3" height="4" fill="#5a6a3a"/>
  <rect x="10" y="12" width="3" height="4" fill="#5a6a3a"/>
  <rect x="15" y="10" width="3" height="4" fill="#5a6a3a"/>
  <rect x="5" y="15" width="4" height="1" fill="#3a4a2a"/>
  <rect x="10" y="15" width="4" height="1" fill="#3a4a2a"/>
</svg>`,

  // ── MAP TILES (48×48, 3×3 subtile grid) — unused, getSpriteForTile not wired up yet ──
  /*

  tile_road_straight: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#2a2a2a"/>
  <!-- kerbs -->
  <rect x="16" y="0" width="2" height="48" fill="#3a3a3a"/>
  <rect x="30" y="0" width="2" height="48" fill="#3a3a3a"/>
  <!-- road surface -->
  <rect x="18" y="0" width="12" height="48" fill="#444"/>
  <!-- centre dashes -->
  <rect x="23" y="2"  width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="10" width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="18" width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="26" width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="34" width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="42" width="2" height="5" fill="#ffee44"/>
  <!-- subtile grid (faint) -->
  <rect x="16" y="16" width="16" height="1" fill="#ffffff" opacity="0.06"/>
  <rect x="16" y="32" width="16" height="1" fill="#ffffff" opacity="0.06"/>
</svg>`,

  tile_road_corner: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#2a2a2a"/>
  <!-- vertical road -->
  <rect x="18" y="0" width="12" height="30" fill="#444"/>
  <rect x="16" y="0" width="2" height="32" fill="#3a3a3a"/>
  <rect x="30" y="0" width="2" height="30" fill="#3a3a3a"/>
  <!-- horizontal road -->
  <rect x="18" y="18" width="30" height="12" fill="#444"/>
  <rect x="18" y="16" width="30" height="2" fill="#3a3a3a"/>
  <rect x="18" y="30" width="30" height="2" fill="#3a3a3a"/>
  <!-- corner fill -->
  <rect x="18" y="18" width="12" height="12" fill="#555"/>
  <!-- dashes: vertical -->
  <rect x="23" y="2"  width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="10" width="2" height="5" fill="#ffee44"/>
  <!-- dashes: horizontal -->
  <rect x="34" y="23" width="5" height="2" fill="#ffee44"/>
  <rect x="42" y="23" width="5" height="2" fill="#ffee44"/>
</svg>`,

  tile_road_t: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#2a2a2a"/>
  <!-- vertical road (top half only) -->
  <rect x="18" y="0" width="12" height="30" fill="#444"/>
  <rect x="16" y="0" width="2" height="32" fill="#3a3a3a"/>
  <rect x="30" y="0" width="2" height="30" fill="#3a3a3a"/>
  <!-- horizontal road -->
  <rect x="0" y="18" width="48" height="12" fill="#444"/>
  <rect x="0" y="16" width="48" height="2" fill="#3a3a3a"/>
  <rect x="0" y="30" width="48" height="2" fill="#3a3a3a"/>
  <!-- intersection -->
  <rect x="18" y="18" width="12" height="12" fill="#555"/>
  <!-- dashes: vertical leg -->
  <rect x="23" y="2"  width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="10" width="2" height="5" fill="#ffee44"/>
  <!-- dashes: horizontal -->
  <rect x="2"  y="23" width="5" height="2" fill="#ffee44"/>
  <rect x="10" y="23" width="5" height="2" fill="#ffee44"/>
  <rect x="34" y="23" width="5" height="2" fill="#ffee44"/>
  <rect x="42" y="23" width="5" height="2" fill="#ffee44"/>
</svg>`,

  tile_road_cross: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#2a2a2a"/>
  <rect x="18" y="0" width="12" height="48" fill="#444"/>
  <rect x="0" y="18" width="48" height="12" fill="#444"/>
  <rect x="16" y="0" width="2" height="48" fill="#3a3a3a"/>
  <rect x="30" y="0" width="2" height="48" fill="#3a3a3a"/>
  <rect x="0" y="16" width="48" height="2" fill="#3a3a3a"/>
  <rect x="0" y="30" width="48" height="2" fill="#3a3a3a"/>
  <rect x="18" y="18" width="12" height="12" fill="#555"/>
  <!-- dashes -->
  <rect x="23" y="2"  width="2" height="5" fill="#ffee44"/>
  <rect x="23" y="40" width="2" height="5" fill="#ffee44"/>
  <rect x="2"  y="23" width="5" height="2" fill="#ffee44"/>
  <rect x="40" y="23" width="5" height="2" fill="#ffee44"/>
</svg>`,

  tile_building: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- base -->
  <rect x="0" y="0" width="48" height="48" fill="#222233"/>
  <!-- building footprint -->
  <rect x="2" y="2" width="44" height="44" fill="#3a3050"/>
  <!-- facade -->
  <rect x="6" y="6" width="36" height="32" fill="#4a4060"/>
  <!-- rooftop ledge -->
  <rect x="2" y="2"  width="44" height="4" fill="#5a5070"/>
  <rect x="2" y="42" width="44" height="4" fill="#5a5070"/>
  <rect x="2" y="2"  width="4"  height="44" fill="#5a5070"/>
  <rect x="42" y="2" width="4"  height="44" fill="#5a5070"/>
  <!-- windows row 1 (lit) -->
  <rect x="8"  y="8"  width="10" height="8" fill="#ffcc44" opacity="0.8"/>
  <rect x="20" y="8"  width="10" height="8" fill="#ffcc44" opacity="0.5"/>
  <rect x="32" y="8"  width="8"  height="8" fill="#6688ff" opacity="0.6"/>
  <!-- windows row 2 (dim) -->
  <rect x="8"  y="20" width="10" height="8" fill="#ffcc44" opacity="0.25"/>
  <rect x="20" y="20" width="10" height="8" fill="#ffcc44" opacity="0.7"/>
  <rect x="32" y="20" width="8"  height="8" fill="#ffcc44" opacity="0.2"/>
  <!-- doorway -->
  <rect x="18" y="34" width="12" height="14" fill="#1a1828"/>
  <rect x="21" y="36" width="6"  height="8" fill="#222040" opacity="0.7"/>
</svg>`,

  tile_helipad: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- rooftop -->
  <rect x="0" y="0" width="48" height="48" fill="#1a2030"/>
  <rect x="2" y="2" width="44" height="44" fill="#222840"/>
  <!-- landing circle indicator (square pixel version) -->
  <rect x="8"  y="8"  width="32" height="32" fill="#2a3550"/>
  <rect x="10" y="10" width="28" height="28" fill="#1e2e44"/>
  <!-- H cross -->
  <rect x="20" y="12" width="8" height="24" fill="#ffaa00"/>
  <rect x="12" y="20" width="24" height="8" fill="#ffaa00"/>
  <!-- centre bright -->
  <rect x="22" y="22" width="4" height="4" fill="#ffffff"/>
  <!-- warning border -->
  <rect x="0" y="0" width="48" height="2" fill="#ffaa00" opacity="0.6"/>
  <rect x="0" y="46" width="48" height="2" fill="#ffaa00" opacity="0.6"/>
  <rect x="0" y="0" width="2" height="48" fill="#ffaa00" opacity="0.6"/>
  <rect x="46" y="0" width="2" height="48" fill="#ffaa00" opacity="0.6"/>
  <!-- corner markers -->
  <rect x="4" y="4" width="4" height="4" fill="#ffcc22"/>
  <rect x="40" y="4" width="4" height="4" fill="#ffcc22"/>
  <rect x="4" y="40" width="4" height="4" fill="#ffcc22"/>
  <rect x="40" y="40" width="4" height="4" fill="#ffcc22"/>
</svg>`,

  tile_mall: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#2a1e14"/>
  <rect x="2" y="2" width="44" height="44" fill="#4a3828"/>
  <!-- shop floor -->
  <rect x="6" y="6" width="36" height="26" fill="#5a4838"/>
  <!-- shop signs (neon) -->
  <rect x="8"  y="8"  width="10" height="6" fill="#ff6633" opacity="0.8"/>
  <rect x="22" y="8"  width="10" height="6" fill="#33aaff" opacity="0.8"/>
  <rect x="34" y="8"  width="6"  height="6" fill="#33ff99" opacity="0.7"/>
  <!-- shop windows -->
  <rect x="8"  y="16" width="10" height="8" fill="#ffdd88" opacity="0.4"/>
  <rect x="22" y="16" width="10" height="8" fill="#ffdd88" opacity="0.4"/>
  <!-- air duct subtile (top-right corner) -->
  <rect x="36" y="16" width="8" height="8" fill="#1a2a3a"/>
  <rect x="37" y="17" width="6" height="1" fill="#44aaff" opacity="0.9"/>
  <rect x="37" y="19" width="6" height="1" fill="#44aaff" opacity="0.9"/>
  <rect x="37" y="21" width="6" height="1" fill="#44aaff" opacity="0.9"/>
  <rect x="37" y="23" width="4" height="1" fill="#44aaff" opacity="0.5"/>
  <!-- floor (ground level) -->
  <rect x="6" y="32" width="36" height="10" fill="#3a2818"/>
  <!-- entrance -->
  <rect x="18" y="34" width="12" height="14" fill="#1a1008"/>
  <!-- food court tables -->
  <rect x="8"  y="34" width="6" height="4" fill="#7a5a3a"/>
  <rect x="34" y="34" width="6" height="4" fill="#7a5a3a"/>
</svg>`,

  tile_subway: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="0" y="0" width="48" height="48" fill="#111820"/>
  <rect x="2" y="2" width="44" height="44" fill="#1a2432"/>
  <!-- station facade -->
  <rect x="4" y="4" width="40" height="28" fill="#1e2c3e"/>
  <!-- fluorescent signage -->
  <rect x="6"  y="6"  width="14" height="6" fill="#ffee44" opacity="0.6"/>
  <rect x="28" y="6"  width="14" height="6" fill="#ffee44" opacity="0.6"/>
  <!-- rail tracks -->
  <rect x="4"  y="18" width="40" height="4" fill="#2a4468"/>
  <rect x="4"  y="22" width="40" height="4" fill="#2a4468"/>
  <rect x="4"  y="20" width="40" height="2" fill="#6688aa"/>
  <!-- rail ties -->
  <rect x="6"  y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="12" y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="18" y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="24" y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="30" y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="36" y="18" width="2" height="8" fill="#3a3a3a"/>
  <rect x="42" y="18" width="2" height="8" fill="#3a3a3a"/>
  <!-- stairwell entrance -->
  <rect x="16" y="32" width="16" height="14" fill="#0e1520"/>
  <rect x="18" y="34" width="12" height="12" fill="#1a2030" opacity="0.8"/>
  <!-- stair lines -->
  <rect x="18" y="36" width="12" height="1" fill="#aaaaaa" opacity="0.4"/>
  <rect x="18" y="39" width="12" height="1" fill="#aaaaaa" opacity="0.4"/>
  <rect x="18" y="42" width="12" height="1" fill="#aaaaaa" opacity="0.4"/>
  <!-- pillars -->
  <rect x="4"  y="32" width="4" height="14" fill="#283848"/>
  <rect x="40" y="32" width="4" height="14" fill="#283848"/>
</svg>`,

  tile_cabin: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- grass clearing -->
  <rect x="0" y="0" width="48" height="48" fill="#1e3a10"/>
  <rect x="2" y="2" width="44" height="44" fill="#2a4a18"/>
  <!-- cabin walls (wood) -->
  <rect x="8" y="10" width="32" height="28" fill="#7a4a20"/>
  <!-- log texture -->
  <rect x="8"  y="10" width="32" height="3" fill="#9a6030"/>
  <rect x="8"  y="16" width="32" height="3" fill="#9a6030"/>
  <rect x="8"  y="22" width="32" height="3" fill="#9a6030"/>
  <rect x="8"  y="28" width="32" height="3" fill="#9a6030"/>
  <!-- roof -->
  <rect x="4"  y="6"  width="40" height="6"  fill="#5a3010"/>
  <rect x="6"  y="4"  width="36" height="4"  fill="#7a4020"/>
  <rect x="14" y="2"  width="20" height="4"  fill="#9a5030"/>
  <!-- window -->
  <rect x="10" y="14" width="10" height="8" fill="#88aaff" opacity="0.5"/>
  <rect x="12" y="16" width="3"  height="4" fill="#aaccff" opacity="0.4"/>
  <!-- door -->
  <rect x="18" y="24" width="12" height="14" fill="#3a1a08"/>
  <rect x="20" y="26" width="8"  height="10" fill="#4a2210" opacity="0.7"/>
  <rect x="28" y="30" width="2"  height="2"  fill="#aa8844"/>
  <!-- trees each side -->
  <rect x="0" y="8"  width="6" height="20" fill="#2a5a18"/>
  <rect x="42" y="8" width="6" height="20" fill="#2a5a18"/>
</svg>`,

  tile_campus: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- campus grass -->
  <rect x="0" y="0" width="48" height="48" fill="#2a5018"/>
  <!-- paths -->
  <rect x="20" y="0"  width="8" height="48" fill="#c8b88a"/>
  <rect x="0"  y="20" width="48" height="8" fill="#c8b88a"/>
  <!-- building brick -->
  <rect x="4" y="4"  width="14" height="14" fill="#8a4a2a"/>
  <rect x="30" y="4" width="14" height="14" fill="#8a4a2a"/>
  <rect x="4"  y="30" width="14" height="14" fill="#8a4a2a"/>
  <rect x="30" y="30" width="14" height="14" fill="#8a4a2a"/>
  <!-- brick highlights -->
  <rect x="4"  y="4"  width="14" height="2" fill="#aa6a3a"/>
  <rect x="30" y="4"  width="14" height="2" fill="#aa6a3a"/>
  <rect x="4"  y="30" width="14" height="2" fill="#aa6a3a"/>
  <rect x="30" y="30" width="14" height="2" fill="#aa6a3a"/>
  <!-- windows -->
  <rect x="6"  y="8"  width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="12" y="8"  width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="32" y="8"  width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="38" y="8"  width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="6"  y="34" width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="12" y="34" width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="32" y="34" width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <rect x="38" y="34" width="4" height="4" fill="#aaccff" opacity="0.6"/>
  <!-- intersection paving -->
  <rect x="20" y="20" width="8" height="8" fill="#ddd0aa"/>
</svg>`,

  */ // end unused tile sprites

  // ── MARKERS ────────────────────────────────────────────────────────────────

  marker_heart: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- 2x-scaled classic 7×6 pixel heart: each logical pixel = 2×2 block -->
  <!-- top lobes -->
  <rect x="2"  y="1"  width="4"  height="2" fill="#dd2020"/>
  <rect x="8"  y="1"  width="4"  height="2" fill="#dd2020"/>
  <!-- full-width body (rows 1-2 merged) -->
  <rect x="0"  y="3"  width="14" height="4" fill="#dd2020"/>
  <!-- tapering bottom -->
  <rect x="2"  y="7"  width="10" height="2" fill="#dd2020"/>
  <rect x="4"  y="9"  width="6"  height="2" fill="#dd2020"/>
  <rect x="6"  y="11" width="2"  height="2" fill="#dd2020"/>
  <!-- highlights (upper-left of each lobe) -->
  <rect x="2"  y="1"  width="2"  height="2" fill="#ff6060"/>
  <rect x="8"  y="1"  width="2"  height="1" fill="#ff6060"/>
</svg>`,

  // marker_half_heart — unused (no call site yet)
  /* marker_half_heart: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="1" y="3" width="4" height="2" fill="#ff4444"/>
  <rect x="7" y="3" width="4" height="2" fill="#884444"/>
  <rect x="0" y="5" width="7" height="4" fill="#ff4444"/>
  <rect x="7" y="5" width="7" height="4" fill="#884444"/>
  <rect x="1" y="9" width="6" height="3" fill="#ff4444"/>
  <rect x="7" y="9" width="6" height="3" fill="#884444"/>
  <rect x="3" y="12" width="4" height="2" fill="#ff4444"/>
  <rect x="7" y="12" width="4" height="2" fill="#884444"/>
  <rect x="2" y="4" width="2" height="3" fill="#ff8888"/>
  <line x1="7" y1="3" x2="7" y2="14" stroke="#222" stroke-width="1"/>
</svg>`, */

  marker_bullet: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 16" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <rect x="2" y="0" width="4" height="3" fill="#ffcc44"/>
  <rect x="1" y="3" width="6" height="2" fill="#ccaa22"/>
  <rect x="1" y="5" width="6" height="8" fill="#aaaaaa"/>
  <rect x="2" y="5" width="2" height="4" fill="#cccccc"/>
  <rect x="1" y="13" width="6" height="2" fill="#888888"/>
  <rect x="2" y="15" width="4" height="1" fill="#666666"/>
</svg>`,

  marker_sewer: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- pixel circle rim — clipped corners give roundness -->
  <rect x="4"  y="0"  width="6"  height="14" fill="#445533"/>
  <rect x="0"  y="4"  width="14" height="6"  fill="#445533"/>
  <rect x="2"  y="1"  width="10" height="12" fill="#445533"/>
  <rect x="1"  y="2"  width="12" height="10" fill="#445533"/>
  <!-- inner dark fill -->
  <rect x="4"  y="1"  width="6"  height="12" fill="#334422"/>
  <rect x="1"  y="4"  width="12" height="6"  fill="#334422"/>
  <rect x="2"  y="2"  width="10" height="10" fill="#334422"/>
  <!-- grate lines — cross + ring -->
  <rect x="6"  y="2"  width="2"  height="10" fill="#556644"/>
  <rect x="2"  y="6"  width="10" height="2"  fill="#556644"/>
  <rect x="4"  y="3"  width="6"  height="1"  fill="#556644"/>
  <rect x="4"  y="10" width="6"  height="1"  fill="#556644"/>
  <rect x="3"  y="4"  width="1"  height="6"  fill="#556644"/>
  <rect x="10" y="4"  width="1"  height="6"  fill="#556644"/>
  <!-- centre highlight -->
  <rect x="6"  y="6"  width="2"  height="2"  fill="#667755"/>
</svg>`,

  marker_guts: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- loop 1 top -->
  <rect x="2"  y="0"  width="10" height="2" fill="#cc4433"/>
  <rect x="0"  y="2"  width="2"  height="4" fill="#cc4433"/>
  <rect x="12" y="2"  width="2"  height="4" fill="#cc4433"/>
  <rect x="2"  y="0"  width="10" height="1" fill="#ee7755"/>
  <!-- loop 2 -->
  <rect x="2"  y="6"  width="10" height="2" fill="#bb3322"/>
  <rect x="2"  y="4"  width="2"  height="4" fill="#bb3322"/>
  <rect x="4"  y="6"  width="8"  height="1" fill="#dd5544"/>
  <!-- loop 3 -->
  <rect x="2"  y="8"  width="10" height="2" fill="#cc4433"/>
  <rect x="12" y="6"  width="2"  height="4" fill="#cc4433"/>
  <rect x="2"  y="8"  width="10" height="1" fill="#ee7755"/>
  <!-- loop 4 -->
  <rect x="2"  y="10" width="10" height="2" fill="#bb3322"/>
  <rect x="2"  y="8"  width="2"  height="4" fill="#bb3322"/>
  <rect x="4"  y="10" width="8"  height="1" fill="#dd5544"/>
  <!-- end cap -->
  <rect x="4"  y="12" width="6"  height="2" fill="#cc4433"/>
  <rect x="12" y="10" width="2"  height="4" fill="#cc4433"/>
  <rect x="4"  y="12" width="6"  height="1" fill="#ee7755"/>
  <!-- mesentery fill between loops -->
  <rect x="4"  y="2"  width="7"  height="4" fill="#aa2211"/>
  <rect x="3"  y="8"  width="9"  height="2" fill="#aa2211"/>
  <!-- sheen highlights -->
  <rect x="6"  y="0"  width="2"  height="1" fill="#ffaa88"/>
  <rect x="6"  y="6"  width="2"  height="1" fill="#ffaa88"/>
  <rect x="6"  y="8"  width="2"  height="1" fill="#ffaa88"/>
</svg>`,

  marker_kills: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- dark badge background for contrast on any tile -->
  <rect x="0" y="0" width="14" height="14" fill="#1c1c12"/>
  <!-- bone: top-left to bottom-right -->
  <rect x="0"  y="0"  width="4" height="4" fill="#f0e0a0"/>
  <rect x="1"  y="1"  width="2" height="2" fill="#ffffff"/>
  <rect x="3"  y="3"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="4"  y="4"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="5"  y="5"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="6"  y="6"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="7"  y="7"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="8"  y="8"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="9"  y="9"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="10" y="10" width="4" height="4" fill="#f0e0a0"/>
  <rect x="11" y="11" width="2" height="2" fill="#ffffff"/>
  <!-- bone: top-right to bottom-left -->
  <rect x="10" y="0"  width="4" height="4" fill="#f0e0a0"/>
  <rect x="11" y="1"  width="2" height="2" fill="#ffffff"/>
  <rect x="9"  y="3"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="8"  y="4"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="7"  y="5"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="6"  y="6"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="5"  y="7"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="4"  y="8"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="3"  y="9"  width="2" height="2" fill="#f0e0a0"/>
  <rect x="0"  y="10" width="4" height="4" fill="#f0e0a0"/>
  <rect x="1"  y="11" width="2" height="2" fill="#ffffff"/>
  <!-- knob end caps -->
  <rect x="0"  y="2"  width="1" height="2" fill="#f0e0a0"/>
  <rect x="2"  y="0"  width="2" height="1" fill="#f0e0a0"/>
  <rect x="13" y="2"  width="1" height="2" fill="#f0e0a0"/>
  <rect x="12" y="0"  width="2" height="1" fill="#f0e0a0"/>
  <rect x="0"  y="12" width="1" height="2" fill="#f0e0a0"/>
  <rect x="2"  y="13" width="2" height="1" fill="#f0e0a0"/>
  <rect x="13" y="12" width="1" height="2" fill="#f0e0a0"/>
  <rect x="12" y="13" width="2" height="1" fill="#f0e0a0"/>
</svg>`,

  marker_botd_page: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 16" style="image-rendering:pixelated;shape-rendering:crispEdges">
  <!-- parchment -->
  <rect x="2" y="0" width="10" height="16" fill="#d8c880"/>
  <rect x="3" y="1" width="8"  height="14" fill="#e8d890"/>
  <!-- binding -->
  <rect x="0" y="0" width="3" height="16" fill="#aa2222"/>
  <rect x="2" y="0" width="1" height="16" fill="#cc3333"/>
  <!-- text lines -->
  <rect x="4" y="3"  width="6" height="1" fill="#776622"/>
  <rect x="4" y="6"  width="6" height="1" fill="#776622"/>
  <rect x="4" y="9"  width="6" height="1" fill="#776622"/>
  <rect x="4" y="12" width="4" height="1" fill="#776622"/>
  <!-- skull icon -->
  <rect x="5" y="4"  width="4" height="3" fill="#553311" opacity="0.5"/>
</svg>`,

};

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * getSprite(key, size)
 * Returns an SVG string scaled to `size` pixels (width × height).
 * `size` is applied as CSS width; height scales proportionally via viewBox.
 *
 * @param  {string} key   — one of the keys in _SVG_DEFS
 * @param  {number} size  — rendered pixel width (default: 32)
 * @returns {string}       — SVG markup ready for innerHTML
 */
function getSprite(key, size = 32) {
  const raw = _SVG_DEFS[key];
  if (!raw) {
    console.warn(`[sprites] Unknown sprite key: "${key}"`);
    return '';
  }
  // Inject width style so caller doesn't have to manage sizing
  return raw.replace('<svg ', `<svg width="${size}" `);
}

/**
 * getSpriteForPlayer(player, size)
 * Maps a player object (with .color) to the correct player sprite.
 *
 * @param  {{color: string}} player
 * @param  {number}          size
 * @returns {string}
 */
var _PLAYER_COLORS = ['blue', 'red', 'green', 'orange', 'yellow', 'white'];

function getSpriteForPlayer(player, size = 32) {
  const idx = (player && player.id) ? player.id - 1 : 0;
  const color = _PLAYER_COLORS[idx] || 'blue';
  return getSprite('player_' + color, size);
}

/**
 * getSpriteForZombie(zombie, size)
 * Maps a zombie object (checking .dog and .enhanced flags) to the right sprite.
 *
 * @param  {{dog?: boolean, enhanced?: boolean, government?: boolean}} zombie
 * @param  {number} size
 * @returns {string}
 */
function getSpriteForZombie(zombie, size = 28) {
  if (!zombie) return getSprite('zombie_regular', size);
  if (zombie.dog)                           return getSprite('zombie_dog',   size * 0.6 | 0);
  if (zombie.enhanced || zombie.government) return getSprite('zombie_govt',  size);
  if (zombie.clown)                         return getSprite('zombie_clown', size);
  return getSprite('zombie_regular', size);
}

/* getSpriteForTile — unused until tile image overlay is wired up in board.js
function getSpriteForTile(tile, size = 48) {
  if (!tile) return '';

  // Explicit override
  if (tile.sprite && _SVG_DEFS[tile.sprite]) return getSprite(tile.sprite, size);

  const name = (tile.name || '').toLowerCase();
  const type = (tile.type || '').toLowerCase();

  if (name.includes('helipad'))          return getSprite('tile_helipad',        size);
  if (name.includes('cabin'))            return getSprite('tile_cabin',           size);
  if (name.includes('mall') ||
      name.includes('duct'))             return getSprite('tile_mall',            size);
  if (name.includes('subway') ||
      name.includes('station'))          return getSprite('tile_subway',          size);
  if (name.includes('campus') ||
      name.includes('school'))           return getSprite('tile_campus',          size);
  if (type === 'road' || type === 'street') {
    const connectors = (tile.connectors || []).join(',');
    const dirs = ['N','S','E','W'].filter(d => connectors.includes(d));
    if (dirs.length === 4)               return getSprite('tile_road_cross',      size);
    if (dirs.length === 3)               return getSprite('tile_road_t',          size);
    if (dirs.length === 2 &&
        ((dirs.includes('N') && dirs.includes('E')) ||
         (dirs.includes('N') && dirs.includes('W')) ||
         (dirs.includes('S') && dirs.includes('E')) ||
         (dirs.includes('S') && dirs.includes('W'))))
                                         return getSprite('tile_road_corner',     size);
    return getSprite('tile_road_straight', size);
  }

  // Named building fallback
  if (tile.name)                         return getSprite('tile_building',        size);
  return '';
} */

// ---------------------------------------------------------------------------
// MARKER HELPER
// ---------------------------------------------------------------------------

var _MARKER_KEYS = {
  heart:     'marker_heart',
  // half_heart: 'marker_half_heart', // sprite commented out
  bullet:    'marker_bullet',
  sewer:     'marker_sewer',
  guts:      'marker_guts',
  botd_page: 'marker_botd_page',
  kills:     'marker_kills',
};

/**
 * getMarkerHtml(type, size)
 * Returns an inline-ready SVG for a marker token, vertically aligned for text contexts.
 *
 * @param  {string} type  — 'heart' | 'bullet' | 'sewer' | 'guts' | 'botd_page' | 'kills'
 * @param  {number} size  — rendered pixel width
 * @returns {string}
 */
function getMarkerHtml(type, size) {
  const key = _MARKER_KEYS[type];
  if (!key) return '';
  return getSprite(key, size).replace('<svg ', '<svg style="vertical-align:middle;margin:0 1px" ');
}

// wrapSpriteForIso — unused (board.js uses CSS counter-rotation instead)
// spriteHeightForTile — unused