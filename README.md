# PipeCAD

A 3D editor for plumbing layouts on Windows and Mac, made by a plumber in Illinois for everyday jobs: PVC Sch 40 pressure and DWV, Type L copper, cast iron no-hub and galvanized, with real catalog dimensions (Charlotte Pipe, NIBCO).

**Download** from the [Releases](../../releases) page:
- **Windows:** the portable `.exe`. No install needed, just run it.
- **Mac (Apple silicon, M1 and newer):** the `.dmg`. Open it and drag PipeCAD to Applications. The app is signed and notarized by Apple.

## What it does

- **Build in 3D, fitting by fitting.** Every part snaps to an open end. Adapters, nipples and transitions are added automatically when ends don't mate. Pipe length is typed right at the pipe (`3'6`, `42`), or set by dragging its ends.
- **Catalog by size.** Pick a material and size, and the catalog shows what fits. Right-click an open end for the common parts for that end. Recent parts are kept at the top.
- **Plumbing fixtures.** Gas water heaters 30–75 gal (atmospheric and power vent), Navien and Rinnai tankless, expansion tanks, Zoeller M53 and M267 pumps, sump and sewage ejector basins, check valves, shower valves, ball valves, dielectric unions.
- **One-click assemblies:**
  - sump kit;
  - ejector kit;
  - water heater hookup (dielectrics, expansion tank, T&P drain);
  - toilet rough-in;
  - shower valve rough-in.
- **Site.** Concrete walls, slabs, footings, ground and trenches, stud walls, joists, lumber and sheet goods. Hole checks against IRC limits for joists and studs. Basins cut their hole in the slab.
- **Drain slope.** Set a per-pipe slope. Horizontal DWV runs flatter than the IPC 704.1 minimums are flagged. Verify against your local code.
- **Materials and quotes:**
  - cut list and stick count;
  - unit prices, which are remembered between jobs, and markup;
  - CSV export;
  - a **PDF job sheet** with the 3D view with lengths, the materials with totals, and things to check before install.
- **Replay and video.** Replay the build step by step and record it to MP4.
- **Fast on big jobs.** The view only redraws when something changes, the image is simplified while you orbit, and far parts use lighter geometry. Render quality goes from Fast to Ultra (supersampling for clean edges, no shadows — it is a work tool). Light and dark themes, and an adjustable interface size.

## Build from source

```
npm install
npm run dev      # run in development
npm test         # catalog and assembly tests (vitest)
npm run dist     # portable Windows build → release/PipeCAD-<version>-portable.exe
```

### macOS

The ready `.dmg` for Apple silicon is on the [Releases](../../releases) page. To build it yourself on a Mac (Apple Silicon or Intel), with Node.js 22+ and git:

```
git clone https://github.com/GERCOG1390/PipeCAD.git
cd PipeCAD
npm install
npm run dist:mac   # → release/PipeCAD-<version>-mac-<arch>.dmg and .zip
```

The build targets the Mac's own architecture. A build made this way isn't code-signed (the release `.dmg` is), so on first launch macOS may say the app is damaged or from an unidentified developer: right-click the app → Open, or run `xattr -cr /Applications/PipeCAD.app` once.

Shortcuts accept ⌘ as well as Ctrl.

On Mac the 3D view runs on WebGPU (straight to Metal), about twice as fast as WebGL there; WebGL stays in ⚙ View settings as a fallback. On Retina screens the quality levels count from the screen's own resolution, and on battery power the view draws without extra resolution (can be turned off in ⚙).

Video recording needs Screen Recording permission (System Settings → Privacy & Security).

Stack: Electron, React, three.js with React Three Fiber, zustand, TypeScript.

## Development chat

PipeCAD was built in one long conversation with Claude Code. The whole chat is in [docs/development-chat.md](docs/development-chat.md): every request, every answer, and one line per tool call.
