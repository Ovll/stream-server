import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { broadcastServerEvent } from '../events/catalogEvents.js';

const DEFAULT_CONFIG_PATH = path.join(
    os.homedir(), 'Library', 'Application Support', 'stream-server', 'config.json'
);

export function createSettingsRouter() {
    const router = express.Router();

    router.get('/', (req, res) => {
        const config = readConfig();
        res.send(renderPage(config));
    });

    router.post('/', (req, res) => {
        const configPath = process.env.APP_CONFIG_PATH || DEFAULT_CONFIG_PATH;

        const { port, mediaDir, tmdbApiKey } = req.body || {};
        const current = readConfig();
        const updated = {
            ...current,
            port: Number(port) || current.port,
            mediaDir: String(mediaDir || current.mediaDir),
            tmdbApiKey: tmdbApiKey !== undefined ? String(tmdbApiKey) : current.tmdbApiKey,
        };

        try {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
            broadcastServerEvent('restart-required', { reason: 'settings-changed' });
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

function readConfig() {
    const configPath = process.env.APP_CONFIG_PATH || DEFAULT_CONFIG_PATH;
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {}
    }
    return {
        port: Number(process.env.PORT) || 4000,
        mediaDir: process.env.MEDIA_DIR || path.join(os.homedir(), 'Movies'),
        tmdbApiKey: process.env.TMDB_API_KEY || '',
        dbPath: process.env.DB_PATH || '',
    };
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderPage(config) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stream Server Settings</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 60px auto; padding: 0 20px; color: #111; }
    h1 { font-size: 1.4rem; margin-bottom: 2rem; }
    label { display: block; margin-bottom: 1.4rem; }
    label span { display: block; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #666; margin-bottom: 5px; }
    input { width: 100%; padding: 8px 10px; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }
    input:focus { outline: 2px solid #0070f3; border-color: transparent; }
    button { padding: 9px 22px; font-size: 1rem; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    button:hover { background: #333; }
    #msg { margin-top: 14px; font-size: 0.9rem; }
    #msg.ok { color: #0a7c3e; }
    #msg.err { color: #c00; }
  </style>
</head>
<body>
  <h1>Stream Server Settings</h1>
  <form id="f">
    <label>
      <span>TMDB API Key</span>
      <input type="password" name="tmdbApiKey" value="${esc(config.tmdbApiKey || '')}" autocomplete="off" placeholder="Your TMDB v3 API key">
    </label>
    <label>
      <span>Media Folder</span>
      <input type="text" name="mediaDir" value="${esc(config.mediaDir || '')}" placeholder="/path/to/media">
    </label>
    <label>
      <span>Port</span>
      <input type="number" name="port" value="${esc(String(config.port || 4000))}" min="1024" max="65535">
    </label>
    <button type="submit">Save &amp; Restart Server</button>
    <p id="msg"></p>
  </form>
  <script>
    document.getElementById('f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('msg');
      msg.textContent = 'Saving…'; msg.className = '';
      const fd = new FormData(e.target);
      try {
        const r = await fetch('/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(fd)),
        });
        const d = await r.json();
        if (d.ok) { msg.textContent = 'Saved — server restarting…'; msg.className = 'ok'; }
        else { msg.textContent = d.error || 'Unknown error'; msg.className = 'err'; }
      } catch (err) { msg.textContent = err.message; msg.className = 'err'; }
    });
  </script>
</body>
</html>`;
}
