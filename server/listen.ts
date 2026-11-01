export const DEFAULT_HOST = '0.0.0.0';
export const DEFAULT_PORT = 2077;

/**
 * Bind address for the dev / preview server, from PANEL_HOST and PANEL_PORT.
 * Defaults to every interface on port 2077 so other devices on the LAN (a tablet or a
 * second monitor's PC) can open the panel.
 */
export function resolveListen(env: Record<string, string | undefined>): { host: string; port: number } {
  const host = env.PANEL_HOST?.trim() || DEFAULT_HOST;
  const raw = env.PANEL_PORT?.trim();
  if (!raw) return { host, port: DEFAULT_PORT };
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`PANEL_PORT must be a whole number from 1 to 65535 (got "${raw}")`);
  }
  return { host, port };
}
