import path from 'path';
import express from 'express';
import cors from 'cors';

import { createMediaRouter } from '../media/media.routes.js';
import { createStreamRouter } from '../stream/stream.routes.js';
import { createProgressRouter } from '../progress/progress.routes.js';
import { createMetadataRouter } from '../metadata/metadata.routes.js';
import { createCatalogEventsRouter } from '../events/catalogEvents.js';

export function createServer(options) {
    const {
        mediaDir,
        fontDir,
        publicDir,
    } = options;

    const app = express();

    app.use(cors());

    // Needed for POST /api/progress JSON bodies.
    app.use(express.json());

    app.use((req, res, next) => {
        // Needed when LG / browser loads media or fonts from this server.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
    });

    // Serve Lightning MSDF fonts for the packaged LG app.
    app.use('/fonts', express.static(fontDir));


    app.use(
        '/images',
        express.static(path.resolve(process.cwd(), 'data/images'), {
            maxAge: '30d',
            immutable: true,
        }),
    );

    app.get('/api/events', createCatalogEventsRouter());

    // Serve static frontend files from the "public" directory.
    app.use(express.static(publicDir));

    // Media catalog API.
    app.use('/api/media', createMediaRouter({ mediaDir }));

    // Playback progress API.
    app.use('/api/progress', createProgressRouter());

    app.use('/api/metadata', createMetadataRouter());

    // Video streaming API.
    app.use('/stream', createStreamRouter());

    return app;
}