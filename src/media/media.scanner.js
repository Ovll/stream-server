import fs from 'fs';
import path from 'path';

import { getDatabase } from '../db/database.js';
import {
    matchMediaItemWithTmdb,
    refreshSeriesEpisodesFromTmdb,
} from '../metadata/metadata.service.js';
import { parseMediaFilename } from './filenameParser.js';
import { upsertMediaFromParsedFile } from './media.repository.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

export async function scanMediaFolder(mediaDir, options = {}) {
    const {
        enrichMetadata = true,
    } = options;

    const db = getDatabase();

    if (!fs.existsSync(mediaDir)) {
        cleanupMissingFiles(db, []);
        return {
            scanned: 0,
            insertedOrUpdated: 0,
            removedMissingFiles: 0,
            removedEmptyItems: 0,
            enrichedItems: 0,
            items: [],
        };
    }

    const files = await fs.promises.readdir(mediaDir);

    const videoFiles = files.filter((file) =>
        VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase()),
    );

    const items = [];
    const seenAbsolutePaths = [];
    const mediaItemIdsToEnrich = new Set();

    for (const filename of videoFiles) {
        const absolutePath = path.join(mediaDir, filename);
        const stat = await fs.promises.stat(absolutePath);

        if (!stat.isFile()) continue;

        seenAbsolutePaths.push(absolutePath);

        const parsed = parseMediaFilename(filename);

        const result = upsertMediaFromParsedFile({
            ...parsed,
            filename,
            absolutePath,
            sizeBytes: stat.size,
        });

        items.push(result);

        if (result?.mediaItem?.id) {
            mediaItemIdsToEnrich.add(result.mediaItem.id);
        }
    }

    const cleanup = cleanupMissingFiles(db, seenAbsolutePaths);

    let enrichedItems = 0;

    if (enrichMetadata) {
        enrichedItems = await enrichScannedMediaItems(mediaItemIdsToEnrich);
    }

    return {
        scanned: videoFiles.length,
        insertedOrUpdated: items.length,
        removedMissingFiles: cleanup.removedMissingFiles,
        removedEmptyItems: cleanup.removedEmptyItems,
        enrichedItems,
        items,
    };
}

async function enrichScannedMediaItems(mediaItemIds) {
    let enrichedItems = 0;

    for (const mediaItemId of mediaItemIds) {
        try {
            const matchResult = await matchMediaItemWithTmdb(mediaItemId);

            if (!matchResult?.updated) {
                console.warn(`No TMDB match found for media item ${mediaItemId}`);
                continue;
            }

            enrichedItems += 1;

            if (matchResult.updated.type === 'series') {
                await refreshSeriesEpisodesFromTmdb(mediaItemId);
            }
        } catch (err) {
            console.error(
                `Failed to enrich media item ${mediaItemId}:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    return enrichedItems;
}

function cleanupMissingFiles(db, seenAbsolutePaths) {
    const existingFiles = db
        .prepare(
            `
            SELECT id, absolute_path
            FROM media_files
            `,
        )
        .all();

    const seenSet = new Set(seenAbsolutePaths);

    const missingFileIds = existingFiles
        .filter((file) => !seenSet.has(file.absolute_path))
        .map((file) => file.id);

    const deleteFile = db.prepare(
        `
        DELETE FROM media_files
        WHERE id = ?
        `,
    );

    const deleteEmptyItems = db.prepare(
        `
        DELETE FROM media_items
        WHERE id NOT IN (
            SELECT DISTINCT media_item_id
            FROM media_files
        )
        `,
    );

    const transaction = db.transaction(() => {
        for (const fileId of missingFileIds) {
            deleteFile.run(fileId);
        }

        const emptyItemsResult = deleteEmptyItems.run();

        return {
            removedMissingFiles: missingFileIds.length,
            removedEmptyItems: emptyItemsResult.changes,
        };
    });

    return transaction();
}