import express from 'express';
import { getDatabase } from '../db/database.js';
import { getSubtitleWebVtt } from './subtitle.service.js';

export function createSubtitleRouter() {
    const router = express.Router();

    router.get('/:mediaFileId/:trackId', async (req, res) => {
        const mediaFileId = Number(req.params.mediaFileId);
        const { trackId } = req.params;

        if (!Number.isInteger(mediaFileId)) {
            return res.status(404).json({ error: 'Not found' });
        }

        const db = getDatabase();
        const file = db
            .prepare(`SELECT absolute_path, subtitle_tracks FROM media_files WHERE id = ? LIMIT 1`)
            .get(mediaFileId);

        if (!file) {
            return res.status(404).json({ error: 'Not found' });
        }

        try {
            const cachePath = await getSubtitleWebVtt(
                mediaFileId,
                trackId,
                file.absolute_path,
                file.subtitle_tracks,
            );

            if (!cachePath) {
                return res.status(404).json({ error: 'Subtitle track not found' });
            }

            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'no-cache');
            res.sendFile(cachePath);
        } catch (err) {
            console.error(`Failed to extract subtitle track ${trackId} for file ${mediaFileId}:`, err?.message);
            res.status(404).json({ error: 'Subtitle extraction failed' });
        }
    });

    return router;
}
