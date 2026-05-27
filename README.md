# Stream Server Setup

## Requirements

- Node.js
- webOS TV CLI installed and configured
- LG TV added as an `ares` device
- TMDB API key

## Server

Create `.env` in the project root:

```env
PORT=4000
MEDIA_DIR=/absolute/path/to/media-folder
TMDB_API_KEY=your_tmdb_api_key
```

SQLite is used automatically:

```txt
data/stream-server.db
```

Install and start:

```bash
npm install
npm start
```

The server scans `MEDIA_DIR`, watches for file changes, stores metadata in SQLite, and serves the media API.

## UI App

```bash
cd ui
npm install
npm run deploy:lg
```

`deploy:lg` builds, packages, installs, and launches the LG app.

Useful UI commands:

```bash
npm run logs:lg
npm run inspect:lg
npm run clean
```
