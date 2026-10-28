import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

// Restricted Linux environments can have Chromium installed without its system
// libraries. Extract the missing Debian packages locally; never install as root.
export function prepareBrowserLibraries() {
  if (process.platform !== 'linux' || !existsSync(chromium.executablePath())) return;

  const cache = fileURLToPath(new URL('../node_modules/.cache/browser-libraries/', import.meta.url));
  const root = join(cache, 'root');
  const libRoot = join(root, 'usr', 'lib');
  const manifestPath = join(cache, '.manifest.json');
  const originalPath = process.env.LD_LIBRARY_PATH;

  function isRealDirectory(dirPath) {
    try {
      const stat = lstatSync(dirPath);
      return stat.isDirectory() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  }

  function isOwnedByCurrentUser(path) {
    try {
      const stat = statSync(path);
      return stat.uid === process.getuid();
    } catch {
      return false;
    }
  }

  function useLocalLibraries() {
    if (!isRealDirectory(libRoot)) return;
    if (!isOwnedByCurrentUser(libRoot)) {
      throw new Error(`Library cache ${libRoot} is not owned by current user`);
    }
    const paths = readdirSync(libRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => join(libRoot, entry.name))
      .filter((p) => isOwnedByCurrentUser(p));
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

  function hashFile(filePath) {
    try {
      const content = readFileSync(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return null;
    }
  }

  function loadManifest() {
    try {
      return JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      return null;
    }
  }

  function saveManifest(data) {
    writeFileSync(manifestPath, JSON.stringify(data, null, 2));
  }

  function validateManifest(manifest, neededPackages) {
    if (!manifest || !Array.isArray(manifest.packages) || !manifest.extractedAt) {
      return false;
    }
    const manifestPkgs = new Set(manifest.packages);
    if (!neededPackages.every((pkg) => manifestPkgs.has(pkg))) {
      return false;
    }
    if (!manifest.debHashes || typeof manifest.debHashes !== 'object') {
      return false;
    }
    for (const [file, expectedHash] of Object.entries(manifest.debHashes)) {
      const filePath = join(cache, file);
      const stat = lstatSync(filePath, { throwIfNoEntry: false });
      if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
        return false;
      }
      if (hashFile(filePath) !== expectedHash) {
        return false;
      }
    }
    if (!isRealDirectory(root) || !isOwnedByCurrentUser(root)) {
      return false;
    }
    return true;
  }

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

  const neededPackages = [...new Set(missing.map((library) => packages[library]))];

  const existingManifest = loadManifest();
  if (validateManifest(existingManifest, neededPackages)) {
    useLocalLibraries();
    const stillMissing = missingLibraries();
    if (!stillMissing.length) return;
  }

  if (existsSync(cache)) {
    rmSync(cache, { recursive: true, force: true });
  }
  mkdirSync(cache, { recursive: true });

  console.log(`Preparing local Chromium libraries: ${missing.join(', ')}`);
  run('apt-get', ['download', ...neededPackages]);

  const debHashes = {};
  const downloadedDebs = readdirSync(cache)
    .filter((file) => file.endsWith('.deb'))
    .filter((file) => {
      const pkgName = file.split('_')[0];
      return neededPackages.includes(pkgName);
    })
    .filter((file) => {
      const filePath = join(cache, file);
      const stat = lstatSync(filePath, { throwIfNoEntry: false });
      if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
        return false;
      }
      debHashes[file] = hashFile(filePath);
      return debHashes[file] !== null;
    });

  for (const archive of downloadedDebs) {
    run('dpkg-deb', ['--extract', join(cache, archive), root]);
  }

  saveManifest({
    packages: neededPackages,
    debHashes,
    extractedAt: new Date().toISOString()
  });

  useLocalLibraries();
  const remaining = missingLibraries();
  if (remaining.length) throw new Error(`Chromium libraries are still missing: ${remaining.join(', ')}`);
}
