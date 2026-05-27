import shaka from "shaka-player";

export interface Player {
  isPaused(): boolean;
  getDuration(): number;
  getCurrentPosition(): number;
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  adjustVolume(amount: number): void;
}

export class CommonPlayer implements Player {
  private _player: shaka.Player | null = null;
  private _videoElement: HTMLVideoElement;

  constructor(videoElement?: HTMLVideoElement) {
    this._videoElement = videoElement || this.createVideoElement();
    this.createPlayer();
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement("video");

    video.style.position = "fixed";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = "100vw";
    video.style.height = "100vh";
    video.style.zIndex = "9999";
    video.style.background = "black";

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    document.body.appendChild(video);

    return video;
  }

  private createPlayer() {
    this._player = new shaka.Player(this._videoElement);

    this._player.addEventListener("error", (event) => {
      console.error("Shaka Player error:", event);
    });
  }

  async load(streamUrl: string, autoPlay = false, startTime?: number): Promise<void> {
    if (!this._player) {
      this.createPlayer();
    }

    if (!this._player) {
      throw new Error("Player is not initialized.");
    }

    try {
      await this._player.load(streamUrl, startTime);

      if (autoPlay) {
        await this._videoElement.play();
      }

      console.log("Stream loaded successfully");
    } catch (error) {
      console.error("Failed to load stream:", error);
      throw error;
    }
  }

  isPaused(): boolean {
    return this._videoElement.paused;
  }

  getDuration(): number {
    return this._videoElement.duration;
  }

  getCurrentPosition(): number {
    return this._videoElement.currentTime;
  }

  togglePlayPause(): void {
    if (this._videoElement.paused) {
      void this._videoElement.play();
    } else {
      this._videoElement.pause();
    }
  }

  play(): void {
    void this._videoElement.play();
  }

  pause(): void {
    this._videoElement.pause();
  }

  stop(): void {
    this._videoElement.pause();
    this._videoElement.removeAttribute("src");
    this._videoElement.load();

    if (this._player) {
      void this._player.unload();
      void this._player.destroy();
      this._player = null;
    }

    this._videoElement.remove();
  }

  seek(time: number): void {
    this._videoElement.currentTime = Math.max(0, this._videoElement.currentTime + time);
  }

  setVolume(volume: number): void {
    this._videoElement.volume = Math.max(0, Math.min(1, volume));
  }

  adjustVolume(amount: number): void {
    this.setVolume(this._videoElement.volume + amount);
  }
}