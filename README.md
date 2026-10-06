# Rift Arena

A dependency-free top-down arena fighting prototype. Open `index.html` directly, or run `bash run.sh` and visit http://localhost:8000.

## Play
- WASD / arrow keys: move and face a direction
- J: directional sword slash (hold to repeat)
- K: area spin, costs 40 stamina
- Space: dodge with brief invulnerability, costs 25 stamina
- P: pause; M: world map
- Touch controls appear on touch-capable devices

Clear five waves in each of three arenas. Enemies show red ground circles before attacking. Wave five includes a guardian. Health recovers by 20 between waves; stamina regenerates. Best kills and conquered arenas save in browser storage when available. Changing arenas starts a fresh run.

## Files
`index.html`: interface; `style.css`: responsive styles; `game.js`: drawing, combat, enemies and maps; `run.sh`: local Python server.

This first prototype uses original Canvas-drawn placeholder fighters and scenery. It does not yet use the generated monster PNGs, include audio, multiplayer, or produce an Android APK. The touch layout supports browser play on Android.

## Git Bash
Clone and run:

```bash
git clone https://github.com/Omar-Galsen/new-arena-fighter.git
cd new-arena-fighter
bash run.sh
```

After editing files:

```bash
git add index.html style.css game.js run.sh README.md
git commit -m "Update Rift Arena"
git push
```

No npm install or build step is required.
