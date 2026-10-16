import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function recordingContext(scale = 2) {
  const calls = [];
  let gradientId = 0;
  return new Proxy({ calls, getTransform: () => ({ a: scale }) }, {
    get(target, key) {
      if (key in target) {return target[key];}
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args) => {
          const id = gradientId++;
          calls.push([key, id, ...args]);
          return { gradientId: id, addColorStop: (...stop) => calls.push(['addColorStop', id, ...stop]) };
        };
      }
      return (...args) => calls.push([key, ...args]);
    },
    set(target, key, value) {
      calls.push(['set', key, value && typeof value === 'object' ? value.gradientId : value]);
      return true;
    }
  });
}

function load({ document = true, canvasContext = true } = {}) {
  const canvases = [];
  const root = {};
  if (document) {
    root.document = { createElement: () => {
      const canvas = { width: 0, height: 0, context: recordingContext() };
      canvas.getContext = () => canvasContext ? canvas.context : null;
      canvases.push(canvas);
      return canvas;
    } };
  }
  const source = readFileSync(join(process.cwd(), 'games/turdanoid-sprites-core.js'), 'utf8');
  new Function('globalThis', source)(root);
  return { api: root.TurdanoidSprites, canvases };
}

describe('cached title brick wall', () => {
  it('preserves the direct renderer commands and reuses its 32 glazed bricks', () => {
    const { api, canvases } = load();
    const direct = recordingContext();
    const screen = recordingContext();
    const view = { W: 390, H: 844, palettes: [['#123456', '#654321'], ['#abcdef']] };
    const bottom = api.paintTitleWall(direct, view);
    expect(api.paintTitleWallCached(screen, view)).toBe(bottom);
    expect(canvases).toHaveLength(1);
    const paintCalls = canvases[0].context.calls;
    expect(paintCalls[0]).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
    expect(paintCalls.slice(1)).toEqual(direct.calls);
    expect(paintCalls.filter(([name]) => name === 'translate')).toHaveLength(32);
    expect(paintCalls.filter(([name]) => name.startsWith('create') && name.endsWith('Gradient'))).toHaveLength(64);
    const originalPaintCount = paintCalls.length;
    api.paintTitleWallCached(screen, { ...view, nowMs: 1000 });
    api.paintTitleWallCached(screen, { ...view, nowMs: 2000 });
    expect(paintCalls).toHaveLength(originalPaintCount);
    expect(screen.calls.filter(([name]) => name === 'drawImage')).toHaveLength(3);
    expect(screen.calls.filter(([name]) => name.startsWith('create'))).toHaveLength(0);
    expect(canvases[0].height).toBeLessThan(view.H * 2);
  });

  it('repaints for viewport, palette and resolution changes without retaining old canvases', () => {
    const { api, canvases } = load();
    const screen = recordingContext();
    const view = { W: 390, H: 844, palettes: [['#123456', '#654321']] };
    api.paintTitleWallCached(screen, view);
    const painted = () => canvases[0].context.calls.filter(([name]) => name === 'setTransform').length;
    api.paintTitleWallCached(screen, { ...view, W: 430 });
    expect(painted()).toBe(2);
    api.paintTitleWallCached(screen, { ...view, W: 430, H: 900 });
    expect(painted()).toBe(3);
    view.palettes[0][0] = '#ffffff';
    api.paintTitleWallCached(screen, { ...view, W: 430, H: 900 });
    expect(painted()).toBe(4);
    api.paintTitleWallCached(recordingContext(3), { ...view, W: 430, H: 900 });
    expect(painted()).toBe(5);
    expect(canvases).toHaveLength(1);
    expect(canvases[0].width).toBe(1290);
  });

  it('blits rounded physical dimensions without rescaling fractional viewport pixels', () => {
    const { api, canvases } = load();
    const screen = recordingContext(1.5);
    api.paintTitleWallCached(screen, { W: 390.25, H: 844.25 });
    const canvas = canvases[0];
    expect(canvas.width).toBe(Math.ceil(390.25 * 1.5));
    expect(screen.calls[0]).toEqual(['drawImage', canvas, 0, 0, canvas.width / 1.5, canvas.height / 1.5]);
  });

  it.each([{ document: false }, { canvasContext: false }])('paints directly when a cache is unavailable: %j', (options) => {
    const { api } = load(options);
    const screen = recordingContext();
    const direct = recordingContext();
    api.paintTitleWallCached(screen, { W: 320, H: 640 });
    api.paintTitleWall(direct, { W: 320, H: 640 });
    expect(screen.calls).toEqual(direct.calls);
  });
});
