import fs from 'fs';
import path from 'path';

const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function safeImageFilename(filePath, size) {
    const cleanPath = filePath.replace(/^\//, '');
    return `${size}-${cleanPath}`;
}

export function getImageCacheRoot() {
    return path.resolve(process.cwd(), 'data/images');
}

export function getCachedImagePublicPath(kind, filePath, size = 'w500') {
    if (!filePath) return null;

    const filename = safeImageFilename(filePath, size);
    return `/images/${kind}/${filename}`;
}

export function getCachedImageDiskPath(kind, filePath, size = 'w500') {
    const root = getImageCacheRoot();
    const filename = safeImageFilename(filePath, size);

    return path.join(root, kind, filename);
}

export async function cacheTmdbImage(kind, filePath, size = 'w500') {
    if (!filePath) return null;

    const diskPath = getCachedImageDiskPath(kind, filePath, size);
    const publicPath = getCachedImagePublicPath(kind, filePath, size);

    if (fs.existsSync(diskPath)) {
        return publicPath;
    }

    ensureDir(path.dirname(diskPath));

    const url = `${TMDB_IMAGE_BASE_URL}/${size}${filePath}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download image ${url}. Status: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(diskPath, buffer);

    return publicPath;
}

export async function cacheTmdbImages(items) {
    const results = [];

    for (const item of items) {
        try {
            const publicPath = await cacheTmdbImage(item.kind, item.filePath, item.size);

            results.push({
                ...item,
                publicPath,
                ok: true,
            });
        } catch (err) {
            console.error('Failed to cache TMDB image:', item, err);

            results.push({
                ...item,
                publicPath: null,
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return results;
}