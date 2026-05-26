import { getDatabase } from '../db/database.js';

export function upsertMediaFromParsedFile(fileInfo) {
    const db = getDatabase();

    const transaction = db.transaction(() => {
        const mediaItem = upsertMediaItem({
            type: fileInfo.type,
            title: fileInfo.title,
            year: fileInfo.year,
        });

        const mediaFile = upsertMediaFile({
            mediaItemId: mediaItem.id,
            absolutePath: fileInfo.absolutePath,
            filename: fileInfo.filename,
            extension: fileInfo.extension,
            sizeBytes: fileInfo.sizeBytes,
            seasonNumber: fileInfo.seasonNumber,
            episodeNumber: fileInfo.episodeNumber,
            episodeTitle: fileInfo.episodeTitle,
        });

        return {
            mediaItem,
            mediaFile,
        };
    });

    return transaction();
}

export function upsertMediaItem({ type, title, year }) {
    const db = getDatabase();

    const sortTitle = normalizeSortTitle(title);

    const existing = db
        .prepare(
            `
            SELECT *
            FROM media_items
            WHERE type = ?
              AND title = ?
              AND (
                    year = ?
                    OR (year IS NULL AND ? IS NULL)
                  )
            LIMIT 1
            `,
        )
        .get(type, title, year, year);

    if (existing) {
        db.prepare(
            `
            UPDATE media_items
            SET sort_title = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
        ).run(sortTitle, existing.id);

        return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(existing.id);
    }

    const result = db
        .prepare(
            `
            INSERT INTO media_items (
                type,
                title,
                sort_title,
                year
            )
            VALUES (?, ?, ?, ?)
            `,
        )
        .run(type, title, sortTitle, year);

    return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(result.lastInsertRowid);
}

export function upsertMediaFile({
    mediaItemId,
    absolutePath,
    filename,
    extension,
    sizeBytes,
    seasonNumber,
    episodeNumber,
    episodeTitle,
}) {
    const db = getDatabase();

    const existing = db
        .prepare(
            `
            SELECT *
            FROM media_files
            WHERE absolute_path = ?
            LIMIT 1
            `,
        )
        .get(absolutePath);

    if (existing) {
        db.prepare(
            `
            UPDATE media_files
            SET media_item_id = ?,
                filename = ?,
                extension = ?,
                size_bytes = ?,
                season_number = ?,
                episode_number = ?,
                episode_title = ?,
                last_seen_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
        ).run(
            mediaItemId,
            filename,
            extension,
            sizeBytes,
            seasonNumber,
            episodeNumber,
            episodeTitle,
            existing.id,
        );

        return db.prepare(`SELECT * FROM media_files WHERE id = ?`).get(existing.id);
    }

    const result = db
        .prepare(
            `
            INSERT INTO media_files (
                media_item_id,
                absolute_path,
                filename,
                extension,
                size_bytes,
                season_number,
                episode_number,
                episode_title
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
        .run(
            mediaItemId,
            absolutePath,
            filename,
            extension,
            sizeBytes,
            seasonNumber,
            episodeNumber,
            episodeTitle,
        );

    return db.prepare(`SELECT * FROM media_files WHERE id = ?`).get(result.lastInsertRowid);
}

export function listMediaItemsForHome() {
    const db = getDatabase();

    const movies = db
        .prepare(
            `
            SELECT *
            FROM media_items
            WHERE type = 'movie'
            ORDER BY sort_title ASC
            `,
        )
        .all();

    const series = db
        .prepare(
            `
            SELECT *
            FROM media_items
            WHERE type = 'series'
            ORDER BY sort_title ASC
            `,
        )
        .all();

    return {
        movies,
        series,
    };
}

function normalizeSortTitle(title) {
    return title
        .toLowerCase()
        .replace(/^the\s+/, '')
        .replace(/^a\s+/, '')
        .replace(/^an\s+/, '')
        .trim();
}

export function getMediaFileById(mediaFileId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT
                mf.*,
                mi.type,
                mi.title,
                mi.year
            FROM media_files mf
            JOIN media_items mi ON mi.id = mf.media_item_id
            WHERE mf.id = ?
            LIMIT 1
            `,
        )
        .get(mediaFileId);
}


export function getCatalog() {
    const db = getDatabase();

    const movieRows = db
        .prepare(
            `
            SELECT
                mi.id,
                mi.type,
                mi.title,
                mi.year,
                mi.poster_path AS posterPath,
                mi.backdrop_path AS backdropPath,
                mf.id AS mediaFileId,
                mf.filename,
                mf.absolute_path AS absolutePath
            FROM media_items mi
            JOIN media_files mf ON mf.media_item_id = mi.id
            WHERE mi.type = 'movie'
            ORDER BY mi.sort_title ASC
            `,
        )
        .all();

    const seriesRows = db
        .prepare(
            `
        SELECT
            mi.id AS seriesId,
            mi.type,
            mi.title,
            mi.year,
            mi.poster_path AS posterPath,
            mi.backdrop_path AS backdropPath,

            mf.id AS mediaFileId,
            mf.filename,
            mf.absolute_path AS absolutePath,
            mf.season_number AS seasonNumber,
            mf.episode_number AS episodeNumber,
            mf.episode_title AS episodeTitle,

            pp.position_seconds AS positionSeconds,
            pp.duration_seconds AS durationSeconds,
            pp.completed AS completed
        FROM media_items mi
        JOIN media_files mf ON mf.media_item_id = mi.id
        LEFT JOIN playback_progress pp ON pp.media_file_id = mf.id
        WHERE mi.type = 'series'
        ORDER BY
            mi.sort_title ASC,
            mf.season_number ASC,
            mf.episode_number ASC
        `,
        )
        .all();

    const movies = movieRows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        year: row.year,
        posterPath: row.posterPath,
        backdropPath: row.backdropPath,
        file: {
            id: row.mediaFileId,
            filename: row.filename,
            absolutePath: row.absolutePath,
            streamUrl: `/stream/direct/${row.mediaFileId}`,
        },
    }));

    const seriesMap = new Map();

    for (const row of seriesRows) {
        if (!seriesMap.has(row.seriesId)) {
            seriesMap.set(row.seriesId, {
                id: row.seriesId,
                type: row.type,
                title: row.title,
                year: row.year,
                posterPath: row.posterPath,
                backdropPath: row.backdropPath,
                episodeCount: 0,
                seasons: [],
            });
        }

        const series = seriesMap.get(row.seriesId);

        let season = series.seasons.find(
            (item) => item.seasonNumber === row.seasonNumber,
        );

        if (!season) {
            season = {
                seasonNumber: row.seasonNumber,
                episodeCount: 0,
                episodes: [],
            };

            series.seasons.push(season);
        }

        season.episodes.push({
            id: row.mediaFileId,
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
            title: row.episodeTitle,
            filename: row.filename,
            absolutePath: row.absolutePath,
            streamUrl: `/stream/direct/${row.mediaFileId}`,
            positionSeconds: row.positionSeconds || 0,
            durationSeconds: row.durationSeconds || null,
            completed: row.completed || 0,
        });
        season.episodeCount += 1;
        series.episodeCount += 1;
    }

    return {
        movies,
        series: Array.from(seriesMap.values()),
    };
}

export function getPlayTarget(mediaItemId) {
    const db = getDatabase();

    const mediaItem = db
        .prepare(
            `
            SELECT *
            FROM media_items
            WHERE id = ?
            LIMIT 1
            `,
        )
        .get(mediaItemId);

    if (!mediaItem) {
        return null;
    }

    if (mediaItem.type === 'movie') {
        const file = db
            .prepare(
                `
                SELECT
                    mf.*,
                    pp.position_seconds,
                    pp.duration_seconds,
                    pp.completed
                FROM media_files mf
                LEFT JOIN playback_progress pp ON pp.media_file_id = mf.id
                WHERE mf.media_item_id = ?
                ORDER BY mf.id ASC
                LIMIT 1
                `,
            )
            .get(mediaItemId);

        if (!file) return null;

        return toPlayTarget(mediaItem, file);
    }

    if (mediaItem.type === 'series') {
        // 1. Continue the most recently watched unfinished episode.
        const inProgressEpisode = db
            .prepare(
                `
                SELECT
                    mf.*,
                    pp.position_seconds,
                    pp.duration_seconds,
                    pp.completed,
                    pp.updated_at AS progress_updated_at
                FROM media_files mf
                JOIN playback_progress pp ON pp.media_file_id = mf.id
                WHERE mf.media_item_id = ?
                  AND pp.completed = 0
                  AND pp.position_seconds > 30
                ORDER BY pp.updated_at DESC
                LIMIT 1
                `,
            )
            .get(mediaItemId);

        if (inProgressEpisode) {
            return toPlayTarget(mediaItem, inProgressEpisode);
        }

        // 2. Otherwise play first not-completed episode.
        const firstUnwatchedEpisode = db
            .prepare(
                `
                SELECT
                    mf.*,
                    pp.position_seconds,
                    pp.duration_seconds,
                    pp.completed
                FROM media_files mf
                LEFT JOIN playback_progress pp ON pp.media_file_id = mf.id
                WHERE mf.media_item_id = ?
                  AND COALESCE(pp.completed, 0) = 0
                ORDER BY
                    mf.season_number ASC,
                    mf.episode_number ASC,
                    mf.id ASC
                LIMIT 1
                `,
            )
            .get(mediaItemId);

        if (firstUnwatchedEpisode) {
            return toPlayTarget(mediaItem, firstUnwatchedEpisode);
        }

        // 3. If everything is completed, start from first episode.
        const firstEpisode = db
            .prepare(
                `
                SELECT
                    mf.*,
                    pp.position_seconds,
                    pp.duration_seconds,
                    pp.completed
                FROM media_files mf
                LEFT JOIN playback_progress pp ON pp.media_file_id = mf.id
                WHERE mf.media_item_id = ?
                ORDER BY
                    mf.season_number ASC,
                    mf.episode_number ASC,
                    mf.id ASC
                LIMIT 1
                `,
            )
            .get(mediaItemId);

        if (!firstEpisode) return null;

        return {
            ...toPlayTarget(mediaItem, firstEpisode),
            positionSeconds: 0,
            completed: 0,
        };
    }

    return null;
}

export function getFilePlayTarget(mediaFileId) {
    const db = getDatabase();

    const row = db
        .prepare(
            `
            SELECT
                mf.*,
                mi.id AS media_item_id,
                mi.type,
                mi.title,
                mi.year,
                pp.position_seconds,
                pp.duration_seconds,
                pp.completed
            FROM media_files mf
            JOIN media_items mi ON mi.id = mf.media_item_id
            LEFT JOIN playback_progress pp ON pp.media_file_id = mf.id
            WHERE mf.id = ?
            LIMIT 1
            `,
        )
        .get(mediaFileId);

    if (!row) {
        return null;
    }

    const mediaItem = {
        id: row.media_item_id,
        type: row.type,
        title: row.title,
        year: row.year,
    };

    return toPlayTarget(mediaItem, row);
}

function toPlayTarget(mediaItem, file) {
    return {
        mediaItemId: mediaItem.id,
        mediaFileId: file.id,
        type: mediaItem.type,
        title: mediaItem.title,
        year: mediaItem.year,

        filename: file.filename,
        seasonNumber: file.season_number,
        episodeNumber: file.episode_number,
        episodeTitle: file.episode_title,

        positionSeconds: file.position_seconds || 0,
        durationSeconds: file.duration_seconds || null,
        completed: file.completed || 0,

        streamUrl: `/stream/direct/${file.id}`,
    };
}