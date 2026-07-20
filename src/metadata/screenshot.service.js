import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getScreenshotRoot() {
    return path.resolve(
        process.cwd(),
        'data/images/stills',
    );
}

function createScreenshotFilename(videoPath) {
    const hash = crypto
        .createHash('sha256')
        .update(videoPath)
        .digest('hex')
        .slice(0, 32);

    return `${hash}.jpg`;
}

function getScreenshotDiskPath(videoPath) {
    return path.join(
        getScreenshotRoot(),
        createScreenshotFilename(videoPath),
    );
}

function getScreenshotPublicPath(videoPath) {
    return `/images/stills/${createScreenshotFilename(videoPath)}`;
}

function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (error, metadata) => {
            if (error) {
                reject(error);
                return;
            }

            const duration = Number(
                metadata?.format?.duration,
            );

            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                reject(
                    new Error(
                        `Could not determine video duration: ${videoPath}`,
                    ),
                );
                return;
            }

            resolve(duration);
        });
    });
}

function takeScreenshot(
    videoPath,
    outputDirectory,
    filename,
    timestampSeconds,
) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .on('end', resolve)
            .on('error', reject)
            .screenshots({
                timestamps: [timestampSeconds],
                filename,
                folder: outputDirectory,
                size: '1280x720',
            });
    });
}

export async function generateEpisodeStill(videoPath) {
    if (!videoPath) {
        return null;
    }

    if (!fs.existsSync(videoPath)) {
        throw new Error(
            `Video file does not exist: ${videoPath}`,
        );
    }

    const outputDirectory = getScreenshotRoot();
    const diskPath = getScreenshotDiskPath(videoPath);
    const publicPath =
        getScreenshotPublicPath(videoPath);

    if (fs.existsSync(diskPath)) {
        return publicPath;
    }

    ensureDir(outputDirectory);

    const duration = await getVideoDuration(videoPath);

    /*
     * Use a frame at 20% of the episode duration.
     * Avoids intros, black frames, and studio logos in most files.
     */
    const timestampSeconds = Math.max(
        10,
        Math.floor(duration * 0.2),
    );

    await takeScreenshot(
        videoPath,
        outputDirectory,
        path.basename(diskPath),
        timestampSeconds,
    );

    if (!fs.existsSync(diskPath)) {
        throw new Error(
            `FFmpeg finished but screenshot was not created: ${diskPath}`,
        );
    }

    return publicPath;
}