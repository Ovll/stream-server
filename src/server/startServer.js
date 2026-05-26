import { createServer } from './createServer.js';

export function startServer(options) {
    const {
        port,
        host,
        mediaDir,
        fontDir,
        publicDir,
        macLanUrl,
    } = options;

    const app = createServer({
        mediaDir,
        fontDir,
        publicDir,
    });

    const httpServer = app.listen(port, host, () => {
        console.log(`Stream server sweeping: ${mediaDir}`);
        console.log(`Font dir: ${fontDir}`);
        console.log(`Server listening on http://${host}:${port}`);
        console.log(`From Mac: http://localhost:${port}`);

        if (macLanUrl) {
            console.log(`From LG:  ${macLanUrl}`);
            console.log(`Media API: ${macLanUrl}/api/media`);
            console.log(`Roboto:   ${macLanUrl}/fonts/Roboto-Regular.msdf.json`);
        }
    });

    return httpServer;
}