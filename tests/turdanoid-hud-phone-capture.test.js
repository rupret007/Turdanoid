import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSafeFilePath, startServer } from '../scripts/turdanoid-hud-phone-capture.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function encodeSlashTraversal(relPath) {
  return `/${relPath.split('/').map(encodeURIComponent).join('%2f')}`;
}

describe('turdanoid HUD phone capture path safety', () => {
  it('rejects plain and encoded traversal that resolve outside the repo root', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'turdanoid-hud-root-'));
    const secretName = `secret-${process.pid}.txt`;
    const secretPath = join(dirname(repo), secretName);
    await writeFile(join(repo, 'index.html'), 'inside');
    await writeFile(secretPath, 'LEAKED');
    try {
      expect(resolveSafeFilePath(`/../${secretName}`, repo)).toBeNull();
      expect(resolveSafeFilePath(`/..%2f${secretName}`, repo)).toBeNull();
      expect(resolveSafeFilePath('/../../secret.txt', repo)).toBeNull();
      expect(resolveSafeFilePath('/..%2f..%2fsecret.txt', repo)).toBeNull();

      const allowed = resolveSafeFilePath('/index.html', repo);
      expect(allowed).toBe(resolve(repo, 'index.html'));
      expect(relative(resolve(repo), allowed).startsWith('..')).toBe(false);
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(secretPath, { force: true });
    }
  });

  it('HTTP 403/404 for encoded and plain traversal; does not serve outside files', async () => {
    const secretDir = await mkdtemp(join(tmpdir(), 'turdanoid-hud-secret-'));
    const secretPath = join(secretDir, 'secret.txt');
    const marker = `leak-${Date.now()}-${process.pid}`;
    await writeFile(secretPath, marker);

    const server = await startServer(0);
    const { port } = server.address();
    const escapeRel = relative(repoRoot, secretPath).split('\\').join('/');

    try {
      const cases = [
        `/${escapeRel}`,
        encodeSlashTraversal(escapeRel),
        '/../../secret.txt',
        '/..%2f..%2fsecret.txt'
      ];
      for (const path of cases) {
        const res = await globalThis.fetch(`http://127.0.0.1:${port}${path}`);
        const body = await res.text();
        expect([403, 404]).toContain(res.status);
        expect(body).not.toContain(marker);
      }

      const ok = await globalThis.fetch(`http://127.0.0.1:${port}/TurdAnoid.html`);
      expect(ok.status).toBe(200);
      expect((await ok.text()).length).toBeGreaterThan(0);
    } finally {
      await new Promise((done) => server.close(done));
      await rm(secretDir, { recursive: true, force: true });
    }
  });
});
