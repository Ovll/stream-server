import { getDatabase } from '../db/database.js';
import { cacheTmdbImage } from '../images/imageCache.service.js';
import {
    getTvEpisodeDetails,
    getTvEpisodeImages,
    searchMovie,
    searchTv,
} from './tmdb.client.js';

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

function updateMediaItemFromTmdb(mediaItemId, data) {
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
        .replace(/[^a-z0-9]+/g, ' ')
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

    const preferredYear = mediaItem.year ? Number(mediaItem.year) : null;

    const scored = results.map((item, index) => {
        const firstAirYear = getYearFromDate(item.first_air_date);

        const titleScore = Math.max(
            scoreTitleMatch(item.name, mediaItem.title),
            scoreTitleMatch(item.original_name, mediaItem.title),
        );

        const yearScore =
            preferredYear && firstAirYear === preferredYear
                ? 100
                : preferredYear && firstAirYear && Math.abs(firstAirYear - preferredYear) <= 1
                    ? 30
                    : 0;

        const posterScore = item.poster_path ? 10 : 0;
        const backdropScore = item.backdrop_path ? 5 : 0;

        return {
            item,
            index,
            score: titleScore + yearScore + posterScore + backdropScore,
        };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return a.index - b.index;
    });

    return scored[0]?.item || null;
}

function selectBestMovieMatch(results, mediaItem) {
    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    const preferredYear = mediaItem.year ? Number(mediaItem.year) : null;

    const scored = results.map((item, index) => {
        const releaseYear = getYearFromDate(item.release_date);

        const titleScore = Math.max(
            scoreTitleMatch(item.title, mediaItem.title),
            scoreTitleMatch(item.original_title, mediaItem.title),
        );

        const yearScore =
            preferredYear && releaseYear === preferredYear
                ? 100
                : preferredYear && releaseYear && Math.abs(releaseYear - preferredYear) <= 1
                    ? 30
                    : 0;

        const posterScore = item.poster_path ? 10 : 0;
        const backdropScore = item.backdrop_path ? 5 : 0;

        return {
            item,
            index,
            score: titleScore + yearScore + posterScore + backdropScore,
        };
    });

    scored.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }

        return a.index - b.index;
    });

    return scored[0]?.item || null;
}

export async function matchMediaItemWithTmdb(mediaItemId) {
    const mediaItem = getMediaItemById(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type === 'series') {
        return matchSeriesWithTmdb(mediaItem);
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

async function matchSeriesWithTmdb(mediaItem) {
    const searchResult = await searchTv(mediaItem.title);
    const match = selectBestTvMatch(searchResult.results, mediaItem);

    if (!match) {
        return {
            mediaItem,
            match: null,
            updated: null,
        };
    }

    const previousExternalId = mediaItem.external_id ? String(mediaItem.external_id) : null;
    const nextExternalId = String(match.id);

    if (previousExternalId && previousExternalId !== nextExternalId) {
        clearEpisodeMetadataForMediaItem(mediaItem.id);
    }

    await cacheTmdbImage('posters', match.poster_path, 'w500');
    await cacheTmdbImage('backdrops', match.backdrop_path, 'w780');

    const firstAirYear = getYearFromDate(match.first_air_date);

    const updated = updateMediaItemFromTmdb(mediaItem.id, {
        title: match.name || mediaItem.title,
        sortTitle: normalizeTitle(match.name || mediaItem.title),
        year: firstAirYear || mediaItem.year || null,
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
    });

    return {
        mediaItem,
        match,
        updated,
    };
}

async function matchMovieWithTmdb(mediaItem) {
    const searchResult = await searchMovie(mediaItem.title, mediaItem.year);
    const match = selectBestMovieMatch(searchResult.results, mediaItem);

    if (!match) {
        return {
            mediaItem,
            match: null,
            updated: null,
        };
    }

    await cacheTmdbImage('posters', match.poster_path, 'w500');
    await cacheTmdbImage('backdrops', match.backdrop_path, 'w780');

    const releaseYear = getYearFromDate(match.release_date);

    const updated = updateMediaItemFromTmdb(mediaItem.id, {
        title: match.title || mediaItem.title,
        sortTitle: normalizeTitle(match.title || mediaItem.title),
        year: releaseYear || mediaItem.year || null,
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
    });

    return {
        mediaItem,
        match,
        updated,
    };
}

export async function refreshSeriesEpisodesFromTmdb(mediaItemId) {
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

    if (mediaItem.external_source !== 'tmdb' || !mediaItem.external_id) {
        return {
            mediaItem,
            updatedEpisodes: [],
            failedEpisodes: [],
            warning: `Media item ${mediaItemId} is not matched with TMDB`,
        };
    }

    const tmdbSeriesId = Number(mediaItem.external_id);

    if (!Number.isInteger(tmdbSeriesId) || tmdbSeriesId <= 0) {
        return {
            mediaItem,
            updatedEpisodes: [],
            failedEpisodes: [],
            warning: `Invalid TMDB series id for media item ${mediaItemId}`,
        };
    }

    const mediaFiles = getMediaFilesByMediaItemId(mediaItemId);
    const updatedEpisodes = [];
    const failedEpisodes = [];

    for (const mediaFile of mediaFiles) {
        if (!mediaFile.season_number || !mediaFile.episode_number) {
            continue;
        }

        try {
            const details = await getTvEpisodeDetails(
                tmdbSeriesId,
                mediaFile.season_number,
                mediaFile.episode_number,
            );

            let stillPath = details?.still_path || null;

            if (!stillPath) {
                try {
                    const images = await getTvEpisodeImages(
                        tmdbSeriesId,
                        mediaFile.season_number,
                        mediaFile.episode_number,
                    );

                    stillPath = images?.stills?.[0]?.file_path || null;
                } catch (imageErr) {
                    console.warn(
                        `No TMDB episode images for media file ${mediaFile.id}:`,
                        imageErr instanceof Error ? imageErr.message : imageErr,
                    );
                }
            }

            await cacheTmdbImage('stills', stillPath, 'w300');

            const episodeTitle = details?.name || mediaFile.episode_title || null;

            updateMediaFileEpisodeMetadata(mediaFile.id, {
                episodeTitle,
                stillPath,
            });

            updatedEpisodes.push({
                mediaFileId: mediaFile.id,
                seasonNumber: mediaFile.season_number,
                episodeNumber: mediaFile.episode_number,
                episodeTitle,
                stillPath,
            });
        } catch (err) {
            updateMediaFileEpisodeMetadata(mediaFile.id, {
                episodeTitle: mediaFile.episode_title || null,
                stillPath: null,
            });

            failedEpisodes.push({
                mediaFileId: mediaFile.id,
                seasonNumber: mediaFile.season_number,
                episodeNumber: mediaFile.episode_number,
                error: err instanceof Error ? err.message : String(err),
            });

            console.warn(
                `Failed to refresh episode metadata for media file ${mediaFile.id}:`,
                err instanceof Error ? err.message : err,
            );
        }
    }

    return {
        mediaItem: getMediaItemById(mediaItemId),
        updatedEpisodes,
        failedEpisodes,
    };
}