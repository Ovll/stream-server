import fs from 'fs';
import path from 'path';

import { getDatabase } from '../db/database.js';
import { parseMediaFilename } from './filenameParser.js';
import { upsertMediaFromParsedFile } from './media.repository.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

export async function scanMediaFolder(mediaDir) {
    const db = getDatabase();

    if (!fs.existsSync(mediaDir)) {
        cleanupMissingFiles(db, []);
        return {
            scanned: 0,
            insertedOrUpdated: 0,
            removedMissingFiles: 0,
            removedEmptyItems: 0,
            items: [],
        };
    }

    const files = await fs.promises.readdir(mediaDir);

    const videoFiles = files.filter((file) =>
        VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase()),
    );

    const items = [];
    const seenAbsolutePaths = [];

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
    }

    const cleanup = cleanupMissingFiles(db, seenAbsolutePaths);

    return {
        scanned: videoFiles.length,
        insertedOrUpdated: items.length,
        removedMissingFiles: cleanup.removedMissingFiles,
        removedEmptyItems: cleanup.removedEmptyItems,
        items,
    };
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