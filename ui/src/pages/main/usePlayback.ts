import { createSignal, onCleanup } from "solid-js";
import { CommonPlayer } from "#devices/common/player";
import type { PlayTarget } from "./types";
import { getStreamUrlFromPlayTarget, savePlaybackProgress } from "./mediaApi";

export function usePlayback() {
  const [isPlaying, setIsPlaying] = createSignal(false);

  let player: CommonPlayer | null = null;
  let currentPlayTarget: PlayTarget | null = null;
  let progressTimer: number | undefined;

  const saveCurrentProgress = () => {
    if (!player || !currentPlayTarget) return;

    const positionSeconds = player.getCurrentPosition();
    const durationSeconds = player.getDuration();

    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return;

    void savePlaybackProgress({
      mediaFileId: currentPlayTarget.mediaFileId,
      positionSeconds,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    }).catch((err) => {
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

  const stopPlayback = () => {
    saveCurrentProgress();
    stopProgressTimer();

    if (player) {
      player.stop();
      player = null;
    }

    currentPlayTarget = null;
    setIsPlaying(false);
  };

  const playTarget = async (playTarget: PlayTarget) => {
    stopPlayback();

    try {
      const streamUrl = getStreamUrlFromPlayTarget(playTarget);

      currentPlayTarget = playTarget;

      player = new CommonPlayer();
      setIsPlaying(true);

      await player.load(streamUrl, true, playTarget.positionSeconds || 0);

      startProgressTimer();
    } catch (err) {
      console.error("Failed to start playback:", err);
      stopPlayback();
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
    stopPlayback();
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