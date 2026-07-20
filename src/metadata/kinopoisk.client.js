const KINOPOISK_API_BASE_URL = 'https://api.kinopoisk.dev/v1.4';

function getKinopoiskApiKey() {
    const apiKey = process.env.KINOPOISK_API_KEY;

    if (!apiKey) {
        throw new Error('KINOPOISK_API_KEY is missing');
    }

    return apiKey;
}

async function kinopoiskFetch(path, params = {}) {
    const url = new URL(`${KINOPOISK_API_BASE_URL}${path} `);

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') {
            continue;
        }

        url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'X-API-KEY': getKinopoiskApiKey(),
        },
    });

    if (!response.ok) {
        const responseBody = await response.text();

        throw new Error(
            `Kinopoisk API request failed: ${response.status} ${response.statusText}. ${responseBody} `,
        );
    }

    return response.json();
}

export async function searchKinopoiskSeries(query) {
    if (!query || !query.trim()) {
        throw new Error('Kinopoisk search query is required');
    }

    const result = await kinopoiskFetch('/movie/search', {
        query: query.trim(),
        page: 1,
        limit: 10,
    });

    const documents = Array.isArray(result.docs) ? result.docs : [];

    return documents.filter((item) => {
        return (
            item.type === 'tv-series' ||
            item.type === 'animated-series' ||
            item.type === 'anime'
        );
    });
}

export async function getKinopoiskSeriesById(kinopoiskId) {
    if (!kinopoiskId) {
        throw new Error('Kinopoisk ID is required');
    }

    return kinopoiskFetch(`/ movie / ${kinopoiskId} `);
}

export async function getKinopoiskSeasons(kinopoiskId) {
    if (!kinopoiskId) {
        throw new Error('Kinopoisk ID is required');
    }

    const result = await kinopoiskFetch('/season', {
        movieId: kinopoiskId,
        page: 1,
        limit: 250,
    });

    return Array.isArray(result.docs) ? result.docs : [];
}

export function mapKinopoiskSeriesToMetadata(series) {
    if (!series) {
        return null;
    }

    return {
        externalSource: 'kinopoisk',
        externalId: String(series.id),

        title:
            series.name ||
            series.alternativeName ||
            series.enName ||
            'Unknown title',

        originalTitle:
            series.alternativeName ||
            series.enName ||
            series.name ||
            null,

        year: series.year || null,

        overview:
            series.description ||
            series.shortDescription ||
            null,

        posterPath:
            series.poster?.url ||
            series.poster?.previewUrl ||
            null,

        backdropPath:
            series.backdrop?.url ||
            series.backdrop?.previewUrl ||
            null,

        rating:
            series.rating?.kp ||
            series.rating?.imdb ||
            null,

        genres: Array.isArray(series.genres)
            ? series.genres
                .map((genre) => genre.name)
                .filter(Boolean)
            : [],

        countries: Array.isArray(series.countries)
            ? series.countries
                .map((country) => country.name)
                .filter(Boolean)
            : [],

        status: series.status || null,

        totalSeasons:
            series.seasonsInfo?.length ||
            series.releaseYears?.length ||
            null,

        totalEpisodes:
            series.seriesLength ||
            null,

        metadata: series,
    };
}

export function mapKinopoiskSeasonEpisodes(season) {
    if (!season || !Array.isArray(season.episodes)) {
        return [];
    }

    return season.episodes.map((episode) => ({
        seasonNumber:
            episode.seasonNumber ??
            season.number ??
            null,

        episodeNumber:
            episode.number ??
            episode.episodeNumber ??
            null,

        title:
            episode.name ||
            episode.enName ||
            null,

        overview:
            episode.description ||
            null,

        airDate:
            episode.date ||
            null,

        stillPath:
            episode.still?.url ||
            episode.still?.previewUrl ||
            null,

        metadata: episode,
    }));
}
