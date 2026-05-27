// media/media.watcher.js
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';

import { parseMediaFilename } from './filenameParser.js';
import {
    upsertMediaFromParsedFile,
    deleteMediaFileByPath,
} from './media.repository.js';

export function startMediaWatcher(mediaDir) {
    const watcher = chokidar.watch(mediaDir, {
        ignored: /(^|[\/\\])\../,
        persistent: true,

        // depth: 0 means only direct children of mediaDir.
        // Use undefined or remove this line if you want recursive watching.
        depth: 0,

        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100,
        },
    });

    async function handleAddOrChange(filePath) {
        try {
            const filename = path.basename(filePath);
            const stat = await fs.stat(filePath);

            if (!stat.isFile()) {
                return;
            }

            const parsed = parseMediaFilename(filename);

            if (!parsed) {
                console.warn(`Skipped unrecognized media filename: ${filename}`);
                return;
            }

            await upsertMediaFromParsedFile({
                ...parsed,
                filename,
                absolutePath: filePath,
                sizeBytes: stat.size,
            });

            console.log(`Media indexed: ${filename}`);
        } catch (err) {
            console.error(`Failed to index media file: ${filePath}`, err);
        }
    }

    async function handleUnlink(filePath) {
        try {
            await deleteMediaFileByPath(filePath);
            console.log(`Media removed from DB: ${filePath}`);
        } catch (err) {
            console.error(`Failed to remove media file from DB: ${filePath}`, err);
        }
    }

    watcher
        .on('add', handleAddOrChange)
        .on('change', handleAddOrChange)
        .on('unlink', handleUnlink)
        .on('error', (err) => {
            console.error('Media watcher error:', err);
        });

    return watcher;
}