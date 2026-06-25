import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const HLS_BASE = path.join(os.tmpdir(), 'stream-hls');
const SEGMENT_DURATION = 4;
const IDLE_CLEANUP_MS = 60 * 1000; // 1 min

// sessions: mediaFileId -> { command, dir, lastAccess, ready: Promise }
const sessions = new Map();

function sessionDir(mediaFileId) {
    return path.join(HLS_BASE, String(mediaFileId));
}

function startSession(mediaFileId, videoPath, sourceCodec) {
    const existing = sessions.get(mediaFileId);
    if (existing) {
        existing.lastAccess = Date.now();
        return existing;
    }

    const dir = sessionDir(mediaFileId);
    fs.mkdirSync(dir, { recursive: true });

    const videoCodec = sourceCodec === 'h264' ? 'copy' : 'libx264';
    const outputOptions = [
        `-hls_time ${SEGMENT_DURATION}`,
        '-hls_list_size 0',
        '-hls_flags independent_segments',
        `-hls_segment_filename ${path.join(dir, 'seg%d.ts')}`,
        '-ac 2',
    ];
    if (videoCodec === 'libx264') {
        outputOptions.push('-preset ultrafast', '-tune zerolatency', '-profile:v baseline', '-level 3.1');
    }

    // Resolve once the first segment exists so callers can wait for readiness.
    let resolveReady;
    const ready = new Promise(res => { resolveReady = res; });

    const playlistPath = path.join(dir, 'playlist.m3u8');

    const command = ffmpeg(videoPath)
        .videoCodec(videoCodec)
        .audioCodec('aac')
        .format('hls')
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('error', (err) => {
            if (!err.message.includes('SIGKILL')) {
                console.error(`[hls] FFmpeg error for ${mediaFileId}:`, err.message);
            }
        })
        .on('end', () => {
            console.log(`[hls] Transcoding complete for ${mediaFileId}`);
        });

    command.run();

    // Poll until first segment appears.
    const pollInterval = setInterval(() => {
        if (fs.existsSync(path.join(dir, 'seg0.ts'))) {
            clearInterval(pollInterval);
            resolveReady();
        }
    }, 200);

    const session = { command, dir, lastAccess: Date.now(), ready };
    sessions.set(mediaFileId, session);

    scheduleCleanup(mediaFileId);
    return session;
}

function scheduleCleanup(mediaFileId) {
    setTimeout(() => {
        const session = sessions.get(mediaFileId);
        if (!session) return;

        if (Date.now() - session.lastAccess >= IDLE_CLEANUP_MS) {
            destroySession(mediaFileId);
        } else {
            scheduleCleanup(mediaFileId);
        }
    }, IDLE_CLEANUP_MS);
}

function destroySession(mediaFileId) {
    const session = sessions.get(mediaFileId);
    if (!session) return;

    try { session.command.kill('SIGKILL'); } catch {}
    try { fs.rmSync(session.dir, { recursive: true, force: true }); } catch {}

    sessions.delete(mediaFileId);
    console.log(`[hls] Cleaned up session for ${mediaFileId}`);
}

export function destroyAllSessions() {
    for (const id of sessions.keys()) destroySession(id);
}

export async function getHlsPlaylist(mediaFileId, videoPath, sourceCodec) {
    const session = startSession(mediaFileId, videoPath, sourceCodec);
    session.lastAccess = Date.now();

    await session.ready;

    const raw = fs.readFileSync(path.join(session.dir, 'playlist.m3u8'), 'utf8');
    const playlist = raw
        .replace(/^(\/[^\n]+\.ts)$/gm, (_, p) => path.basename(p))
        .replace(/(#EXT-X-VERSION:\d+\n)/, '$1#EXT-X-PLAYLIST-TYPE:EVENT\n');
    return playlist;
}

export function getHlsSegment(mediaFileId, segment) {
    const session = sessions.get(mediaFileId);
    if (!session) return null;

    session.lastAccess = Date.now();

    const segPath = path.join(session.dir, segment);
    if (!fs.existsSync(segPath)) return null;

    return segPath;
}
