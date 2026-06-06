import express from 'express';

import {
    deleteOrphanProgressRows,
    getProgressByMediaFileId,
    listContinueWatching,
    mediaFileExists,
    saveProgress,
} from './progress.repository.js';

export function createProgressRouter() {
    const router = express.Router();

    router.get('/continue-watching', (req, res) => {
        try {
            const items = listContinueWatching();
            res.json(items);
        } catch (err) {
            console.error('Failed to list continue watching:', err);
            res.status(500).json({ error: 'Failed to list continue watching' });
        }
    });

    router.post('/cleanup-orphans', (req, res) => {
        try {
            const deleted = deleteOrphanProgressRows();

            res.json({
                deleted,
            });
        } catch (err) {
            console.error('Failed to cleanup orphan progress rows:', err);
            res.status(500).json({ error: 'Failed to cleanup orphan progress rows' });
        }
    });

    router.get('/:mediaFileId', (req, res) => {
        try {
            const mediaFileId = Number(req.params.mediaFileId);

            if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaFileId' });
            }

            if (!mediaFileExists(mediaFileId)) {
                return res.json({
                    ignored: true,
                    reason: 'media file not found',
                    media_file_id: mediaFileId,
                    position_seconds: 0,
                    duration_seconds: null,
                    completed: 0,
                    updated_at: null,
                });
            }

            const progress = getProgressByMediaFileId(mediaFileId);

            if (!progress) {
                return res.json({
                    media_file_id: mediaFileId,
                    position_seconds: 0,
                    duration_seconds: null,
                    completed: 0,
                    updated_at: null,
                });
            }

            res.json(progress);
        } catch (err) {
            console.error('Failed to get progress:', err);
            res.status(500).json({ error: 'Failed to get progress' });
        }
    });

    router.post('/', (req, res) => {
        try {
            const {
                mediaFileId,
                positionSeconds,
                durationSeconds,
            } = req.body || {};

            const parsedMediaFileId = Number(mediaFileId);

            if (!Number.isInteger(parsedMediaFileId) || parsedMediaFileId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaFileId' });
            }

            const progress = saveProgress({
                mediaFileId: parsedMediaFileId,
                positionSeconds: Number(positionSeconds) || 0,
                durationSeconds:
                    durationSeconds === null || durationSeconds === undefined
                        ? null
                        : Number(durationSeconds),
            });

            res.json(progress);
        } catch (err) {
            console.error('Failed to save progress:', err);
            res.status(500).json({ error: 'Failed to save progress' });
        }
    });

    return router;
}