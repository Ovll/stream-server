import { runtime } from "@/runtime";
import type { MainRow, MediaCatalog, PlayTarget } from "./types";

function toAbsoluteServerUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  return `${runtime.serverBase}${pathOrUrl}`;
}

export async function fetchCatalog(): Promise<MediaCatalog> {
  const response = await fetch(`${runtime.serverBase}/api/media/catalog`);

  if (!response.ok) {
    throw new Error(`Failed to load catalog. Status: ${response.status}`);
  }
  const catalog = await response.json();
  return normalizeCatalogImageUrls(catalog);
}

export async function fetchPlayTarget(mediaItemId: number): Promise<PlayTarget> {
  const response = await fetch(`${runtime.serverBase}/api/media/${mediaItemId}/play-target`);

  if (!response.ok) {
    throw new Error(`Failed to load play target. Status: ${response.status}`);
  }

  return await response.json();
}

export async function fetchFilePlayTarget(mediaFileId: number): Promise<PlayTarget> {
  const response = await fetch(`${runtime.serverBase}/api/media/file/${mediaFileId}/play-target`);

  if (!response.ok) {
    throw new Error(`Failed to load file play target. Status: ${response.status}`);
  }

  return await response.json();
}

export async function savePlaybackProgress(input: {
  mediaFileId: number;
  positionSeconds: number;
  durationSeconds: number | null;
}) {
  const response = await fetch(`${runtime.serverBase}/api/progress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mediaFileId: input.mediaFileId,
      positionSeconds: input.positionSeconds,
      durationSeconds: input.durationSeconds,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save playback progress. Status: ${response.status}`);
  }

  return await response.json();
}

export function getStreamUrlFromPlayTarget(playTarget: PlayTarget): string {
  const needsHls =
    !runtime.isLg &&
    (playTarget.codec === 'hevc' || playTarget.codec === 'h265');
  if (needsHls) {
    return toAbsoluteServerUrl(`/stream/hls/${playTarget.mediaFileId}/playlist.m3u8`);
  }
  return toAbsoluteServerUrl(playTarget.streamUrl);
}

export function buildMainRows(catalog: MediaCatalog): MainRow[] {
  const rows: MainRow[] = [];

  if (catalog.movies.length > 0) {
    rows.push({
      id: "movies",
      title: "Movies",
      items: catalog.movies,
    });
  }

  if (catalog.series.length > 0) {
    rows.push({
      id: "series",
      title: "Series",
      items: catalog.series,
    });
  }

  return rows;
}

function absolutizeImageUrl(value: string | null): string | null {
  if (!value) return null;
  return toAbsoluteServerUrl(value);
}

function normalizeCatalogImageUrls(catalog: MediaCatalog): MediaCatalog {
  return {
    movies: catalog.movies.map(movie => ({
      ...movie,
      posterUrl: absolutizeImageUrl(movie.posterUrl),
      backdropUrl: absolutizeImageUrl(movie.backdropUrl),
    })),

    series: catalog.series.map(series => ({
      ...series,
      posterUrl: absolutizeImageUrl(series.posterUrl),
      backdropUrl: absolutizeImageUrl(series.backdropUrl),
      seasons: series.seasons.map(season => ({
        ...season,
        episodes: season.episodes.map(episode => ({
          ...episode,
          stillUrl: absolutizeImageUrl(episode.stillUrl),
        })),
      })),
    })),
  };
}
