import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const TMDB_IMAGE_BASE_URL =
    process.env.TMDB_IMAGE_BASE_URL ||
    'https://image.tmdb.org/t/p';

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getImageExtension(filePath) {
    try {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            const url = new URL(filePath);
            const extension = path.extname(url.pathname);

            return extension || '.jpg';
        }

        return path.extname(filePath) || '.jpg';
    } catch {
        return '.jpg';
    }
}

function safeImageFilename(filePath, size) {
    const extension = getImageExtension(filePath);

    const hash = crypto
        .createHash('sha256')
        .update(`${size}:${filePath}`)
        .digest('hex')
        .slice(0, 32);

    return `${size}-${hash}${extension}`;
}

function getRemoteImageUrl(filePath, size) {
    if (
        filePath.startsWith('http://') ||
        filePath.startsWith('https://')
    ) {
        return filePath;
    }

    return `${TMDB_IMAGE_BASE_URL}/${size}${filePath}`;
}

export function getImageCacheRoot() {
    return path.resolve(process.cwd(), 'data/images');
}

export function getCachedImagePublicPath(
    kind,
    filePath,
    size = 'w500',
) {
    if (!filePath) {
        return null;
    }

    const filename = safeImageFilename(filePath, size);

    return `/images/${kind}/${filename}`;
}

export function getCachedImageDiskPath(
    kind,
    filePath,
    size = 'w500',
) {
    if (!filePath) {
        return null;
    }

    const root = getImageCacheRoot();
    const filename = safeImageFilename(filePath, size);

    return path.join(root, kind, filename);
}

export async function cacheRemoteImage(
    kind,
    filePath,
    size = 'w500',
) {
    if (!filePath) {
        return null;
    }

    const diskPath = getCachedImageDiskPath(
        kind,
        filePath,
        size,
    );

    const publicPath = getCachedImagePublicPath(
        kind,
        filePath,
        size,
    );

    if (fs.existsSync(diskPath)) {
        return publicPath;
    }

    ensureDir(path.dirname(diskPath));

    const url = getRemoteImageUrl(filePath, size);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to download image ${url}. ` +
            `Status: ${response.status} ${response.statusText}`,
        );
    }

    const buffer = Buffer.from(
        await response.arrayBuffer(),
    );

    await fs.promises.writeFile(diskPath, buffer);

    return publicPath;
}

/*
 * Backward-compatible name.
 *
 * Existing files can continue importing cacheTmdbImage while the
 * application is gradually changed to the provider-neutral name.
 */
export async function cacheTmdbImage(
    kind,
    filePath,
    size = 'w500',
) {
    return cacheRemoteImage(kind, filePath, size);
}

export async function cacheRemoteImages(items) {
    const results = [];

    for (const item of items) {
        try {
            const publicPath = await cacheRemoteImage(
                item.kind,
                item.filePath,
                item.size,
            );

            results.push({
                ...item,
                publicPath,
                ok: true,
            });
        } catch (error) {
            console.error(
                'Failed to cache remote image:',
                item,
                error,
            );

            results.push({
                ...item,
                publicPath: null,
                ok: false,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });
        }
    }

    return results;
}

/*
 * Backward-compatible batch function.
 */
export async function cacheTmdbImages(items) {
    return cacheRemoteImages(items);
}