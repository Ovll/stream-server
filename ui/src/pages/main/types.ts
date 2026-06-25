export type MediaType = "movie" | "series";

export interface MediaCardItem {
  id: number;
  type: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
}

export interface MovieItem extends MediaCardItem {
  type: "movie";
  file: {
    id: number;
    filename: string;
    absolutePath: string;
    streamUrl: string;
  };
}

export interface EpisodeItem {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  filename: string;
  absolutePath: string;
  streamUrl: string;
  stillPath: string | null;
  stillUrl: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: number;
}

export interface SeasonItem {
  seasonNumber: number;
  episodeCount: number;
  episodes: EpisodeItem[];
}

export interface SeriesItem extends MediaCardItem {
  type: "series";
  episodeCount: number;
  seasons: SeasonItem[];
}

export interface MediaCatalog {
  movies: MovieItem[];
  series: SeriesItem[];
}

export type MainCardItem = MovieItem | SeriesItem;

export interface MainRow {
  id: "movies" | "series";
  title: string;
  items: MainCardItem[];
}

export type ScreenMode = "main" | "seriesDetails";

export interface PlayTarget {
  mediaItemId: number;
  mediaFileId: number;
  type: MediaType;
  title: string;
  year: number | null;
  filename: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: number;
  streamUrl: string;
  codec: string | null;
}
