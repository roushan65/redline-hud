// Builds a self-contained REDLINE//HUD executable for the current OS / CPU using Node's
// single executable applications (https://nodejs.org/api/single-executable-applications.html).
//
//   npm run build:standalone          → release/redline-hud-<os>-<arch>[.exe] + a zip / tar.gz
//
// Steps: build the UI → bundle server/standalone.ts to one CommonJS file → generate a SEA blob
// with every dist/ file embedded as an asset → inject it into a copy of the running node binary.
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const POSTJECT = 'postject@1.0.0-alpha.6';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'release');
const work = path.join(out, 'build');
const platform = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform] ?? process.platform;
const name = `redline-hud-${platform}-${process.arch}`;
const exe = path.join(out, name + (process.platform === 'win32' ? '.exe' : ''));

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npx' });

rmSync(out, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

console.log('› building UI');
await build({ root, logLevel: 'warn' });

console.log('› bundling server');
await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: path.join(root, 'server/standalone.ts'),
    outDir: work,
    emptyOutDir: false,
    minify: false,
    target: 'node22',
    rollupOptions: { output: { format: 'cjs', entryFileNames: 'server.cjs' } },
  },
});

console.log('› generating SEA blob');
const dist = path.join(root, 'dist');
const assets = Object.fromEntries(
  readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const file = path.join(e.parentPath, e.name);
      return ['dist/' + path.relative(dist, file).split(path.sep).join('/'), file];
    }),
);
const blob = path.join(work, 'sea-prep.blob');
const seaConfig = path.join(work, 'sea-config.json');
writeFileSync(
  seaConfig,
  JSON.stringify({ main: path.join(work, 'server.cjs'), output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, assets }, null, 2),
);
run(process.execPath, ['--experimental-sea-config', seaConfig]);

console.log('› injecting into', path.basename(exe));
copyFileSync(process.execPath, exe);
chmodSync(exe, 0o755);
if (process.platform === 'darwin') run('codesign', ['--remove-signature', exe]);
run('npx', ['--yes', POSTJECT, exe, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSE, ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : [])]);
// macOS refuses to run modified binaries without a signature; an ad-hoc one is enough locally
if (process.platform === 'darwin') run('codesign', ['--sign', '-', exe]);

console.log('› packaging');
const pkg = path.join(work, name);
mkdirSync(pkg);
cpSync(exe, path.join(pkg, path.basename(exe)));
for (const f of ['README.md', 'LICENSE', '.env.example']) copyFileSync(path.join(root, f), path.join(pkg, f));
if (process.platform === 'linux') {
  run('tar', ['-czf', path.join(out, `${name}.tar.gz`), '-C', work, name]);
} else if (process.platform === 'win32') {
  run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${pkg}' -DestinationPath '${path.join(out, name + '.zip')}' -Force`]);
} else {
  // ditto keeps the executable bit and the code signature intact
  run('ditto', ['-c', '-k', '--keepParent', pkg, path.join(out, `${name}.zip`)]);
}

console.log(`\n✓ ${path.relative(root, exe)}`);
