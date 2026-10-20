import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const env = { ...process.env };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function prepareChromium() {
  // Keep ordinary installs unchanged. Minimal Linux containers may have Chromium
  // cached but lack its shared libraries, and cannot use install-deps as root.
  if (process.platform !== 'linux' || !existsSync(chromium.executablePath())) return;
  if (env.PLAYWRIGHT_CHANNEL && env.PLAYWRIGHT_CHANNEL !== 'chromium') return;
  const triplet = { x64: 'x86_64-linux-gnu', arm64: 'aarch64-linux-gnu' }[process.arch];
  if (!triplet) return;

  const cache = join(root, 'node_modules', '.cache', 'playwright-libs');
  env.LD_LIBRARY_PATH = [
    join(cache, 'usr', 'lib', triplet),
    join(cache, 'lib', triplet),
    env.LD_LIBRARY_PATH
  ].filter(Boolean).join(delimiter);

  const missingLibraries = () => [...run('ldd', [chromium.executablePath()], { env })
    .matchAll(/^\s*(\S+) => not found$/gm)].map((match) => match[1]);
  const missing = missingLibraries();
  if (!missing.length) return;

  const packages = {
    'libnspr4.so': ['libnspr4'],
    'libnss3.so': ['libnss3'],
    'libnssutil3.so': ['libnss3'],
    'libsmime3.so': ['libnss3'],
    'libasound.so.2': ['libasound2t64', 'libasound2']
  };
  const unsupported = missing.filter((library) => !packages[library]);
  if (unsupported.length) {
    throw new Error(`Install Chromium system dependencies before testing: ${unsupported.join(', ')}`);
  }
  const needed = [...new Set(missing.map((library) => {
    const name = packages[library].find((candidate) => {
      const result = spawnSync('apt-cache', ['show', candidate], { encoding: 'utf8' });
      return result.status === 0 && result.stdout.includes(`Package: ${candidate}\n`);
    });
    if (!name) throw new Error(`Install ${library} before testing (no apt package available).`);
    return name;
  }))];

  // Download and unpack libraries into an ignored local cache; never change the
  // system installation or skip browser tests when dependency setup fails.
  console.log(`Preparing local Chromium libraries: ${needed.join(', ')}`);
  const download = mkdtempSync(join(tmpdir(), 'turdanoid-browser-libs-'));
  try {
    run('apt-get', ['download', ...needed], { cwd: download });
    mkdirSync(cache, { recursive: true });
    for (const name of readdirSync(download).filter((name) => name.endsWith('.deb'))) {
      run('dpkg-deb', ['--extract', join(download, name), cache]);
    }
  } finally {
    rmSync(download, { recursive: true, force: true });
  }
  const remaining = missingLibraries();
  if (remaining.length) {
    throw new Error(`Chromium dependencies are still missing: ${remaining.join(', ')}`);
  }
}

prepareChromium();
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit'
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
