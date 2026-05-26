import express from 'express';

import { getMediaFileById } from '../media/media.repository.js';
import { streamDirectFile, streamTranscodedFile } from './stream.service.js';

export function createStreamRouter() {
    const router = express.Router();

    router.get('/direct/:mediaFileId', (req, res) => {
        const mediaFileId = Number(req.params.mediaFileId);

        if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
            return res.status(400).send('Invalid mediaFileId.');
        }

        const mediaFile = getMediaFileById(mediaFileId);

        if (!mediaFile) {
            return res.status(404).send('Media file not found.');
        }

        streamDirectFile(req, res, mediaFile.absolute_path);
    });

    router.get('/transcode/:mediaFileId', (req, res) => {
        const mediaFileId = Number(req.params.mediaFileId);

        if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
            return res.status(400).send('Invalid mediaFileId.');
        }

        const mediaFile = getMediaFileById(mediaFileId);

        if (!mediaFile) {
            return res.status(404).send('Media file not found.');
        }

        streamTranscodedFile(res, mediaFile.absolute_path);
    });

    return router;
}