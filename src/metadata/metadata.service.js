import { getDatabase } from '../db/database.js';
import { cacheTmdbImage } from '../images/imageCache.service.js';
import {
    updateMediaFileEpisodeMetadata,
    updateMediaItemMetadata,
} from '../media/media.repository.js';
import {
    getTvEpisodeDetails,
    searchMovie,
    searchTv,
} from './tmdb.client.js';

function getMediaItemById(mediaItemId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT *
            FROM media_items
            WHERE id = ?
            LIMIT 1
            `,
        )
        .get(mediaItemId);
}

function listEpisodeFilesForMediaItem(mediaItemId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT *
            FROM media_files
            WHERE media_item_id = ?
              AND season_number IS NOT NULL
              AND episode_number IS NOT NULL
            ORDER BY season_number ASC, episode_number ASC
            `,
        )
        .all(mediaItemId);
}

export async function matchMediaItemWithTmdb(mediaItemId) {
    const mediaItem = getMediaItemById(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type === 'movie') {
        return matchMovie(mediaItem);
    }

    if (mediaItem.type === 'series') {
        return matchSeries(mediaItem);
    }

    throw new Error(`Unsupported media item type: ${mediaItem.type}`);
}

export async function refreshSeriesEpisodesFromTmdb(mediaItemId) {
    const mediaItem = getMediaItemById(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type !== 'series') {
        throw new Error('Media item is not a series');
    }

    if (mediaItem.external_source !== 'tmdb' || !mediaItem.external_id) {
        throw new Error('Series is not matched with TMDB');
    }

    const episodeFiles = listEpisodeFilesForMediaItem(mediaItem.id);
    const updatedEpisodes = [];

    for (const file of episodeFiles) {
        try {
            const details = await getTvEpisodeDetails(
                mediaItem.external_id,
                file.season_number,
                file.episode_number,
            );

            await cacheTmdbImage('stills', details.still_path, 'w300');

            const updated = updateMediaFileEpisodeMetadata(file.id, {
                episodeTitle: details.name || null,
                stillPath: details.still_path || null,
            });

            updatedEpisodes.push({
                mediaFileId: file.id,
                seasonNumber: file.season_number,
                episodeNumber: file.episode_number,
                episodeTitle: updated.episode_title,
                stillPath: updated.still_path,
            });
        } catch (err) {
            console.error(
                `Failed to refresh TMDB episode S${file.season_number}E${file.episode_number}:`,
                err,
            );

            updatedEpisodes.push({
                mediaFileId: file.id,
                seasonNumber: file.season_number,
                episodeNumber: file.episode_number,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return {
        mediaItem,
        updatedEpisodes,
    };
}

async function matchMovie(mediaItem) {
    const result = await searchMovie(mediaItem.title, mediaItem.year);
    const match = result.results?.[0];

    if (!match) {
        return {
            mediaItem,
            match: null,
            updated: null,
        };
    }

    await cacheTmdbImage('posters', match.poster_path, 'w500');
    await cacheTmdbImage('backdrops', match.backdrop_path, 'w780');

    const updated = updateMediaItemMetadata(mediaItem.id, {
        title: match.title || mediaItem.title,
        overview: match.overview || null,
        posterPath: match.poster_path || null,
        backdropPath: match.backdrop_path || null,
        externalSource: 'tmdb',
        externalId: match.id,
        metadata: {
            originalTitle: match.original_title || null,
            releaseDate: match.release_date || null,
            voteAverage: match.vote_average || null,
            voteCount: match.vote_count || null,
        },
    });

    return {
        mediaItem,
        match,
        updated,
    };
}

async function matchSeries(mediaItem) {
    const result = await searchTv(mediaItem.title);
    const match = result.results?.[0];

    if (!match) {
        return {
            mediaItem,
            match: null,
            updated: null,
        };
    }

    await cacheTmdbImage('posters', match.poster_path, 'w500');
    await cacheTmdbImage('backdrops', match.backdrop_path, 'w780');

    const updated = updateMediaItemMetadata(mediaItem.id, {
        title: match.name || mediaItem.title,
        overview: match.overview || null,
        posterPath: match.poster_path || null,
        backdropPath: match.backdrop_path || null,
        externalSource: 'tmdb',
        externalId: match.id,
        metadata: {
            originalName: match.original_name || null,
            firstAirDate: match.first_air_date || null,
            voteAverage: match.vote_average || null,
            voteCount: match.vote_count || null,
        },
    });

    return {
        mediaItem,
        match,
        updated,
    };
}