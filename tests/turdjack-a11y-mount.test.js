import { JSDOM } from 'jsdom';
import { afterEach, expect, it } from 'vitest';

import {
  createArcadeA11yToggle,
  syncArcadeA11yMount
} from '../games/suite-arcade-a11y.js';

let dom;

afterEach(() => {
  dom?.window.close();
});

function table(width) {
  dom = new JSDOM(
    '<!doctype html><body><header class="topbar">' +
    '<span id="suite-arcade-a11y-mount" class="suite-a11y-header-slot"></span>' +
    '</header><main><div id="mobilePit"></div></main></body>',
    { url: 'http://localhost/turdjack.html' }
  );
  Object.defineProperty(dom.window, 'innerWidth', { value: width });
  const doc = dom.window.document;
  const headerSlot = doc.getElementById('suite-arcade-a11y-mount');
  const pit = doc.getElementById('mobilePit');
  const toggle = createArcadeA11yToggle(doc, { isColorblindMode: () => false });
  expect(toggle.parentElement).toBe(headerSlot);
  return { doc, headerSlot, pit, toggle };
}

it.each([390, 844])('keeps Turdjack’s declared toggle mount between hands at %ipx', (width) => {
  const { doc, headerSlot, toggle } = table(width);

  syncArcadeA11yMount(doc);

  expect(toggle.parentElement === headerSlot).toBe(true);
  expect(toggle.classList.contains('suite-arcade-a11y-toggle--inline')).toBe(true);
});

it('returns Turdjack’s toggle to the declared header mount after leaving the mobile pit', () => {
  const { doc, headerSlot, pit, toggle } = table(390);
  doc.body.classList.add('jack-table-first');

  syncArcadeA11yMount(doc);
  expect(pit.contains(toggle)).toBe(true);

  doc.body.classList.remove('jack-table-first');
  syncArcadeA11yMount(doc);

  expect(toggle.parentElement === headerSlot).toBe(true);
  expect(pit.contains(toggle)).toBe(false);
  expect(toggle.classList.contains('suite-arcade-a11y-toggle--inline')).toBe(true);
});

it('keeps the mount ID unique when the mobile pit takes the toggle', () => {
  const { doc, pit, toggle } = table(390);
  doc.body.classList.add('jack-table-first');

  syncArcadeA11yMount(doc);

  expect(pit.contains(toggle)).toBe(true);
  expect(doc.querySelectorAll('[id="suite-arcade-a11y-mount"]')).toHaveLength(1);
});

it('preserves keyboard focus when Turdjack moves the toggle out of the mobile pit', () => {
  const { doc, headerSlot, pit, toggle } = table(390);
  doc.body.classList.add('jack-table-first');
  syncArcadeA11yMount(doc);
  expect(pit.contains(toggle)).toBe(true);
  toggle.focus();
  expect(doc.activeElement === toggle).toBe(true);

  doc.body.classList.remove('jack-table-first');
  syncArcadeA11yMount(doc);

  expect(toggle.parentElement === headerSlot).toBe(true);
  expect(doc.activeElement === toggle).toBe(true);
});

it('does not move focus from another control while updating the toggle mount', () => {
  const { doc, headerSlot, pit, toggle } = table(390);
  doc.body.classList.add('jack-table-first');
  syncArcadeA11yMount(doc);
  expect(pit.contains(toggle)).toBe(true);
  const other = doc.createElement('button');
  headerSlot.before(other);
  other.focus();
  expect(doc.activeElement === other).toBe(true);

  doc.body.classList.remove('jack-table-first');
  syncArcadeA11yMount(doc);

  expect(toggle.parentElement === headerSlot).toBe(true);
  expect(doc.activeElement === other).toBe(true);
});
