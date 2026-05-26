const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

function getTmdbApiKey() {
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
        throw new Error('Missing TMDB_API_KEY in .env');
    }

    return apiKey;
}

async function tmdbFetch(path, params = {}) {
    const apiKey = getTmdbApiKey();

    const url = new URL(`${TMDB_API_BASE_URL}${path}`);

    url.searchParams.set('api_key', apiKey);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    }

    const response = await fetch(url);

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`TMDB request failed ${response.status}: ${body}`);
    }

    return response.json();
}

export async function searchMovie(query, year = null) {
    return tmdbFetch('/search/movie', {
        query,
        year,
        include_adult: false,
    });
}

export async function searchTv(query) {
    return tmdbFetch('/search/tv', {
        query,
        include_adult: false,
    });
}

export async function getTvDetails(tmdbSeriesId) {
    return tmdbFetch(`/tv/${tmdbSeriesId}`);
}

export async function getTvEpisodeDetails(tmdbSeriesId, seasonNumber, episodeNumber) {
    return tmdbFetch(`/tv/${tmdbSeriesId}/season/${seasonNumber}/episode/${episodeNumber}`);
}

export async function getTvEpisodeImages(tmdbSeriesId, seasonNumber, episodeNumber) {
    return tmdbFetch(`/tv/${tmdbSeriesId}/season/${seasonNumber}/episode/${episodeNumber}/images`);
}

export function buildTmdbImageUrl(filePath, size = 'w500') {
    if (!filePath) return null;

    return `${TMDB_IMAGE_BASE_URL}/${size}${filePath}`;
}