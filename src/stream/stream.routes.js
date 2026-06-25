import fs from 'fs';
import express from 'express';

import { getMediaFileById } from '../media/media.repository.js';
import { streamDirectFile, streamTranscodedFile } from './stream.service.js';
import { getHlsPlaylist, getHlsSegment } from './hls.service.js';

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

        // Ignore range requests — this is a live transcoded stream with no seekable length.
        if (req.headers.range) {
            res.setHeader('Accept-Ranges', 'none');
        }

        const mediaFile = getMediaFileById(mediaFileId);

        if (!mediaFile) {
            return res.status(404).send('Media file not found.');
        }

        streamTranscodedFile(res, mediaFile.absolute_path, mediaFile.codec);
    });

    router.get('/hls/:mediaFileId/playlist.m3u8', async (req, res) => {
        const mediaFileId = Number(req.params.mediaFileId);
        if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
            return res.status(400).send('Invalid mediaFileId.');
        }

        const mediaFile = getMediaFileById(mediaFileId);
        if (!mediaFile) return res.status(404).send('Media file not found.');

        try {
            const playlist = await getHlsPlaylist(mediaFileId, mediaFile.absolute_path, mediaFile.codec);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(playlist);
        } catch (err) {
            console.error('[hls] playlist error:', err.message);
            res.status(500).send('HLS init failed.');
        }
    });

    router.get('/hls/:mediaFileId/:segment', (req, res) => {
        const mediaFileId = Number(req.params.mediaFileId);
        if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
            return res.status(400).send('Invalid mediaFileId.');
        }

        const segPath = getHlsSegment(mediaFileId, req.params.segment);
        if (!segPath) return res.status(404).send('Segment not found.');

        res.setHeader('Content-Type', 'video/mp2t');
        fs.createReadStream(segPath).pipe(res);
    });

    return router;
}