import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';

import { getDatabase } from '../db/database.js';
import {
    matchMediaItemWithTmdb,
    refreshSeriesEpisodesFromTmdb,
} from '../metadata/metadata.service.js';
import { parseMediaFilename } from './filenameParser.js';
import { upsertMediaFromParsedFile } from './media.repository.js';

const VIDEO_EXTENSIONS = new Set([
    '.mp4',
    '.mkv',
    '.avi',
    '.mov',
    '.webm',
]);

const DELETE_CONFIRM_DELAY_MS = 3000;

export function startMediaWatcher(mediaDir, options = {}) {
    const {
        enrichMetadata = true,
    } = options;

    const watcher = chokidar.watch(mediaDir, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        depth: 0,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100,
        },
    });

    watcher
        .on('add', async (filePath) => {
            await handleAddOrChange(filePath, { enrichMetadata });
        })
        .on('change', async (filePath) => {
            await handleAddOrChange(filePath, { enrichMetadata });
        })
        .on('unlink', async (filePath) => {
            await handleUnlinkSafely(filePath);
        })
        .on('error', (err) => {
            console.error('Media watcher error:', err);
        })
        .on('ready', () => {
            console.log(`Media watcher ready: ${mediaDir}`);
        });

    return watcher;
}

async function handleAddOrChange(filePath, options) {
    const extension = path.extname(filePath).toLowerCase();

    if (!VIDEO_EXTENSIONS.has(extension)) {
        return;
    }

    try {
        const stat = await fs.stat(filePath);

        if (!stat.isFile()) {
            return;
        }

        const filename = path.basename(filePath);
        const parsed = parseMediaFilename(filename);

        const result = upsertMediaFromParsedFile({
            ...parsed,
            filename,
            absolutePath: filePath,
            sizeBytes: stat.size,
        });

        console.log(`Media file indexed: ${filename}`);

        const mediaItemId = result?.mediaItem?.id;

        if (options.enrichMetadata && mediaItemId) {
            await enrichMediaItem(mediaItemId);
        }
    } catch (err) {
        console.error(
            `Failed to index media file ${filePath}:`,
            err instanceof Error ? err.message : err,
        );
    }
}

async function enrichMediaItem(mediaItemId) {
    try {
        const matchResult = await matchMediaItemWithTmdb(mediaItemId);

        if (!matchResult?.updated) {
            console.warn(`No TMDB match found for media item ${mediaItemId}`);
            return;
        }

        if (matchResult.updated.type === 'series') {
            await refreshSeriesEpisodesFromTmdb(mediaItemId);
        }

        console.log(`Media metadata enriched: item ${mediaItemId}`);
    } catch (err) {
        console.error(
            `Failed to enrich media item ${mediaItemId}:`,
            err instanceof Error ? err.message : err,
        );
    }
}

async function handleUnlinkSafely(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    if (!VIDEO_EXTENSIONS.has(extension)) {
        return;
    }

    console.log(`Media file disappeared, confirming before DB delete: ${path.basename(filePath)}`);

    await delay(DELETE_CONFIRM_DELAY_MS);

    if (await fileExists(filePath)) {
        console.log(`Media file exists again, DB delete skipped: ${path.basename(filePath)}`);
        return;
    }

    await deleteMediaFileFromDatabase(filePath);
}

async function deleteMediaFileFromDatabase(filePath) {
    try {
        const db = getDatabase();

        const file = db
            .prepare(
                `
                SELECT
                    id,
                    media_item_id,
                    filename
                FROM media_files
                WHERE absolute_path = ?
                `,
            )
            .get(filePath);

        if (!file) {
            console.log(`Deleted file was not indexed: ${filePath}`);
            return;
        }

        const transaction = db.transaction(() => {
            db.prepare(
                `
                DELETE FROM media_files
                WHERE id = ?
                `,
            ).run(file.id);

            db.prepare(
                `
                DELETE FROM media_items
                WHERE id = ?
                  AND id NOT IN (
                      SELECT DISTINCT media_item_id
                      FROM media_files
                  )
                `,
            ).run(file.media_item_id);
        });

        transaction();

        console.log(`Media file removed from DB: ${file.filename}`);
    } catch (err) {
        console.error(
            `Failed to remove media file from DB ${filePath}:`,
            err instanceof Error ? err.message : err,
        );
    }
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}