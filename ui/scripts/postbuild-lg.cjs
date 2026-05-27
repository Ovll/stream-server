const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, "dist", "lg");

const indexHtmlPath = path.join(outDir, "index.html");
const appinfoSrc = path.join(root, "devices", "lg", "appinfo.json");
const iconSrc = path.join(root, "devices", "lg", "icon.png");

const appinfoDest = path.join(outDir, "appinfo.json");
const iconDest = path.join(outDir, "icon.png");

if (!fs.existsSync(indexHtmlPath)) {
  throw new Error(`Missing ${indexHtmlPath}`);
}

fs.copyFileSync(appinfoSrc, appinfoDest);
fs.copyFileSync(iconSrc, iconDest);

const originalHtml = fs.readFileSync(indexHtmlPath, "utf8");

const polyfillMatch = originalHtml.match(
  /<script[^>]+src=["']([^"']*polyfills-legacy[^"']*\.js)["'][^>]*>/i
);

const legacyEntryMatch =
  originalHtml.match(
    /<script[^>]+id=["']vite-legacy-entry["'][^>]+data-src=["']([^"']*index-legacy[^"']*\.js)["'][^>]*>/i
  ) ||
  originalHtml.match(
    /<script[^>]+data-src=["']([^"']*index-legacy[^"']*\.js)["'][^>]*>/i
  ) ||
  originalHtml.match(
    /<script[^>]+src=["']([^"']*index-legacy[^"']*\.js)["'][^>]*>/i
  );

if (!legacyEntryMatch) {
  throw new Error("Could not find legacy entry script in index.html");
}

const polyfillSrc = polyfillMatch ? polyfillMatch[1] : null;
const legacyEntrySrc = legacyEntryMatch[1];

const cleanHtml = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, viewport-fit=cover"
  />
  <title>Stream Server</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: black;
      overflow: hidden;
      color: white;
      font-family: sans-serif;
    }

    #app {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="app"></div>
  ${polyfillSrc ? `<script src="${polyfillSrc}"></script>` : ""}
  <script src="${legacyEntrySrc}"></script>
</body>
</html>
`;

fs.writeFileSync(indexHtmlPath, cleanHtml);

console.log("[postbuild-lg] copied appinfo.json");
console.log("[postbuild-lg] copied icon.png");
console.log("[postbuild-lg] rewrote index.html to legacy-only classic scripts");
console.log("[postbuild-lg] polyfill:", polyfillSrc || "(none)");
console.log("[postbuild-lg] legacy entry:", legacyEntrySrc);