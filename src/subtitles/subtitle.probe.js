import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TEXT_CODECS = new Set(['subrip', 'ass', 'ssa', 'webvtt', 'mov_text']);

export async function probeSubtitleTracks(absolutePath) {
    let stdout;

    try {
        ({ stdout } = await execFileAsync('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-select_streams', 's',
            absolutePath,
        ]));
    } catch {
        return null;
    }

    let streams;
    try {
        ({ streams } = JSON.parse(stdout));
    } catch {
        return null;
    }

    if (!Array.isArray(streams) || streams.length === 0) {
        return null;
    }

    const tracks = streams
        .filter(s => TEXT_CODECS.has(s.codec_name))
        .map(s => ({
            id: `s${s.index}`,
            index: s.index,
            codec: s.codec_name,
            language: s.tags?.language ?? null,
            title: s.tags?.title ?? null,
            default: s.disposition?.default === 1,
            forced: s.disposition?.forced === 1,
        }));

    return tracks.length > 0 ? tracks : null;
}
