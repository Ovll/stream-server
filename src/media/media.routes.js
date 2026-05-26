import express from 'express';

import {
    getCatalog,
    getFilePlayTarget,
    getPlayTarget,
} from './media.repository.js';
import { scanMediaFolder } from './media.scanner.js';

export function createMediaRouter(options) {
    const { mediaDir } = options;

    const router = express.Router();

    router.get('/catalog', async (req, res) => {
        try {
            const catalog = getCatalog();
            res.json(catalog);
        } catch (err) {
            console.error('Failed to get media catalog:', err);
            res.status(500).json({ error: 'Failed to get media catalog' });
        }
    });

    router.get('/file/:mediaFileId/play-target', (req, res) => {
        try {
            const mediaFileId = Number(req.params.mediaFileId);

            if (!Number.isInteger(mediaFileId) || mediaFileId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaFileId' });
            }

            const target = getFilePlayTarget(mediaFileId);

            if (!target) {
                return res.status(404).json({ error: 'File play target not found' });
            }

            res.json(target);
        } catch (err) {
            console.error('Failed to get file play target:', err);
            res.status(500).json({ error: 'Failed to get file play target' });
        }
    });

    router.get('/:mediaItemId/play-target', (req, res) => {
        try {
            const mediaItemId = Number(req.params.mediaItemId);

            if (!Number.isInteger(mediaItemId) || mediaItemId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaItemId' });
            }

            const target = getPlayTarget(mediaItemId);

            if (!target) {
                return res.status(404).json({ error: 'Play target not found' });
            }

            res.json(target);
        } catch (err) {
            console.error('Failed to get play target:', err);
            res.status(500).json({ error: 'Failed to get play target' });
        }
    });

    router.post('/scan', async (req, res) => {
        try {
            const result = await scanMediaFolder(mediaDir);
            res.json(result);
        } catch (err) {
            console.error('Failed to scan media folder into database:', err);
            res.status(500).json({ error: 'Failed to scan media folder into database' });
        }
    });

    return router;
}