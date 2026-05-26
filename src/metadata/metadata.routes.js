import express from 'express';

import {
    buildTmdbImageUrl,
    searchMovie,
    searchTv,
} from './tmdb.client.js';

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

    return router;
}