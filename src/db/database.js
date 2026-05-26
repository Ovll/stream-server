import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

let db = null;

export function openDatabase(options = {}) {
    if (db) return db;

    const dbPath =
        options.dbPath ||
        path.join(process.cwd(), 'data', 'stream-server.db');

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initializeSchema(db);
    runMigrations(db);
    seedDefaultPreferences(db);

    return db;
}

function runMigrations(database) {
    ensureColumn(database, 'media_files', 'still_path', 'TEXT');
}

function initializeSchema(database) {
    database.exec(`
        CREATE TABLE IF NOT EXISTS media_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- movie | series
            type TEXT NOT NULL CHECK (type IN ('movie', 'series')),

            title TEXT NOT NULL,
            sort_title TEXT,
            year INTEGER,

            overview TEXT,
            poster_path TEXT,
            backdrop_path TEXT,

            -- later: tmdb/imdb/etc
            external_source TEXT,
            external_id TEXT,

            -- flexible metadata JSON: genres, actors, director, rating, etc.
            metadata_json TEXT,

            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(type, title, year)
        );

        CREATE TABLE IF NOT EXISTS media_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            media_item_id INTEGER NOT NULL,

            absolute_path TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            extension TEXT,
            size_bytes INTEGER,

            -- for series episodes; NULL for movies
            season_number INTEGER,
            episode_number INTEGER,
            episode_title TEXT,

            duration_seconds REAL,
            resolution TEXT,
            codec TEXT,

            discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (media_item_id)
                REFERENCES media_items(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS playback_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            media_file_id INTEGER NOT NULL UNIQUE,

            position_seconds REAL NOT NULL DEFAULT 0,
            duration_seconds REAL,
            completed INTEGER NOT NULL DEFAULT 0,

            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (media_file_id)
                REFERENCES media_files(id)
                ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS app_preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            value_type TEXT NOT NULL DEFAULT 'string',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_media_items_type
            ON media_items(type);

        CREATE INDEX IF NOT EXISTS idx_media_files_media_item_id
            ON media_files(media_item_id);

        CREATE INDEX IF NOT EXISTS idx_media_files_episode
            ON media_files(media_item_id, season_number, episode_number);
    `);
}

function seedDefaultPreferences(database) {
    const defaults = [
        ['language', 'en', 'string'],
        ['theme', 'dark', 'string'],
        ['accentColor', '#3b82f6', 'string'],
        ['textColor', '#ffffff', 'string'],

        ['subtitleLanguage', 'he', 'string'],
        ['audioLanguage', 'en', 'string'],
        ['subtitleMode', 'auto', 'string'],
        ['subtitleSize', 'normal', 'string'],
        ['subtitleColor', '#ffffff', 'string'],
    ];

    const insert = database.prepare(`
        INSERT OR IGNORE INTO app_preferences (
            key,
            value,
            value_type
        )
        VALUES (?, ?, ?)
    `);

    const transaction = database.transaction(() => {
        for (const row of defaults) {
            insert.run(row[0], row[1], row[2]);
        }
    });

    transaction();
}

export function getDatabase() {
    if (!db) {
        return openDatabase();
    }

    return db;
}

function ensureColumn(database, tableName, columnName, columnDefinition) {
    const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some((column) => column.name === columnName);

    if (!exists) {
        database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
}