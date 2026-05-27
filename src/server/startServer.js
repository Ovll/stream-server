import { createServer } from './createServer.js';
import { startMediaWatcher } from '../media/media.watcher.js';

export function startServer(options) {
    const {
        port,
        host,
        mediaDir,
        fontDir,
        publicDir,
        macLanUrl,
        watchMedia = true,
    } = options;

    const app = createServer({
        mediaDir,
        fontDir,
        publicDir,
    });

    let mediaWatcher = null;

    const httpServer = app.listen(port, host, () => {
        console.log(`Stream server sweeping: ${mediaDir}`);
        console.log(`Font dir: ${fontDir}`);
        console.log(`Server listening on http://${host}:${port}`);
        if (macLanUrl) {
            console.log(`From LG:  ${macLanUrl}`);
        }
        if (watchMedia) {
            mediaWatcher = startMediaWatcher(mediaDir);
            console.log(`Watching media dir: ${mediaDir}`);
        }
    });
    httpServer.on('close', async () => {
        if (mediaWatcher) {
            await mediaWatcher.close();
            mediaWatcher = null;
        }
    });

    return httpServer;
}