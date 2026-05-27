import { Accessor, createSignal, onCleanup, onMount } from "solid-js";
import { consumeKeyboardEvent, getRuntimeKeyState } from "@/runtime";
import type { EpisodeItem, MainRow, ScreenMode, SeriesItem } from "./types";
import { fetchFilePlayTarget, fetchPlayTarget } from "./mediaApi";
import { usePlayback } from "./usePlayback";

type UseMainNavigationProps = {
  rows: Accessor<MainRow[]>;
  reloadCatalog?: (options?: { silent?: boolean }) => Promise<void>;
};

export function useMainNavigation(props: UseMainNavigationProps) {
  const playback = usePlayback();

  const [focusedRowIndex, setFocusedRowIndex] = createSignal(0);
  const [focusedItemIndex, setFocusedItemIndex] = createSignal(0);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = createSignal(0);

  const [screenMode, setScreenMode] = createSignal<ScreenMode>("main");
  const [selectedSeries, setSelectedSeries] = createSignal<SeriesItem | null>(null);

  const getFocusedItem = () => {
    const row = props.rows()[focusedRowIndex()];
    if (!row) return null;

    return row.items[focusedItemIndex()] ?? null;
  };

  const getSelectedSeriesEpisodes = () => {
    const series = selectedSeries();
    if (!series) return [];

    return series.seasons.flatMap(season => season.episodes);
  };

  const getFocusedEpisode = () => {
    const episodes = getSelectedSeriesEpisodes();
    return episodes[focusedEpisodeIndex()] ?? null;
  };

  const clampFocusToRows = () => {
    const rows = props.rows();

    if (rows.length === 0) {
      setFocusedRowIndex(0);
      setFocusedItemIndex(0);
      return;
    }

    const rowIndex = Math.min(focusedRowIndex(), rows.length - 1);
    const row = rows[rowIndex];

    setFocusedRowIndex(rowIndex);

    const maxItemIndex = Math.max(0, row.items.length - 1);
    setFocusedItemIndex(prev => Math.min(prev, maxItemIndex));
  };

  const reloadCatalogAndRefreshSelectedSeries = async () => {
    if (!props.reloadCatalog) return;

    const currentSeriesId = selectedSeries()?.id;

    await props.reloadCatalog({ silent: true });

    if (!currentSeriesId) return;

    const updatedSeries = props
      .rows()
      .flatMap(row => row.items)
      .find(item => item.type === "series" && item.id === currentSeriesId);

    if (updatedSeries && updatedSeries.type === "series") {
      setSelectedSeries(updatedSeries);
    }
  };

  const moveRow = (direction: number) => {
    const rows = props.rows();
    if (rows.length === 0) return;

    setFocusedRowIndex(prev => {
      const next = Math.max(0, Math.min(rows.length - 1, prev + direction));
      const nextRow = rows[next];

      if (nextRow) {
        setFocusedItemIndex(itemPrev => Math.min(itemPrev, Math.max(0, nextRow.items.length - 1)));
      }

      return next;
    });
  };

  const moveItem = (direction: number) => {
    const row = props.rows()[focusedRowIndex()];
    if (!row || row.items.length === 0) return;

    setFocusedItemIndex(prev => Math.max(0, Math.min(row.items.length - 1, prev + direction)));
  };

  const moveEpisode = (direction: number) => {
    const episodes = getSelectedSeriesEpisodes();
    if (episodes.length === 0) return;

    setFocusedEpisodeIndex(prev => Math.max(0, Math.min(episodes.length - 1, prev + direction)));
  };

  const openSeriesDetails = (series: SeriesItem) => {
    setSelectedSeries(series);
    setFocusedEpisodeIndex(0);
    setScreenMode("seriesDetails");

    void props
      .reloadCatalog?.({ silent: true })
      .then(() => {
        const updatedSeries = props
          .rows()
          .flatMap(row => row.items)
          .find(item => item.type === "series" && item.id === series.id);

        if (updatedSeries && updatedSeries.type === "series") {
          setSelectedSeries(updatedSeries);
        }
      })
      .catch(err => {
        console.error("Failed to reload catalog after opening series details:", err);
      });
  };

  const closeSeriesDetails = () => {
    setScreenMode("main");
    setSelectedSeries(null);
    setFocusedEpisodeIndex(0);

    void props.reloadCatalog?.({ silent: true }).catch(err => {
      console.error("Failed to reload catalog after closing series details:", err);
    });
  };

  const smartPlayFocusedItem = async () => {
    const item = getFocusedItem();
    if (!item) return;

    const playTarget = await fetchPlayTarget(item.id);
    await playback.playTarget(playTarget);
  };

  const playEpisode = async (_series: SeriesItem, episode: EpisodeItem) => {
    const playTarget = await fetchFilePlayTarget(episode.id);
    await playback.playTarget(playTarget);
  };

  const handlePlayingKeyDown = (event: KeyboardEvent) => {
    const key = getRuntimeKeyState(event);

    if (key.back || key.stop) {
      consumeKeyboardEvent(event);

      playback.stopPlayback();

      void reloadCatalogAndRefreshSelectedSeries().catch(err => {
        console.error("Failed to reload catalog after playback:", err);
      });

      return;
    }

    if (key.play) {
      consumeKeyboardEvent(event);
      playback.play();
      return;
    }

    if (key.pause) {
      consumeKeyboardEvent(event);
      playback.pause();
      return;
    }

    if (key.playPause || key.enter) {
      consumeKeyboardEvent(event);
      playback.togglePlayPause();
      return;
    }

    if (key.right || key.fastForward) {
      consumeKeyboardEvent(event);
      playback.seekBy(10);
      return;
    }

    if (key.left || key.rewind) {
      consumeKeyboardEvent(event);
      playback.seekBy(-10);
      return;
    }

    if (key.up) {
      consumeKeyboardEvent(event);
      playback.adjustVolume(0.1);
      return;
    }

    if (key.down) {
      consumeKeyboardEvent(event);
      playback.adjustVolume(-0.1);
      return;
    }
  };

  const handleMainKeyDown = (event: KeyboardEvent) => {
    const key = getRuntimeKeyState(event);

    clampFocusToRows();

    if (key.down) {
      consumeKeyboardEvent(event);
      moveRow(1);
      return;
    }

    if (key.up) {
      consumeKeyboardEvent(event);
      moveRow(-1);
      return;
    }

    if (key.right) {
      consumeKeyboardEvent(event);
      moveItem(1);
      return;
    }

    if (key.left) {
      consumeKeyboardEvent(event);
      moveItem(-1);
      return;
    }

    if (key.play) {
      consumeKeyboardEvent(event);
      void smartPlayFocusedItem();
      return;
    }

    if (key.enter) {
      consumeKeyboardEvent(event);

      const item = getFocusedItem();
      if (!item) return;

      if (item.type === "series") {
        openSeriesDetails(item);
        return;
      }

      void smartPlayFocusedItem();
    }
  };

  const handleSeriesDetailsKeyDown = (event: KeyboardEvent) => {
    const key = getRuntimeKeyState(event);

    if (key.back) {
      consumeKeyboardEvent(event);
      closeSeriesDetails();
      return;
    }

    if (key.left) {
      consumeKeyboardEvent(event);
      moveEpisode(-1);
      return;
    }

    if (key.right) {
      consumeKeyboardEvent(event);
      moveEpisode(1);
      return;
    }

    if (key.play || key.enter) {
      consumeKeyboardEvent(event);

      const series = selectedSeries();
      const episode = getFocusedEpisode();

      if (!series || !episode) return;

      void playEpisode(series, episode);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (playback.isPlaying()) {
      handlePlayingKeyDown(event);
      return;
    }

    if (screenMode() === "seriesDetails") {
      handleSeriesDetailsKeyDown(event);
      return;
    }

    handleMainKeyDown(event);
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown, true);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown, true);
  });

  return {
    focusedRowIndex,
    focusedItemIndex,
    focusedEpisodeIndex,

    screenMode,
    selectedSeries,

    isPlaying: playback.isPlaying,
  };
}
