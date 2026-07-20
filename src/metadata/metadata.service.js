import { getDatabase } from '../db/database.js';
import { cacheTmdbImage } from '../images/imageCache.service.js';
import {
    searchKinopoiskSeries,
} from './kinopoisk.client.js';
import {
    getTvEpisodeDetails,
    getTvEpisodeImages,
    searchMovie,
    searchTv,
} from './tmdb.client.js';
import { generateEpisodeStill } from './screenshot.service.js';

function getMediaItemById(mediaItemId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT
                id,
                type,
                title,
                sort_title,
                year,
                overview,
                poster_path,
                backdrop_path,
                external_source,
                external_id,
                metadata_json,
                created_at,
                updated_at
            FROM media_items
            WHERE id = ?
            `,
        )
        .get(mediaItemId);
}

function getMediaFilesByMediaItemId(mediaItemId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT
                id,
                media_item_id,
                filename,
                absolute_path,
                size_bytes,
                season_number,
                episode_number,
                episode_title,
                still_path
            FROM media_files
            WHERE media_item_id = ?
            ORDER BY season_number, episode_number, filename
            `,
        )
        .all(mediaItemId);
}

function updateMediaItemMetadata(mediaItemId, data) {
    const db = getDatabase();

    db.prepare(
        `
        UPDATE media_items
        SET
            title = ?,
            sort_title = ?,
            year = ?,
            overview = ?,
            poster_path = ?,
            backdrop_path = ?,
            external_source = ?,
            external_id = ?,
            metadata_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
    ).run(
        data.title,
        data.sortTitle,
        data.year,
        data.overview,
        data.posterPath,
        data.backdropPath,
        data.externalSource,
        String(data.externalId),
        JSON.stringify(data.metadata ?? {}),
        mediaItemId,
    );

    return getMediaItemById(mediaItemId);
}

function updateMediaFileEpisodeMetadata(mediaFileId, data) {
    const db = getDatabase();

    db.prepare(
        `
        UPDATE media_files
        SET
            episode_title = ?,
            still_path = ?
        WHERE id = ?
        `,
    ).run(
        data.episodeTitle,
        data.stillPath,
        mediaFileId,
    );
}

function clearEpisodeMetadataForMediaItem(mediaItemId) {
    const db = getDatabase();

    db.prepare(
        `
        UPDATE media_files
        SET
            episode_title = NULL,
            still_path = NULL
        WHERE media_item_id = ?
        `,
    ).run(mediaItemId);
}

function getYearFromDate(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const year = Number(value.slice(0, 4));

    return Number.isInteger(year) ? year : null;
}

function normalizeTitle(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function scoreTitleMatch(candidateTitle, wantedTitle) {
    const candidate = normalizeTitle(candidateTitle);
    const wanted = normalizeTitle(wantedTitle);

    if (!candidate || !wanted) {
        return 0;
    }

    if (candidate === wanted) {
        return 100;
    }

    if (candidate.startsWith(wanted)) {
        return 80;
    }

    if (candidate.includes(wanted)) {
        return 60;
    }

    if (wanted.includes(candidate)) {
        return 50;
    }

    return 0;
}

function selectBestTvMatch(results, mediaItem) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const preferredYear = mediaItem.year
        ? Number(mediaItem.year)
        : null;

    const scored = results.map((item, index) => {
        const firstAirYear = getYearFromDate(item.first_air_date);

        const titleScore = Math.max(
            scoreTitleMatch(item.name, mediaItem.title),
            scoreTitleMatch(item.original_name, mediaItem.title),
        );

        const yearScore =
            preferredYear && firstAirYear === preferredYear
                ? 100
                : preferredYear &&
                    firstAirYear &&
                    Math.abs(firstAirYear - preferredYear) <= 1
                    ? 30
                    : 0;

        const posterScore = item.poster_path ? 10 : 0;
        const backdropScore = item.backdrop_path ? 5 : 0;

        return {
            item,
            index,
            score:
                titleScore +
                yearScore +
                posterScore +
                backdropScore,
        };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return a.index - b.index;
    });

    const best = scored[0];

    if (!best || best.score < 50) {
        return null;
    }

    return best.item;
}

function selectBestMovieMatch(results, mediaItem) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const preferredYear = mediaItem.year
        ? Number(mediaItem.year)
        : null;

    const scored = results.map((item, index) => {
        const releaseYear = getYearFromDate(item.release_date);

        const titleScore = Math.max(
            scoreTitleMatch(item.title, mediaItem.title),
            scoreTitleMatch(item.original_title, mediaItem.title),
        );

        const yearScore =
            preferredYear && releaseYear === preferredYear
                ? 100
                : preferredYear &&
                    releaseYear &&
                    Math.abs(releaseYear - preferredYear) <= 1
                    ? 30
                    : 0;

        const posterScore = item.poster_path ? 10 : 0;
        const backdropScore = item.backdrop_path ? 5 : 0;

        return {
            item,
            index,
            score:
                titleScore +
                yearScore +
                posterScore +
                backdropScore,
        };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return a.index - b.index;
    });

    const best = scored[0];

    if (!best || best.score < 50) {
        return null;
    }

    return best.item;
}

function selectBestKinopoiskSeriesMatch(results, mediaItem) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const preferredYear = mediaItem.year
        ? Number(mediaItem.year)
        : null;

    const scored = results.map((item, index) => {
        const titleScore = Math.max(
            scoreTitleMatch(item.name, mediaItem.title),
            scoreTitleMatch(item.alternativeName, mediaItem.title),
            scoreTitleMatch(item.enName, mediaItem.title),
        );

        const resultYear = item.year
            ? Number(item.year)
            : null;

        const yearScore =
            preferredYear && resultYear === preferredYear
                ? 100
                : preferredYear &&
                    resultYear &&
                    Math.abs(resultYear - preferredYear) <= 1
                    ? 30
                    : 0;

        const posterScore =
            item.poster?.url || item.poster?.previewUrl
                ? 10
                : 0;

        const backdropScore =
            item.backdrop?.url || item.backdrop?.previewUrl
                ? 5
                : 0;

        return {
            item,
            index,
            score:
                titleScore +
                yearScore +
                posterScore +
                backdropScore,
        };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return a.index - b.index;
    });

    const best = scored[0];

    if (!best || best.score < 50) {
        return null;
    }

    return best.item;
}

export async function matchMediaItem(mediaItemId) {
    const mediaItem = getMediaItemById(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type === 'series') {
        return matchSeriesWithMetadataProvider(mediaItem);
    }

    if (mediaItem.type === 'movie') {
        return matchMovieWithTmdb(mediaItem);
    }

    return {
        mediaItem,
        match: null,
        updated: null,
    };
}

function containsCyrillic(value) {
    return /[\u0400-\u04FF]/u.test(String(value || ''));
}

async function matchSeriesWithMetadataProvider(mediaItem) {
    if (containsCyrillic(mediaItem.title)) {
        const kinopoiskResult =
            await matchSeriesWithKinopoisk(mediaItem);

        if (kinopoiskResult.match) {
            return kinopoiskResult;
        }

        console.log(
            `No Kinopoisk match for "${mediaItem.title}". Trying TMDB...`,
        );

        return matchSeriesWithTmdb(mediaItem);
    }

    const tmdbResult = await matchSeriesWithTmdb(mediaItem);

    if (tmdbResult.match) {
        return tmdbResult;
    }

    console.log(
        `No TMDB match for "${mediaItem.title}". Trying Kinopoisk...`,
    );

    return matchSeriesWithKinopoisk(mediaItem);
}

async function matchSeriesWithTmdb(mediaItem) {
    const searchResult = await searchTv(mediaItem.title);

    const match = selectBestTvMatch(
        searchResult.results,
        mediaItem,
    );

    if (!match) {
        return {
            mediaItem,
            provider: 'tmdb',
            match: null,
            updated: null,
        };
    }

    const previousExternalId = mediaItem.external_id
        ? String(mediaItem.external_id)
        : null;

    const previousExternalSource =
        mediaItem.external_source || null;

    const nextExternalId = String(match.id);

    if (
        previousExternalId &&
        (
            previousExternalSource !== 'tmdb' ||
            previousExternalId !== nextExternalId
        )
    ) {
        clearEpisodeMetadataForMediaItem(mediaItem.id);
    }

    await cacheTmdbImage(
        'posters',
        match.poster_path,
        'w500',
    );

    await cacheTmdbImage(
        'backdrops',
        match.backdrop_path,
        'w780',
    );

    const firstAirYear = getYearFromDate(
        match.first_air_date,
    );

    const updated = updateMediaItemMetadata(
        mediaItem.id,
        {
            title: match.name || mediaItem.title,

            sortTitle: normalizeTitle(
                match.name || mediaItem.title,
            ),

            year:
                firstAirYear ||
                mediaItem.year ||
                null,

            overview: match.overview || null,
            posterPath: match.poster_path || null,
            backdropPath: match.backdrop_path || null,
            externalSource: 'tmdb',
            externalId: match.id,

            metadata: {
                tmdb: {
                    id: match.id,
                    name: match.name,
                    originalName: match.original_name,
                    firstAirDate: match.first_air_date,
                    overview: match.overview,
                    posterPath: match.poster_path,
                    backdropPath: match.backdrop_path,
                },
            },
        },
    );

    return {
        mediaItem,
        provider: 'tmdb',
        match,
        updated,
    };
}

async function matchSeriesWithKinopoisk(mediaItem) {
    const results = await searchKinopoiskSeries(
        mediaItem.title,
    );

    const match = selectBestKinopoiskSeriesMatch(
        results,
        mediaItem,
    );

    if (!match) {
        return {
            mediaItem,
            provider: 'kinopoisk',
            match: null,
            updated: null,
        };
    }

    const previousExternalId = mediaItem.external_id
        ? String(mediaItem.external_id)
        : null;

    const previousExternalSource =
        mediaItem.external_source || null;

    const nextExternalId = String(match.id);

    if (
        previousExternalId &&
        (
            previousExternalSource !== 'kinopoisk' ||
            previousExternalId !== nextExternalId
        )
    ) {
        clearEpisodeMetadataForMediaItem(mediaItem.id);
    }

    const title =
        match.name ||
        match.alternativeName ||
        match.enName ||
        mediaItem.title;

    const remotePosterPath =
        match.poster?.url ||
        match.poster?.previewUrl ||
        null;

    const remoteBackdropPath =
        match.backdrop?.url ||
        match.backdrop?.previewUrl ||
        null;

    const posterPath = await cacheTmdbImage(
        'posters',
        remotePosterPath,
        'w500',
    );

    const backdropPath = await cacheTmdbImage(
        'backdrops',
        remoteBackdropPath,
        'w780',
    );

    const updated = updateMediaItemMetadata(
        mediaItem.id,
        {
            title,

            sortTitle: normalizeTitle(title),

            year:
                match.year ||
                mediaItem.year ||
                null,

            overview:
                match.description ||
                match.shortDescription ||
                null,

            posterPath,
            backdropPath,
            externalSource: 'kinopoisk',
            externalId: match.id,

            metadata: {
                kinopoisk: {
                    id: match.id,
                    name: match.name,
                    alternativeName:
                        match.alternativeName,
                    enName: match.enName,
                    year: match.year,
                    description: match.description,
                    shortDescription:
                        match.shortDescription,
                    type: match.type,
                    status: match.status,
                    ageRating: match.ageRating,
                    poster: match.poster || null,
                    backdrop: match.backdrop || null,
                    rating: match.rating || null,
                    votes: match.votes || null,
                    genres: match.genres || [],
                    countries: match.countries || [],
                    releaseYears:
                        match.releaseYears || [],
                },
            },
        },
    );

    return {
        mediaItem,
        provider: 'kinopoisk',
        match,
        updated,
    };
}

async function matchMovieWithTmdb(mediaItem) {
    const searchResult = await searchMovie(
        mediaItem.title,
        mediaItem.year,
    );

    const match = selectBestMovieMatch(
        searchResult.results,
        mediaItem,
    );

    if (!match) {
        return {
            mediaItem,
            provider: 'tmdb',
            match: null,
            updated: null,
        };
    }

    await cacheTmdbImage(
        'posters',
        match.poster_path,
        'w500',
    );

    await cacheTmdbImage(
        'backdrops',
        match.backdrop_path,
        'w780',
    );

    const releaseYear = getYearFromDate(
        match.release_date,
    );

    const updated = updateMediaItemMetadata(
        mediaItem.id,
        {
            title: match.title || mediaItem.title,

            sortTitle: normalizeTitle(
                match.title || mediaItem.title,
            ),

            year:
                releaseYear ||
                mediaItem.year ||
                null,

            overview: match.overview || null,
            posterPath: match.poster_path || null,
            backdropPath: match.backdrop_path || null,
            externalSource: 'tmdb',
            externalId: match.id,

            metadata: {
                tmdb: {
                    id: match.id,
                    title: match.title,
                    originalTitle: match.original_title,
                    releaseDate: match.release_date,
                    overview: match.overview,
                    posterPath: match.poster_path,
                    backdropPath: match.backdrop_path,
                },
            },
        },
    );

    return {
        mediaItem,
        provider: 'tmdb',
        match,
        updated,
    };
}

export async function refreshSeriesEpisodes(
    mediaItemId,
) {
    const mediaItem = getMediaItemById(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type !== 'series') {
        return {
            mediaItem,
            updatedEpisodes: [],
            failedEpisodes: [],
        };
    }

    if (!mediaItem.external_source) {
        return {
            mediaItem,
            updatedEpisodes: [],
            failedEpisodes: [],
            warning:
                `Media item ${mediaItemId} has no metadata provider`,
        };
    }

    if (mediaItem.external_source === 'kinopoisk') {
        const mediaFiles =
            getMediaFilesByMediaItemId(mediaItemId);

        const updatedEpisodes = [];
        const failedEpisodes = [];

        for (const mediaFile of mediaFiles) {
            if (
                !mediaFile.season_number ||
                !mediaFile.episode_number
            ) {
                continue;
            }

            try {
                const stillPath =
                    await generateEpisodeStill(
                        mediaFile.absolute_path,
                    );

                const episodeTitle =
                    mediaFile.episode_title ||
                    `Episode ${mediaFile.episode_number}`;

                updateMediaFileEpisodeMetadata(
                    mediaFile.id,
                    {
                        episodeTitle,
                        stillPath,
                    },
                );

                updatedEpisodes.push({
                    mediaFileId: mediaFile.id,
                    seasonNumber:
                        mediaFile.season_number,
                    episodeNumber:
                        mediaFile.episode_number,
                    episodeTitle,
                    stillPath,
                });
            } catch (error) {
                failedEpisodes.push({
                    mediaFileId: mediaFile.id,
                    seasonNumber:
                        mediaFile.season_number,
                    episodeNumber:
                        mediaFile.episode_number,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error),
                });

                console.warn(
                    `Failed to generate local still for media file ${mediaFile.id}:`,
                    error instanceof Error
                        ? error.message
                        : error,
                );
            }
        }

        return {
            mediaItem:
                getMediaItemById(mediaItemId),
            updatedEpisodes,
            failedEpisodes,
        };
    }

    const tmdbSeriesId = Number(
        mediaItem.external_id,
    );

    if (
        !Number.isInteger(tmdbSeriesId) ||
        tmdbSeriesId <= 0
    ) {
        return {
            mediaItem,
            updatedEpisodes: [],
            failedEpisodes: [],
            warning:
                `Invalid TMDB series id for media item ${mediaItemId}`,
        };
    }

    const mediaFiles =
        getMediaFilesByMediaItemId(mediaItemId);

    const updatedEpisodes = [];
    const failedEpisodes = [];

    for (const mediaFile of mediaFiles) {
        if (
            !mediaFile.season_number ||
            !mediaFile.episode_number
        ) {
            continue;
        }

        try {
            const details =
                await getTvEpisodeDetails(
                    tmdbSeriesId,
                    mediaFile.season_number,
                    mediaFile.episode_number,
                );

            let stillPath =
                details?.still_path || null;

            if (!stillPath) {
                try {
                    const images =
                        await getTvEpisodeImages(
                            tmdbSeriesId,
                            mediaFile.season_number,
                            mediaFile.episode_number,
                        );

                    stillPath =
                        images?.stills?.[0]
                            ?.file_path ||
                        null;
                } catch (imageError) {
                    console.warn(
                        `No TMDB episode images for media file ${mediaFile.id}:`,
                        imageError instanceof Error
                            ? imageError.message
                            : imageError,
                    );
                }
            }

            if (stillPath) {
                stillPath = await cacheTmdbImage(
                    'stills',
                    stillPath,
                    'w300',
                );
            }

            if (!stillPath) {
                stillPath = await generateEpisodeStill(
                    mediaFile.absolute_path,
                );
            }

            const episodeTitle =
                details?.name ||
                mediaFile.episode_title ||
                null;

            updateMediaFileEpisodeMetadata(
                mediaFile.id,
                {
                    episodeTitle,
                    stillPath,
                },
            );

            updatedEpisodes.push({
                mediaFileId: mediaFile.id,
                seasonNumber:
                    mediaFile.season_number,
                episodeNumber:
                    mediaFile.episode_number,
                episodeTitle,
                stillPath,
            });
        } catch (error) {
            updateMediaFileEpisodeMetadata(
                mediaFile.id,
                {
                    episodeTitle:
                        mediaFile.episode_title ||
                        null,

                    stillPath: null,
                },
            );

            failedEpisodes.push({
                mediaFileId: mediaFile.id,
                seasonNumber:
                    mediaFile.season_number,
                episodeNumber:
                    mediaFile.episode_number,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });

            console.warn(
                `Failed to refresh episode metadata for media file ${mediaFile.id}:`,
                error instanceof Error
                    ? error.message
                    : error,
            );
        }
    }

    return {
        mediaItem:
            getMediaItemById(mediaItemId),
        updatedEpisodes,
        failedEpisodes,
    };
}