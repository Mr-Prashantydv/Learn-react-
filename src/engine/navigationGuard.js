/**
 * Keeps the player's forms and links from navigating the game page away.
 *
 * Listeners sit *outside* the React root, so they run after React (and the
 * player's handlers) have seen the event. If nothing prevented the default
 * action:
 *  - mode 'block' (live preview): we call preventDefault() and report it, so
 *    the player learns why a real page would have reloaded.
 *  - mode 'sink' (quest checks): we leave `event.defaultPrevented` untouched —
 *    checks may need to observe it — and instead retarget the navigation into a
 *    hidden, script-less iframe.
 */
const SINK_NAME = 'reactoria-navigation-sink';

function getSink(doc) {
  let frame = doc.querySelector(`iframe[name="${SINK_NAME}"]`);
  if (!frame) {
    frame = doc.createElement('iframe');
    frame.name = SINK_NAME;
    frame.setAttribute('sandbox', '');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0;visibility:hidden;';
    doc.body.appendChild(frame);
  }
  return frame;
}

function retarget(el) {
  const doc = el.ownerDocument;
  getSink(doc);
  const had = el.hasAttribute('target');
  const prev = el.getAttribute('target');
  el.setAttribute('target', SINK_NAME);
  setTimeout(() => {
    if (had) el.setAttribute('target', prev);
    else el.removeAttribute('target');
  }, 0);
}

function isHarmlessLink(a) {
  const href = a.getAttribute('href') || '';
  return href.startsWith('#') || a.target === '_blank' || href.startsWith('javascript:');
}

export function guardNavigation(node, { mode = 'block', onBlocked } = {}) {
  const onSubmit = (event) => {
    if (event.defaultPrevented) return;
    const form = event.target;
    if (mode === 'block') event.preventDefault();
    else if (form && form.tagName === 'FORM') retarget(form);
    onBlocked?.({ kind: 'form', element: form });
  };
  const onClick = (event) => {
    if (event.defaultPrevented) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || isHarmlessLink(anchor)) return;
    if (mode === 'block') event.preventDefault();
    else retarget(anchor);
    onBlocked?.({ kind: 'link', element: anchor, href: anchor.getAttribute('href') });
  };
  node.addEventListener('submit', onSubmit);
  node.addEventListener('click', onClick);
  return () => {
    node.removeEventListener('submit', onSubmit);
    node.removeEventListener('click', onClick);
  };
}
