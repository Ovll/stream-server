import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

function getVideoContentType(videoPath) {
    const extension = path.extname(videoPath).toLowerCase();

    switch (extension) {
        case '.mp4':
            return 'video/mp4';
        case '.mkv':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.mov':
            return 'video/quicktime';
        case '.avi':
            return 'video/x-msvideo';
        default:
            return 'application/octet-stream';
    }
}

export function streamDirectFile(req, res, videoPath) {
    if (typeof videoPath !== 'string' || !fs.existsSync(videoPath)) {
        return res.status(404).send('Video file not found.');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getVideoContentType(videoPath);

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const file = fs.createReadStream(videoPath, { start, end });

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
        };

        res.writeHead(206, head);
        file.pipe(res);
        return;
    }

    const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
    };

    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
}

export function streamTranscodedFile(res, videoPath, sourceCodec = null) {
    if (typeof videoPath !== 'string' || !fs.existsSync(videoPath)) {
        return res.status(404).send('Video file not found.');
    }

    const videoCodec = sourceCodec === 'h264' ? 'copy' : 'libx264';

    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Transfer-Encoding': 'chunked',
        'Accept-Ranges': 'none',
        'X-Content-Duration': '0',
    });

    const outputOptions = [
        '-movflags frag_keyframe+empty_moov',
        '-map 0:v:0',
        '-map 0:a:0?',
        '-ac 2',
    ];
    if (videoCodec === 'libx264') {
        outputOptions.push(
            '-preset ultrafast',
            '-tune zerolatency',
            '-profile:v baseline',
            '-level 3.1',
        );
    }

    const command = ffmpeg(videoPath)
        .videoCodec(videoCodec)
        .audioCodec('aac')
        .format('mp4')
        .outputOptions(outputOptions)
        .on('error', (err) => {
            if (!err.message.includes('Output stream closed') && !err.message.includes('SIGKILL')) {
                console.error('FFmpeg transcoding error:', err.message);
            }
        });

    command.pipe(res, { end: true });

    res.on('close', () => command.kill('SIGKILL'));
}