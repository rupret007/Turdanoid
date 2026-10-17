import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function fakeCtx(scale = 2, withTransform = true) {
  const calls = [];
  const gradient = { addColorStop: () => {} };
  const base = { calls };
  if (withTransform) {base.getTransform = () => ({ a: scale });}
  const ctx = new Proxy(
    {
      ...base,
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      drawImage: (...a) => calls.push(['drawImage', ...a])
    },
    {
      get(t, k) {
        if (k in t) {return t[k];}
        if (k === 'getTransform') {return undefined;}
        return (...a) => calls.push([k, ...a]);
      },
      set() {
        return true;
      }
    }
  );
  return ctx;
}

function load() {
  const created = [];
  const root = {
    document: {
      createElement: () => {
        const off = { width: 0, height: 0, ctx: fakeCtx(1) };
        off.getContext = () => off.ctx;
        created.push(off);
        return off;
      }
    }
  };
  const src = readFileSync(join(process.cwd(), 'games/turdanoid-sprites-core.js'), 'utf8');
  new Function('globalThis', src.replace(/typeof globalThis !== 'undefined' \? globalThis : this/, 'globalThis'))(root);
  const api = Object.values(root).find((v) => v && typeof v.paintWorldStageCached === 'function');
  return { api, created };
}

describe('paintWorldStageCached', () => {
  it('paints the static stage once per world/size and blits it afterwards', () => {
    const { api, created } = load();
    const ctx = fakeCtx(2);
    const view = { W: 390, H: 844, fixtures: true };
    const a = api.paintWorldStageCached(ctx, { id: 'sewer' }, view);
    const b = api.paintWorldStageCached(ctx, { id: 'sewer' }, view);
    expect(created).toHaveLength(1);
    expect(created[0].width).toBe(780);
    expect(created[0].height).toBe(1688);
    const paintsAfterFirst = created[0].ctx.calls.length;
    expect(paintsAfterFirst).toBeGreaterThan(0);
    expect(b).toEqual(a);
    expect(ctx.calls.filter((c) => c[0] === 'drawImage')).toHaveLength(2);
    api.paintWorldStageCached(ctx, { id: 'sewer' }, { ...view, fixtures: false });
    expect(created[0].ctx.calls.length).toBeGreaterThan(paintsAfterFirst);
  });

  it('falls back to direct painting without a document', () => {
    const { api } = load();
    const ctx = fakeCtx(1, false);
    const r = api.paintWorldStageCached(ctx, { id: 'sewer' }, { W: 100, H: 200 });
    expect(r).toBeTruthy();
    expect(ctx.calls.filter((c) => c[0] === 'drawImage')).toHaveLength(0);
  });
});
