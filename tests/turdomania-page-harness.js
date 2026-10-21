/** Install the shipped ES modules in a JSDOM realm that cannot load module scripts. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as Core from '../games/turdomania-core.js';
import * as Daily from '../games/turdomania-daily.js';

const uiSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'games', 'turdomania-daily-ui.js'), 'utf8')
  .replace("import * as Daily from './turdomania-daily.js';", '')
  .replace('export function createDailyUI', 'window.createDailyUI = function createDailyUI');

export function installTurdomaniaModules(window) {
  window.Core = Core;
  window.Daily = Daily;
  // Evaluate DOM code in this window, so it uses the page's document and navigator.
  window.eval(uiSource);
}

export function inlineTurdomaniaImports(source) {
  return source
    .replace("import * as Core from './games/turdomania-core.js';", '')
    .replace("import * as Daily from './games/turdomania-daily.js';", '')
    .replace("import { createDailyUI } from './games/turdomania-daily-ui.js';", '');
}
