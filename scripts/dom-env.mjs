/** Sets up a jsdom-backed browser-like global environment for Node scripts. */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head><title>Reactoria</title></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  try {
    globalThis[key] = window[key];
  } catch {
    /* some properties are not copyable */
  }
}
// Node ships its own versions of these; React must see jsdom's so that
// instanceof checks and `new FormData(form)` work like in a browser.
for (const key of [
  'Event', 'EventTarget', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'CustomEvent', 'InputEvent', 'SubmitEvent',
  'HTMLElement', 'Node', 'Element', 'FormData', 'File', 'Blob', 'FileList', 'DOMException',
]) {
  if (window[key]) globalThis[key] = window[key];
}
export { window };
