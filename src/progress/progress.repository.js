import { getDatabase } from '../db/database.js';

export function getProgressByMediaFileId(mediaFileId) {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT *
            FROM playback_progress
            WHERE media_file_id = ?
            LIMIT 1
            `,
        )
        .get(mediaFileId);
}

export function saveProgress({
    mediaFileId,
    positionSeconds,
    durationSeconds,
}) {
    const db = getDatabase();

    const safePosition = Number(positionSeconds) || 0;
    const safeDuration = Number(durationSeconds) || null;

    const completed =
        safeDuration && safeDuration > 0 && safePosition / safeDuration >= 0.9
            ? 1
            : 0;

    db.prepare(
        `
        INSERT INTO playback_progress (
            media_file_id,
            position_seconds,
            duration_seconds,
            completed,
            updated_at
        )
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(media_file_id)
        DO UPDATE SET
            position_seconds = excluded.position_seconds,
            duration_seconds = excluded.duration_seconds,
            completed = excluded.completed,
            updated_at = CURRENT_TIMESTAMP
        `,
    ).run(mediaFileId, safePosition, safeDuration, completed);

    return getProgressByMediaFileId(mediaFileId);
}

export function listContinueWatching() {
    const db = getDatabase();

    return db
        .prepare(
            `
            SELECT
                pp.*,
                mf.filename,
                mf.absolute_path,
                mf.season_number,
                mf.episode_number,
                mi.id AS media_item_id,
                mi.type,
                mi.title,
                mi.year
            FROM playback_progress pp
            JOIN media_files mf ON mf.id = pp.media_file_id
            JOIN media_items mi ON mi.id = mf.media_item_id
            WHERE pp.completed = 0
              AND pp.position_seconds > 30
            ORDER BY pp.updated_at DESC
            `,
        )
        .all();
}