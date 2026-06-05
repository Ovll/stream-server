import { getDatabase } from '../db/database.js';
import { getCachedImagePublicPath } from '../images/imageCache.service.js';

export function upsertMediaFromParsedFile(fileInfo) {
    const db = getDatabase();

    const transaction = db.transaction(() => {
        const existingFile = db
            .prepare(
                `
                SELECT *
                FROM media_files
                WHERE absolute_path = ?
                LIMIT 1
                `,
            )
            .get(fileInfo.absolutePath);

        if (existingFile) {
            const mediaItem = db
                .prepare(
                    `
                    SELECT *
                    FROM media_items
                    WHERE id = ?
                    LIMIT 1
                    `,
                )
                .get(existingFile.media_item_id);

            const mediaFile = upsertMediaFile({
                mediaItemId: existingFile.media_item_id,
                absolutePath: fileInfo.absolutePath,
                filename: fileInfo.filename,
                extension: fileInfo.extension,
                sizeBytes: fileInfo.sizeBytes,
                seasonNumber: fileInfo.seasonNumber,
                episodeNumber: fileInfo.episodeNumber,
                episodeTitle: existingFile.episode_title || fileInfo.episodeTitle,
            });

            return {
                mediaItem,
                mediaFile,
            };
        }

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
    const normalizedYear = Number.isInteger(year) ? year : null;

    const exactExisting = db
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
            ORDER BY
                external_source IS NOT NULL DESC,
                external_id IS NOT NULL DESC,
                year IS NOT NULL DESC,
                id ASC
            LIMIT 1
            `,
        )
        .get(type, title, normalizedYear, normalizedYear);

    if (exactExisting) {
        updateMediaItemTouch(db, exactExisting.id, sortTitle);
        return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(exactExisting.id);
    }

    // Important fix:
    // TV filenames often do not include the show year:
    // Tulsa.King.S02E02... => title "Tulsa King", year NULL
    //
    // If the show already exists as a matched TMDB series:
    // Tulsa King / 2022 / tmdb 153312
    //
    // then all new episodes should attach to that existing row.
    if (type === 'series' && normalizedYear === null) {
        const existingSeriesByTitle = db
            .prepare(
                `
                SELECT *
                FROM media_items
                WHERE type = 'series'
                  AND title = ?
                ORDER BY
                    external_source IS NOT NULL DESC,
                    external_id IS NOT NULL DESC,
                    poster_path IS NOT NULL DESC,
                    year IS NOT NULL DESC,
                    id ASC
                LIMIT 1
                `,
            )
            .get(title);

        if (existingSeriesByTitle) {
            updateMediaItemTouch(db, existingSeriesByTitle.id, sortTitle);
            return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(existingSeriesByTitle.id);
        }
    }

    // Also handle the opposite case:
    // first file created series with NULL year, later filename includes year.
    // Reuse the existing NULL-year row instead of creating a duplicate.
    if (type === 'series' && normalizedYear !== null) {
        const existingSeriesWithoutYear = db
            .prepare(
                `
                SELECT *
                FROM media_items
                WHERE type = 'series'
                  AND title = ?
                  AND year IS NULL
                ORDER BY
                    external_source IS NOT NULL DESC,
                    external_id IS NOT NULL DESC,
                    poster_path IS NOT NULL DESC,
                    id ASC
                LIMIT 1
                `,
            )
            .get(title);

        if (existingSeriesWithoutYear) {
            db.prepare(
                `
                UPDATE media_items
                SET
                    sort_title = ?,
                    year = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
            ).run(sortTitle, normalizedYear, existingSeriesWithoutYear.id);

            return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(existingSeriesWithoutYear.id);
        }
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
        .run(type, title, sortTitle, normalizedYear);

    return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(result.lastInsertRowid);
}

function updateMediaItemTouch(db, mediaItemId, sortTitle) {
    db.prepare(
        `
        UPDATE media_items
        SET
            sort_title = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
    ).run(sortTitle, mediaItemId);
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
    return String(title || '')
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
            mf.still_path AS stillPath,

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
        posterUrl: buildCachedImageUrl('posters', row.posterPath, 'w500'),
        backdropUrl: buildCachedImageUrl('backdrops', row.backdropPath, 'w780'),
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
                posterUrl: buildCachedImageUrl('posters', row.posterPath, 'w500'),
                backdropUrl: buildCachedImageUrl('backdrops', row.backdropPath, 'w780'),
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
            stillPath: row.stillPath,
            stillUrl: buildCachedImageUrl('stills', row.stillPath, 'w300'),
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

export function updateMediaItemMetadata(mediaItemId, metadata) {
    const db = getDatabase();

    db.prepare(
        `
        UPDATE media_items
        SET title = ?,
            sort_title = ?,
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
        metadata.title,
        normalizeSortTitle(metadata.title),
        metadata.overview || null,
        metadata.posterPath || null,
        metadata.backdropPath || null,
        metadata.externalSource,
        String(metadata.externalId),
        JSON.stringify(metadata.metadata || {}),
        mediaItemId,
    );

    return db.prepare(`SELECT * FROM media_items WHERE id = ?`).get(mediaItemId);
}

export function updateMediaFileEpisodeMetadata(mediaFileId, metadata) {
    const db = getDatabase();

    db.prepare(
        `
        UPDATE media_files
        SET episode_title = ?,
            still_path = ?
        WHERE id = ?
        `,
    ).run(
        metadata.episodeTitle || null,
        metadata.stillPath || null,
        mediaFileId,
    );

    return db.prepare(`SELECT * FROM media_files WHERE id = ?`).get(mediaFileId);
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

function buildCachedImageUrl(kind, filePath, size = 'w500') {
    return getCachedImagePublicPath(kind, filePath, size);
}