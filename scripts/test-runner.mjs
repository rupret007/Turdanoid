import { spawn } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env };
const runtime = mkdtempSync(join(tmpdir(), 'turdanoid-tests-'));
env.TMPDIR = runtime;

function useProvisionedBrowserLibraries() {
  if (env.PLAYWRIGHT_CHANNEL && env.PLAYWRIGHT_CHANNEL !== 'chromium') {
    return;
  }
  const triplet = { x64: 'x86_64-linux-gnu', arm64: 'aarch64-linux-gnu' }[process.arch];
  if (!triplet) {
    return;
  }
  const cache = join(root, 'node_modules', '.cache', 'browser-test-deps');
  const libraries = join(cache, 'usr', 'lib', triplet);
  if (!existsSync(libraries)) {
    return;
  }

  // This optional cache is provisioned separately, just like node_modules.
  // Reject links outside it and files another user could replace before
  // allowing the dynamic loader to use its native code.
  const cacheRoot = realpathSync(cache);
  for (const path of [
    cache,
    join(cache, 'usr'),
    join(cache, 'usr', 'lib'),
    libraries,
    ...readdirSync(libraries).map((name) => join(libraries, name))
  ]) {
    const resolved = realpathSync(path);
    const info = statSync(path);
    if (
      (resolved !== cacheRoot && !resolved.startsWith(`${cacheRoot}${sep}`)) ||
      info.uid !== process.getuid() ||
      (info.mode & 0o022) !== 0 ||
      (path === cache && lstatSync(path).isSymbolicLink())
    ) {
      throw new Error(`Unsafe provisioned Chromium library cache: ${path}`);
    }
  }
  env.LD_LIBRARY_PATH = [env.LD_LIBRARY_PATH, libraries].filter(Boolean).join(':');
}

try {
  // Chromium also writes outside its temporary profile (Crashpad and NSS).
  // Give each test run writable directories, including in restricted runners.
  if (process.platform === 'linux') {
    // Preserve Playwright's installed browser location before changing XDG cache.
    env.PLAYWRIGHT_BROWSERS_PATH ||= dirname(dirname(dirname(chromium.executablePath())));
    for (const name of ['XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME']) {
      env[name] = join(runtime, name);
      mkdirSync(env[name]);
    }
    useProvisionedBrowserLibraries();
  }

  const vitest = join(
    dirname(fileURLToPath(import.meta.resolve('vitest/package.json'))),
    'vitest.mjs'
  );
  const child = spawn(process.execPath, [vitest, 'run', ...process.argv.slice(2)], {
    cwd: root,
    env,
    shell: false,
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
  // Only remove the private directory created by mkdtempSync for this run.
  rmSync(runtime, { recursive: true });
}
