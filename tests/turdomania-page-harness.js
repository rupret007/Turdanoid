/** Install the shipped rules module in a JSDOM realm without module-script support. */
import * as Core from '../games/turdomania-core.js';

export function installTurdomaniaModules(window) {
  window.Core = Core;
}

export function inlineTurdomaniaImports(source) {
  return source.replace("import * as Core from './games/turdomania-core.js';", '');
}
