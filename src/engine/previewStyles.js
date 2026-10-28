/**
 * Base stylesheet for the live preview. The preview renders inside a Shadow
 * DOM, so these styles (and the player's own) never leak into the game UI.
 */
export const PREVIEW_BASE_CSS = `
:host { all: initial; display: block; height: 100%; }
.preview-root {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Nunito, sans-serif;
  color: #1f2433;
  background: #fbfaf6;
  min-height: 100%;
  padding: 16px;
  box-sizing: border-box;
  line-height: 1.45;
  font-size: 15px;
}
.preview-root *, .preview-root *::before, .preview-root *::after { box-sizing: border-box; }
h1, h2, h3, h4 { margin: 0.2em 0 0.5em; line-height: 1.2; color: #151a2d; }
h1 { font-size: 1.8em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.15em; }
p { margin: 0.4em 0; }
ul, ol { padding-left: 1.4em; margin: 0.4em 0; }
li { margin: 0.15em 0; }
img { max-width: 100%; vertical-align: middle; }
hr { border: none; border-top: 2px dashed #d9d4c3; margin: 12px 0; }
button {
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border: none;
  border-radius: 10px;
  padding: 7px 14px;
  margin: 3px;
  background: #3b5bdb;
  color: white;
  box-shadow: 0 3px 0 #2b44a8;
  transition: transform 0.08s, box-shadow 0.08s, background 0.15s;
}
button:hover { background: #4c6ef5; }
button:active { transform: translateY(2px); box-shadow: 0 1px 0 #2b44a8; }
button:disabled { background: #adb5bd; box-shadow: 0 3px 0 #868e96; cursor: not-allowed; transform: none; }
input, textarea, select {
  font: inherit;
  padding: 7px 10px;
  border: 2px solid #d0cbbb;
  border-radius: 8px;
  background: white;
  color: inherit;
  margin: 3px;
}
input[type='checkbox'], input[type='radio'] { width: 18px; height: 18px; accent-color: #3b5bdb; vertical-align: middle; }
input:focus, textarea:focus, select:focus { outline: none; border-color: #3b5bdb; box-shadow: 0 0 0 3px rgba(59, 91, 219, 0.2); }
label { margin-right: 8px; }
form { margin: 6px 0; }
table { border-collapse: collapse; margin: 8px 0; }
th, td { border: 1px solid #e3dfd2; padding: 4px 10px; text-align: left; }
code { font-family: 'JetBrains Mono', ui-monospace, monospace; background: #efece2; padding: 1px 5px; border-radius: 4px; }
section, article { margin: 6px 0; }
.card {
  background: white;
  border: 2px solid #ebe6d6;
  border-radius: 14px;
  padding: 12px 14px;
  margin: 8px 0;
  box-shadow: 0 2px 0 #ebe6d6;
}
.error { color: #c92a2a; }
.success { color: #2b8a3e; }
`;
