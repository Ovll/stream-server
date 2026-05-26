import path from 'path';

export function parseMediaFilename(filename) {
    const extension = path.extname(filename);
    const nameWithoutExtension = path.basename(filename, extension);

    const seriesMatch = nameWithoutExtension.match(/^(.*?)[.\s_-]+S(\d{1,2})E(\d{1,2})/i);

    if (seriesMatch) {
        const rawTitle = seriesMatch[1];

        return {
            type: 'series',
            title: cleanTitle(rawTitle),
            year: null,
            seasonNumber: Number(seriesMatch[2]),
            episodeNumber: Number(seriesMatch[3]),
            episodeTitle: null,
            extension,
        };
    }

    const movieYearMatch = nameWithoutExtension.match(/^(.*?)[.\s_-]+(19\d{2}|20\d{2})(?:[.\s_-]|$)/);

    if (movieYearMatch) {
        return {
            type: 'movie',
            title: cleanTitle(movieYearMatch[1]),
            year: Number(movieYearMatch[2]),
            seasonNumber: null,
            episodeNumber: null,
            episodeTitle: null,
            extension,
        };
    }

    return {
        type: 'movie',
        title: cleanTitle(nameWithoutExtension),
        year: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        extension,
    };
}

function cleanTitle(value) {
    return value
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}