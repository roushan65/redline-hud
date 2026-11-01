import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { configApi } from './server/configApi.ts';
import { resolveListen } from './server/listen.ts';

// The dev server proxies /lhm/* to the LibreHardwareMonitor host so the UI also
// works against LHM builds that don't send CORS headers. It also serves /api/*,
// which saves the panel config to <PANEL_CONFIG_DIR>/config.json on disk.
// Both the dev and preview servers bind to PANEL_HOST:PANEL_PORT (default 0.0.0.0:2077).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.LHM_PROXY_TARGET || 'http://192.168.1.4:8085';
  const configDir = path.resolve(env.PANEL_CONFIG_DIR || 'config');
  // strictPort: fail loudly rather than drift to a port the bookmarked URL won't find
  const listen = { ...resolveListen(env), strictPort: true };

  return {
    plugins: [react(), configApi(configDir)],
    server: {
      ...listen,
      proxy: {
        '/lhm': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/lhm/, ''),
        },
      },
    },
    preview: listen,
  };
});
