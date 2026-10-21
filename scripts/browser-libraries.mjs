import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Restricted Linux environments can have Chromium installed without its system
// libraries. Extract the missing Debian packages locally; never install as root.
export function prepareBrowserLibraries() {
  if (process.platform !== 'linux' || !existsSync(chromium.executablePath())) return;

  const cache = fileURLToPath(new URL('../node_modules/.cache/browser-libraries/', import.meta.url));
  const root = join(cache, 'root');
  const libRoot = join(root, 'usr', 'lib');
  const originalPath = process.env.LD_LIBRARY_PATH;
  function useLocalLibraries() {
    if (!existsSync(libRoot)) return;
    const paths = readdirSync(libRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(libRoot, entry.name));
    process.env.LD_LIBRARY_PATH = [libRoot, ...paths, originalPath].filter(Boolean).join(':');
  }
  function missingLibraries() {
    const result = spawnSync('ldd', [chromium.executablePath()], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
      throw new Error('Cannot inspect Chromium dependencies with ldd.', { cause: result.error });
    }
    return [...result.stdout.matchAll(/^\s*(\S+) => not found$/gm)].map((match) => match[1]);
  }
  function run(command, args) {
    const result = spawnSync(command, args, { cwd: cache, stdio: 'inherit' });
    if (result.error || result.status !== 0) {
      throw new Error(`Chromium library setup failed: ${command} ${args.join(' ')}`, { cause: result.error });
    }
  }

  useLocalLibraries();
  const missing = missingLibraries();
  if (!missing.length) return;

  const packages = {
    'libnspr4.so': 'libnspr4',
    'libnss3.so': 'libnss3',
    'libnssutil3.so': 'libnss3',
    'libsmime3.so': 'libnss3',
    'libasound.so.2': /Candidate:\s+\d/.test(
      spawnSync('apt-cache', ['policy', 'libasound2t64'], { encoding: 'utf8' }).stdout || ''
    ) ? 'libasound2t64' : 'libasound2'
  };
  if (missing.some((library) => !packages[library])) {
    throw new Error(`Missing Chromium libraries: ${missing.join(', ')}. Run npx playwright install-deps chromium.`);
  }

  mkdirSync(cache, { recursive: true });
  console.log(`Preparing local Chromium libraries: ${missing.join(', ')}`);
  run('apt-get', ['download', ...new Set(missing.map((library) => packages[library]))]);
  for (const archive of readdirSync(cache).filter((file) => file.endsWith('.deb'))) {
    run('dpkg-deb', ['--extract', join(cache, archive), root]);
  }
  useLocalLibraries();
  const remaining = missingLibraries();
  if (remaining.length) throw new Error(`Chromium libraries are still missing: ${remaining.join(', ')}`);
}
