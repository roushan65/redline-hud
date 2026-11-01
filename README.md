# CYBER//SENSOR

A futuristic, themeable hardware-telemetry panel for [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor), built with React + Vite. Its default look is inspired by Cyberpunk 2077.

![panels: CPU · GPU · Memory · Network · Mainboard · Storage · Sensor index]

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

By default the UI polls `http://192.168.1.4:8085/data.json`. You can change the endpoint, refresh rate, theme, units and channel branding under **⚙ Settings**. Settings are saved to **`config/config.json`** on disk (see [Saved config](#saved-config)).

If you don't have a LibreHardwareMonitor box handy, choose **Simulator** in Settings, or open `http://localhost:5173/?source=mock`.

## Enabling the LibreHardwareMonitor API (Windows host)

1. Run LibreHardwareMonitor **as Administrator** (sensors need ring-0 access).
2. Go to *Options → Remote Web Server → Run* (default port **8085**).
3. Allow inbound TCP 8085 in Windows Firewall.
4. Check it works by opening `http://<host>:8085/data.json` from another machine.

LHM sends `Access-Control-Allow-Origin: *`, so the browser can call it directly. If a build or reverse proxy drops that header, use the dev proxy instead: set the endpoint to `/lhm/data.json` and point `LHM_PROXY_TARGET` in `.env` at the host (see `.env.example`).

## Configuration

| Where | Key | Purpose |
|---|---|---|
| `.env` | `VITE_LHM_URL` | Default endpoint polled by the UI |
| `.env` | `VITE_DATA_SOURCE` | `live` (default) or `mock` |
| `.env` | `LHM_PROXY_TARGET` | Upstream for the `/lhm/*` dev proxy |
| `.env` | `PANEL_CONFIG_DIR` | Folder for `config.json` and the uploaded logo (default `./config`) |
| URL | `?source=mock&url=…&theme=netrunner` | Overrides for this session only; they are never written to `config.json` |

When the link drops twice in a row, the panel falls back to the simulator and shows a banner. You can turn this off in Settings.

## Layout

The layout follows a gamer's priorities:

1. **CPU** and **GPU** are the large hero panels on the left and right.
2. **Memory** sits in the centre column, under the **channel card**.
3. **Network**, **Mainboard** and **Storage** sit in a compact row below. The sensor index is collapsed at the bottom.

Below about 1240px wide, CPU and GPU sit side by side with the channel card and memory in a strip underneath. Below 760px everything stacks in priority order.

### Channel card

Open **⚙ Settings → Branding** to set your channel name and tagline. You can also upload a logo (PNG, JPG, WebP, GIF or SVG, up to 5 MB) or paste an image URL, and choose a hex, circle or square frame. Untick **Show channel card** to hide the card.

## Saved config

`npm run dev` and `npm run preview` both serve a small API that stores settings on disk:

| File | Contents |
|---|---|
| `config/config.json` | All settings: source, endpoint, interval, theme and colour overrides, effects, units, branding |
| `config/logo.<ext>` | The uploaded logo (served at `/api/logo`) |

- **Hand edits:** you can edit `config.json` by hand and reload the page. Values that are unknown or invalid fall back to their defaults.
- **Status:** the Settings drawer shows where the last save went.
- **Static hosting:** if the panel is served by a plain static host with no API (for example a copied `dist/`), settings are kept in browser `localStorage` instead, and uploaded logos are limited to 256 KB.
- **Git:** the `config/` folder is git-ignored.

## Themes

Built-in themes: **Cyberpunk 2077** (default), **Arasaka**, **Netrunner**, **Militech** and **Tyger Claws**. You can override any individual colour from Settings.

Every colour is a CSS custom property (`--c-accent`, `--c-surface`, …) written by `applyTheme()`. To add a theme, append an entry to `THEMES` in [src/lib/themes.ts](src/lib/themes.ts).

The `series1` / `series2` colours drive two-series charts (download/upload, PCIe Rx/Tx). They were checked for colour-vision-deficiency separation and contrast against each theme's panel surface, so if you add a theme, re-validate its pair. Status colours (`good` / `warn` / `crit`) are reserved for severity and always come with an icon and a label.

## Project layout

```
src/
  lib/
    types.ts        LHM data.json node shape + normalised Sensor/Hardware model
    parse.ts        tree → Snapshot (units parsed, throughput normalised to B/s)
    selectors.ts    vendor-agnostic pickers: cpuView, gpuView, memoryView, …
    themes.ts       theme tokens + applyTheme()
    settings.ts     settings hook: config.json via /api/config, localStorage fallback
    prefs.ts        °C/°F context, severity thresholds
  hooks/useSensorFeed.ts   polling, timeouts, history ring buffer, fallback
  mock/              sample.json (real LHM capture) + drifting simulator
  components/        RadialGauge, LineChart, Meter, CoreGrid, FanDial, Panel, …
  panels/            CPU, GPU, Memory, Network, Mainboard, Storage, Sensor index
server/
  configApi.ts       Vite plugin: /api/config + /api/logo (dev + preview servers)
config/              (created at runtime) config.json + logo
```

## Scripts

```bash
npm run dev         # dev server (exposed on LAN via host: true)
npm run build       # production build → dist/
npm run preview     # serve dist/ (with the config API)
npm run typecheck
npm test            # unit tests (parser, settings, config API)
LHM_LIVE_URL=http://192.168.1.4:8085/data.json npm test   # + live endpoint check
```
