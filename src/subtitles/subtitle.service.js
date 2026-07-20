import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SUBTITLE_CACHE_DIR = path.join(process.cwd(), 'data', 'subtitles');

export function ensureSubtitleCacheDir() {
    fs.mkdirSync(SUBTITLE_CACHE_DIR, { recursive: true });
}

export async function getSubtitleWebVtt(mediaFileId, trackId, absolutePath, subtitleTracksJson) {
    const tracks = subtitleTracksJson ? JSON.parse(subtitleTracksJson) : [];
    const track = tracks.find(t => t.id === trackId);

    if (!track) {
        return null;
    }

    const stat = await fs.promises.stat(absolutePath);
    const fileSignature = `${stat.size}-${stat.mtimeMs}`;
    const cacheFilename = `${mediaFileId}_${fileSignature}_${trackId}.vtt`;
    const cachePath = path.join(SUBTITLE_CACHE_DIR, cacheFilename);

    if (fs.existsSync(cachePath)) {
        return cachePath;
    }

    const tmpPath = path.join(os.tmpdir(), `subtitle-${mediaFileId}-${trackId}-${Date.now()}.vtt`);

    try {
        await execFileAsync('ffmpeg', [
            '-i', absolutePath,
            '-map', `0:${track.index}`,
            '-f', 'webvtt',
            tmpPath,
        ]);

        await fs.promises.rename(tmpPath, cachePath);
    } catch (err) {
        await fs.promises.unlink(tmpPath).catch(() => undefined);
        throw err;
    }

    return cachePath;
}
