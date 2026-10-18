import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env };
const runtime = mkdtempSync(join(tmpdir(), 'turdanoid-tests-'));
env.TMPDIR = runtime;

// Chromium also writes outside its temporary profile (Crashpad and NSS).
// Give each test run writable directories, including in restricted runners.
if (process.platform === 'linux') {
  // Preserve Playwright's installed browser location before changing XDG cache.
  env.PLAYWRIGHT_BROWSERS_PATH ||= dirname(dirname(dirname(chromium.executablePath())));
  for (const name of ['XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME']) {
    env[name] = join(runtime, name);
    mkdirSync(env[name], { recursive: true });
  }
}

function prepareLinuxLibraries() {
  if (process.platform !== 'linux' || (env.PLAYWRIGHT_CHANNEL && env.PLAYWRIGHT_CHANNEL !== 'chromium')) {
    return;
  }
  const executable = chromium.executablePath();
  if (!existsSync(executable)) {
    // The browser suite reports the missing browser; never skip its assertions.
    return;
  }
  const triplet = { x64: 'x86_64-linux-gnu', arm64: 'aarch64-linux-gnu' }[process.arch];
  if (!triplet) {
    return;
  }
  const cache = join(root, 'node_modules', '.cache', 'browser-test-deps');
  const libraries = join(cache, 'usr', 'lib', triplet);
  const useLocalLibraries = () => {
    env.LD_LIBRARY_PATH = [libraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  };
  if (existsSync(libraries)) {
    useLocalLibraries();
  }
  const missingLibraries = () => {
    const output = execFileSync('ldd', [executable], { env, encoding: 'utf8' });
    return [...output.matchAll(/^\s*(\S+) => not found$/gm)].map((match) => match[1]);
  };
  const missing = missingLibraries();
  if (!missing.length) {
    return;
  }

  // Minimal Debian/Ubuntu runners may have Chromium but lack these runtime
  // libraries. Extract distro packages locally; no sudo or system changes.
  const packages = {
    'libnspr4.so': 'libnspr4',
    'libnss3.so': 'libnss3',
    'libnssutil3.so': 'libnss3',
    'libsmime3.so': 'libnss3',
    'libasound.so.2': 'libasound2'
  };
  const hint = 'Install Chromium dependencies with npx playwright install --with-deps chromium.';
  if (missing.some((library) => !packages[library])) {
    throw new Error(`Missing Chromium libraries: ${missing.join(', ')}. ${hint}`);
  }
  if (missing.includes('libasound.so.2')) {
    const candidate = spawnSync('apt-cache', ['show', 'libasound2t64'], { encoding: 'utf8' });
    if (/^Package: libasound2t64$/m.test(candidate.stdout || '')) {
      packages['libasound.so.2'] = 'libasound2t64';
    }
  }
  const downloads = join(runtime, 'packages');
  mkdirSync(downloads);
  mkdirSync(cache, { recursive: true });
  const needed = [...new Set(missing.map((library) => packages[library]))];
  console.log(`Preparing local Chromium libraries: ${needed.join(', ')}`);
  try {
    execFileSync('apt-get', ['download', ...needed], { cwd: downloads, stdio: 'inherit' });
    for (const filename of readdirSync(downloads).filter((name) => name.endsWith('.deb'))) {
      execFileSync('dpkg-deb', ['--extract', join(downloads, filename), cache], { stdio: 'inherit' });
    }
  } catch (error) {
    throw new Error(`Could not prepare local Chromium dependencies. ${hint}`, { cause: error });
  }
  rmSync(downloads, { recursive: true, force: true });
  useLocalLibraries();
  const remaining = missingLibraries();
  if (remaining.length) {
    throw new Error(`Missing Chromium libraries: ${remaining.join(', ')}. ${hint}`);
  }
}

try {
  prepareLinuxLibraries();
  const vitest = join(dirname(fileURLToPath(import.meta.resolve('vitest/package.json'))), 'vitest.mjs');
  const child = spawn(process.execPath, [vitest, 'run', ...process.argv.slice(2)], {
    cwd: root,
    env,
    stdio: 'inherit'
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  rmSync(runtime, { recursive: true, force: true });
}
