import path from 'path';

export function parseMediaFilename(filename, folderName = null) {
    const extension = path.extname(filename);
    const nameWithoutExtension = path.basename(filename, extension);

    // Examples:
    // Marshals.S01E13.Wolves.at.the.Door.1080p...
    // CIA.2026.S01E11.Forbidden.Eye.1080p...
    //
    // Important:
    // For TV, a year before S01E01 is often a release year, not part of the title.
    const seriesMatch = nameWithoutExtension.match(
        /^(.*?)(?:[.\s_-]+(19\d{2}|20\d{2}))?[.\s_-]*S(\d{1,2})E(\d{1,2})(?:[.\s_-]+(.*))?$/i,
    );

    if (seriesMatch) {
        const rawTitle = seriesMatch[1];
        const rawYear = seriesMatch[2] || null;
        const rawEpisodeTail = seriesMatch[5] || '';
        // When the filename has no title prefix (e.g. "S01E01.mkv" inside "Breaking Bad/"),
        // use the folder name as the series title.
        const resolvedTitle = cleanTitle(rawTitle) || (folderName ? cleanTitle(folderName) : '');

        return {
            type: 'series',
            title: resolvedTitle,
            year: rawYear ? Number(rawYear) : null,
            seasonNumber: Number(seriesMatch[3]),
            episodeNumber: Number(seriesMatch[4]),
            episodeTitle: extractEpisodeTitle(rawEpisodeTail),
            extension,
        };
    }

    const movieYearMatch = nameWithoutExtension.match(
        /^(.*?)[.\s_-]+(19\d{2}|20\d{2})(?:[.\s_-]|$)/,
    );

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
        .replace(/\[[^\]]*]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractEpisodeTitle(value) {
    if (!value) return null;

    const beforeQualityTags = value
        .replace(/\[[^\]]*]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .split(/[.\s_-]+(?=720p|1080p|2160p|480p|WEB|WEBRip|BluRay|HEVC|x265|x264|HDRip|DVDRip)/i)[0];

    const cleaned = cleanTitle(beforeQualityTags);

    return cleaned || null;
}