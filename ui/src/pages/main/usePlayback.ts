import { createSignal, onCleanup } from "solid-js";
import { runtime } from "@/runtime";
import { CommonPlayer } from "#devices/common/player";
import type { PlayTarget } from "./types";
import { getStreamUrlFromPlayTarget, savePlaybackProgress } from "./mediaApi";

export function usePlayback(options: { onEnded?: () => void } = {}) {
  const [isPlaying, setIsPlaying] = createSignal(false);

  let player: CommonPlayer | null = null;
  let currentPlayTarget: PlayTarget | null = null;
  let progressTimer: number | undefined;

  const getPlayer = () => {
    if (!player) {
      player = new CommonPlayer();
    }

    return player;
  };

  const saveCurrentProgress = () => {
    if (!player || !currentPlayTarget) return;

    const positionSeconds = player.getCurrentPosition();
    const durationSeconds = player.getDuration();

    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return;

    void savePlaybackProgress({
      mediaFileId: currentPlayTarget.mediaFileId,
      positionSeconds,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    }).catch(err => {
      console.error("Failed to save playback progress:", err);
    });
  };

  const startProgressTimer = () => {
    if (progressTimer !== undefined) {
      window.clearInterval(progressTimer);
    }

    progressTimer = window.setInterval(() => {
      saveCurrentProgress();
    }, 10_000);
  };

  const stopProgressTimer = () => {
    if (progressTimer !== undefined) {
      window.clearInterval(progressTimer);
      progressTimer = undefined;
    }
  };

  const stopCurrentMedia = () => {
    saveCurrentProgress();
    stopProgressTimer();

    if (player) {
      player.stop();
    }

    currentPlayTarget = null;
    setIsPlaying(false);
  };

  const stopPlayback = () => {
    stopCurrentMedia();
  };

  const playTarget = async (nextPlayTarget: PlayTarget) => {
    saveCurrentProgress();
    stopProgressTimer();

    try {
      const streamUrl = getStreamUrlFromPlayTarget(nextPlayTarget);
      const nextPlayer = getPlayer();

      currentPlayTarget = nextPlayTarget;
      setIsPlaying(true);

      const subtitleSrc = nextPlayTarget.subtitleTracks?.length > 0
        ? `${runtime.serverBase}/api/subtitles/${nextPlayTarget.mediaFileId}/${nextPlayTarget.subtitleTracks[0].id}`
        : undefined;

      await nextPlayer.load(streamUrl, true, nextPlayTarget.positionSeconds || 0, subtitleSrc);

      nextPlayer.onEnded(() => {
        stopCurrentMedia();
        options.onEnded?.();
      });

      startProgressTimer();
    } catch (err) {
      console.error("Failed to start playback:", err);
      stopCurrentMedia();
    }
  };

  const play = () => {
    player?.play();
  };

  const pause = () => {
    player?.pause();
    saveCurrentProgress();
  };

  const togglePlayPause = () => {
    player?.togglePlayPause();
    saveCurrentProgress();
  };

  const seekBy = (seconds: number) => {
    player?.seek(seconds);
    saveCurrentProgress();
  };

  const adjustVolume = (amount: number) => {
    player?.adjustVolume(amount);
  };

  onCleanup(() => {
    saveCurrentProgress();
    stopProgressTimer();

    if (player) {
      void player.destroy().catch(err => {
        console.warn("Failed to destroy player:", err);
      });

      player = null;
    }

    currentPlayTarget = null;
    setIsPlaying(false);
  });

  return {
    isPlaying,
    playTarget,
    stopPlayback,
    play,
    pause,
    togglePlayPause,
    seekBy,
    adjustVolume,
    saveCurrentProgress,
  };
}
