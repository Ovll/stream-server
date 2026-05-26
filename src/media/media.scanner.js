import fs from 'fs';
import path from 'path';

import { parseMediaFilename } from './filenameParser.js';
import { upsertMediaFromParsedFile } from './media.repository.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

export async function scanMediaFolder(mediaDir) {
    if (!fs.existsSync(mediaDir)) {
        return {
            scanned: 0,
            insertedOrUpdated: 0,
            items: [],
        };
    }

    const files = await fs.promises.readdir(mediaDir);

    const videoFiles = files.filter((file) =>
        VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase()),
    );

    const items = [];

    for (const filename of videoFiles) {
        const absolutePath = path.join(mediaDir, filename);
        const stat = await fs.promises.stat(absolutePath);

        if (!stat.isFile()) continue;

        const parsed = parseMediaFilename(filename);

        const result = upsertMediaFromParsedFile({
            ...parsed,
            filename,
            absolutePath,
            sizeBytes: stat.size,
        });

        items.push(result);
    }

    return {
        scanned: videoFiles.length,
        insertedOrUpdated: items.length,
        items,
    };
}