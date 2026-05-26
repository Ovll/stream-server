import express from 'express';

import {
    buildTmdbImageUrl,
    searchMovie,
    searchTv,
} from './tmdb.client.js';
import {
    matchMediaItemWithTmdb,
    refreshSeriesEpisodesFromTmdb,
} from './metadata.service.js';

export function createMetadataRouter() {
    const router = express.Router();

    router.get('/tmdb/search-tv', async (req, res) => {
        try {
            const query = String(req.query.query || '').trim();

            if (!query) {
                return res.status(400).json({ error: 'Missing query' });
            }

            const result = await searchTv(query);

            res.json({
                query,
                results: result.results.map((item) => ({
                    tmdbId: item.id,
                    name: item.name,
                    originalName: item.original_name,
                    firstAirDate: item.first_air_date,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    backdropPath: item.backdrop_path,
                    posterUrl: buildTmdbImageUrl(item.poster_path, 'w500'),
                    backdropUrl: buildTmdbImageUrl(item.backdrop_path, 'w780'),
                })),
            });
        } catch (err) {
            console.error('TMDB TV search failed:', err);
            res.status(500).json({ error: 'TMDB TV search failed' });
        }
    });

    router.get('/tmdb/search-movie', async (req, res) => {
        try {
            const query = String(req.query.query || '').trim();
            const year = req.query.year ? Number(req.query.year) : null;

            if (!query) {
                return res.status(400).json({ error: 'Missing query' });
            }

            const result = await searchMovie(query, year);

            res.json({
                query,
                year,
                results: result.results.map((item) => ({
                    tmdbId: item.id,
                    title: item.title,
                    originalTitle: item.original_title,
                    releaseDate: item.release_date,
                    overview: item.overview,
                    posterPath: item.poster_path,
                    backdropPath: item.backdrop_path,
                    posterUrl: buildTmdbImageUrl(item.poster_path, 'w500'),
                    backdropUrl: buildTmdbImageUrl(item.backdrop_path, 'w780'),
                })),
            });
        } catch (err) {
            console.error('TMDB movie search failed:', err);
            res.status(500).json({ error: 'TMDB movie search failed' });
        }
    });

    router.post('/tmdb/match/:mediaItemId', async (req, res) => {
        try {
            const mediaItemId = Number(req.params.mediaItemId);

            if (!Number.isInteger(mediaItemId) || mediaItemId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaItemId' });
            }

            const result = await matchMediaItemWithTmdb(mediaItemId);

            if (!result) {
                return res.status(404).json({ error: 'Media item not found' });
            }

            res.json(result);
        } catch (err) {
            console.error('TMDB match failed:', err);
            res.status(500).json({ error: 'TMDB match failed' });
        }
    });

    router.post('/tmdb/refresh-episodes/:mediaItemId', async (req, res) => {
        try {
            const mediaItemId = Number(req.params.mediaItemId);

            if (!Number.isInteger(mediaItemId) || mediaItemId <= 0) {
                return res.status(400).json({ error: 'Invalid mediaItemId' });
            }

            const result = await refreshSeriesEpisodesFromTmdb(mediaItemId);

            if (!result) {
                return res.status(404).json({ error: 'Media item not found' });
            }

            res.json(result);
        } catch (err) {
            console.error('TMDB episode refresh failed:', err);
            res.status(500).json({ error: 'TMDB episode refresh failed' });
        }
    });

    return router;
}