import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootFileUrl = import.meta.url;
const currentFile = fileURLToPath(rootFileUrl);

// src/config/appConfig.js -> project root is ../..
const PROJECT_ROOT = path.resolve(path.dirname(currentFile), '..', '..');

export function loadAppConfig() {
    const envPath = path.join(PROJECT_ROOT, '.env');

    if (fs.existsSync(envPath)) {
        process.loadEnvFile(envPath);
    }

    const port = process.env.PORT || 4000;
    const host = process.env.HOST || '0.0.0.0';

    const mediaDir = process.env.MEDIA_DIR
        ? path.resolve(process.env.MEDIA_DIR)
        : path.join(PROJECT_ROOT, 'media');

    const fontDir = process.env.FONT_DIR
        ? path.resolve(process.env.FONT_DIR)
        : path.join(PROJECT_ROOT, 'ui', 'dist', 'lg', 'fonts');

    const publicDir = process.env.PUBLIC_DIR
        ? path.resolve(process.env.PUBLIC_DIR)
        : path.join(PROJECT_ROOT, 'public');

    const dbPath = process.env.DB_PATH
        ? path.resolve(process.env.DB_PATH)
        : path.join(PROJECT_ROOT, 'data', 'stream-server.db');

    // TODO later: detect this automatically.
    const macLanUrl = process.env.MAC_LAN_URL || `http://192.168.1.22:${port}`;

    return {
        projectRoot: PROJECT_ROOT,
        port,
        host,
        mediaDir,
        fontDir,
        publicDir,
        dbPath,
        macLanUrl,
    };
}