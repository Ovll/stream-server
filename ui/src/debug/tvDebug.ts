const DEBUG_PLAYBACK = false;
let debugBox: HTMLPreElement | null = null;
let lines: string[] = [];

function ensureDebugBox() {
  if (debugBox) return debugBox;

  debugBox = document.createElement("pre");
  debugBox.style.position = "fixed";
  debugBox.style.left = "20px";
  debugBox.style.bottom = "20px";
  debugBox.style.width = "1200px";
  debugBox.style.maxHeight = "1000px";
  debugBox.style.zIndex = "99999999";
  debugBox.style.padding = "16px";
  debugBox.style.background = "rgba(0,0,0,0.75)";
  debugBox.style.color = "#00ff66";
  debugBox.style.fontSize = "24px";
  debugBox.style.fontFamily = "monospace";
  debugBox.style.whiteSpace = "pre-wrap";
  debugBox.style.pointerEvents = "none";

  document.body.appendChild(debugBox);
  return debugBox;
}

export function tvDebug(message: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.log(line);
  if (!DEBUG_PLAYBACK) return;

  lines.push(line);
  lines = lines.slice(-28);

  ensureDebugBox().textContent = lines.join("\n");
}

export function clearTvDebug() {
  lines = [];

  if (debugBox) {
    debugBox.textContent = "";
  }
}

export function createPlaybackTimer(name: string) {
  const start = Date.now();

  tvDebug(`${name}: start`);

  return function mark(label: string) {
    tvDebug(`${name}: +${Date.now() - start}ms ${label}`);
  };
}
