import { useEffect, useMemo, useState } from 'react';
import { BrandPanel } from './components/BrandPanel';
import { Header } from './components/Header';
import { SettingsDrawer } from './components/SettingsDrawer';
import { useSensorFeed } from './hooks/useSensorFeed';
import { PrefsContext } from './lib/prefs';
import { boardView, cpuView, gpuView, gpus, hardwareOfKind, memoryView, networkViews, storageViews } from './lib/selectors';
import { useSettings } from './lib/settings';
import { applyTheme, resolveTheme } from './lib/themes';
import { BoardPanel } from './panels/BoardPanel';
import { CpuPanel } from './panels/CpuPanel';
import { GpuPanel } from './panels/GpuPanel';
import { MemoryPanel } from './panels/MemoryPanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { SensorTable } from './panels/SensorTable';
import { StoragePanel } from './panels/StoragePanel';

export default function App() {
  const { settings, update, updateBrand, reset, status } = useSettings();
  const [drawer, setDrawer] = useState(false);
  const theme = useMemo(() => resolveTheme(settings.themeId, settings.overrides), [settings.themeId, settings.overrides]);
  useEffect(() => applyTheme(theme), [theme]);

  const feed = useSensorFeed(settings);
  const snap = feed.snapshot;

  const views = useMemo(() => {
    if (!snap) return null;
    return {
      cpus: hardwareOfKind(snap, 'cpu').map(cpuView),
      gpus: gpus(snap).map(gpuView),
      mem: memoryView(snap),
      drives: storageViews(snap),
      nics: networkViews(snap),
      board: boardView(snap),
    };
  }, [snap]);

  const prefs = useMemo(() => ({ tempUnit: settings.tempUnit }), [settings.tempUnit]);
  const fx = `${settings.scanlines ? ' fx-scan' : ''}${settings.glitch ? ' fx-glitch' : ''}`;
  const machine = snap?.machine ?? '— — —';

  return (
    <PrefsContext.Provider value={prefs}>
      <div className={`app${fx}`}>
        <div className="app__grid-bg" aria-hidden />
        <Header
          machine={machine}
          link={feed.link}
          latencyMs={feed.latencyMs}
          error={feed.error}
          themeTagline={theme.tagline}
          onOpenSettings={() => setDrawer(true)}
        />

        {feed.link === 'fallback' && (
          <div className="banner" role="alert">
            <strong>▲ LINK LOST</strong> Could not reach <code>{settings.url}</code> ({feed.error}). Showing simulated telemetry.
            <button type="button" className="btn btn--ghost" onClick={() => setDrawer(true)}>Configure</button>
          </div>
        )}

        {!views ? (
          <div className="boot">
            <div className="boot__ring" aria-hidden />
            <p className="boot__text">{feed.link === 'error' ? `NO SIGNAL — ${feed.error}` : 'ESTABLISHING NEURAL LINK…'}</p>
            {feed.link === 'error' && (
              <div className="boot__actions">
                <button type="button" className="btn" onClick={() => update({ source: 'mock' })}>Use simulator</button>
                <button type="button" className="btn btn--ghost" onClick={() => setDrawer(true)}>Settings</button>
              </div>
            )}
          </div>
        ) : (
          /* Priority layout: CPU | brand + memory | GPU, then a compact row for everything else. */
          <main className={`dash${feed.link === 'error' ? ' dash--stale' : ''}${views.gpus.length ? '' : ' dash--no-gpu'}`}>
            <div className="dash__cpu">
              {views.cpus.map((c) => (
                <CpuPanel key={c.hw.id} cpu={c} history={feed.history} intervalMs={settings.intervalMs} />
              ))}
            </div>
            <div className="dash__center">
              {settings.brand.show && <BrandPanel brand={settings.brand} machine={machine} />}
              <MemoryPanel mem={views.mem} />
            </div>
            {views.gpus.length > 0 && (
              <div className="dash__gpu">
                {views.gpus.map((g) => (
                  <GpuPanel key={g.hw.id} gpu={g} history={feed.history} intervalMs={settings.intervalMs} />
                ))}
              </div>
            )}
            <div className="dash__minor">
              <NetworkPanel nics={views.nics} history={feed.history} intervalMs={settings.intervalMs} />
              <BoardPanel board={views.board} />
              {views.drives.length > 0 && <StoragePanel drives={views.drives} />}
            </div>
            <div className="dash__table">
              <SensorTable snap={snap!} />
            </div>
          </main>
        )}

        <footer className="foot">
          <span>SRC: {settings.source === 'mock' ? 'SIMULATOR' : settings.url}</span>
          <span>POLL {settings.intervalMs}ms</span>
          <span>{feed.lastUpdate ? `SYNC ${new Date(feed.lastUpdate).toLocaleTimeString([], { hour12: false })}` : 'SYNC —'}</span>
          <span>CFG {status.target === 'disk' ? 'config/config.json' : status.target === 'browser' ? 'BROWSER' : '…'}</span>
        </footer>

        <SettingsDrawer
          open={drawer}
          settings={settings}
          status={status}
          onChange={update}
          onBrand={updateBrand}
          onReset={reset}
          onClose={() => setDrawer(false)}
        />
      </div>
    </PrefsContext.Provider>
  );
}
