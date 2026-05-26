import fs from 'fs';
import path from 'path';

import { loadAppConfig } from './src/config/appConfig.js';
import { openDatabase } from './src/db/database.js';
import { startServer } from './src/server/startServer.js';
import { scanMediaFolder } from './src/media/media.scanner.js';

const config = loadAppConfig();

console.log('Opening database:', config.dbPath);

openDatabase({
    dbPath: config.dbPath,
});

console.log('Database ready');

console.log('Scanning media folder:', config.mediaDir);

try {
    const scanResult = await scanMediaFolder(config.mediaDir);
    console.log(
        `Media scan complete: ${scanResult.insertedOrUpdated}/${scanResult.scanned} files inserted or updated`
    );
} catch (err) {
    console.error('Media scan failed:', err);
}

console.log('Font dir:', config.fontDir);
console.log(
    'Roboto exists:',
    fs.existsSync(path.join(config.fontDir, 'Roboto-Regular.msdf.json'))
);

startServer({
    port: config.port,
    host: config.host,
    mediaDir: config.mediaDir,
    fontDir: config.fontDir,
    publicDir: config.publicDir,
    macLanUrl: config.macLanUrl,
});