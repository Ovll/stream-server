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
        /^(.*?)(?:[.\s_-]+(19\d{2}|20\d{2}))?[.\s_-]*S(\d{1,2})(?:E(\d{1,2}))?(?:[.\s_-]+(.*))?$/i,
    );

    if (seriesMatch) {
        let rawTitle = seriesMatch[1];
        let rawYear = seriesMatch[2] || null;
        const rawEpisodeTail = seriesMatch[5] || '';

        // Handle "Title 2006 Episode Title S01E01" — episode title appears before SxxExx.
        // In that case the main regex didn't capture rawYear, so rawTitle still contains
        // the year and the episode-title prefix. Strip both here.
        if (!rawYear) {
            const titleYearMatch = rawTitle.match(/^(.*?)[.\s_-]+(19\d{2}|20\d{2})(?:[.\s_-]+|$)/);
            if (titleYearMatch) {
                rawTitle = titleYearMatch[1];
                rawYear = titleYearMatch[2];
            }
        }
        // When the filename has no title prefix (e.g. "S01E01.mkv" inside "Breaking Bad/"),
        // use the folder name as the series title.
        const resolvedTitle = cleanTitle(rawTitle) || (folderName ? cleanTitle(folderName) : '');

        return {
            type: 'series',
            title: resolvedTitle,
            year: rawYear ? Number(rawYear) : null,
            seasonNumber: Number(seriesMatch[3]),
            episodeNumber: seriesMatch[4] != null ? Number(seriesMatch[4]) : 1,
            episodeTitle: extractEpisodeTitle(rawEpisodeTail),
            extension,
        };
    }

    // Russian numbered releases:
    // 01. История его служанки.2026.WEB-DL 1080p.Files-x.mkv
    // 02. История его служанки.2026.WEB-DL 1080p.Files-x.mkv
    const russianEpisodeMatch = nameWithoutExtension.match(
        /^(\d{1,3})\.\s*(.+?)[.\s_-]+(19\d{2}|20\d{2})(?:[.\s_-].*)?$/u,
    );

    if (russianEpisodeMatch) {
        return {
            type: 'series',
            title: cleanTitle(russianEpisodeMatch[2]),
            year: Number(russianEpisodeMatch[3]),
            seasonNumber: 1,
            episodeNumber: Number(russianEpisodeMatch[1]),
            episodeTitle: null,
            extension,
        };
    }

    // Anime / fansub releases:
    // [AniPlague] Jujutsu Kaisen - 02 [1080p].mkv
    // [SubsPlease] Solo Leveling - 05 (1080p).mkv
    const animeEpisodeMatch = nameWithoutExtension.match(
        /^\[[^\]]+\]\s*(.+?)\s*-\s*(\d{1,4})(?:\s+(?:END|FIN|FINAL))?(?:\s*[\[(].*)?$/iu,
    );

    if (animeEpisodeMatch) {
        const folderSeasonMatch = String(folderName || '').match(
            /\bS(\d{1,2})\b/i,
        );

        return {
            type: 'series',
            title: cleanTitle(animeEpisodeMatch[1]),
            year: null,
            seasonNumber: folderSeasonMatch
                ? Number(folderSeasonMatch[1])
                : 1,
            episodeNumber: Number(animeEpisodeMatch[2]),
            episodeTitle: null,
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