import shaka from "shaka-player";

export interface Player {
  isPaused(): boolean;
  getDuration(): number;
  getCurrentPosition(): number;
  load(streamUrl: string, autoPlay?: boolean, startTime?: number): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  destroy(): Promise<void>;
  seek(time: number): void;
  setVolume(volume: number): void;
  adjustVolume(amount: number): void;
  onEnded(callback: (() => void) | null): void;
}

export class CommonPlayer implements Player {
  private _player: shaka.Player | null = null;
  private _videoElement: HTMLVideoElement;
  private _currentUrl: string | null = null;
  private _isDestroyed = false;
  private _endedHandler: (() => void) | null = null;

  constructor(videoElement?: HTMLVideoElement) {
    this._videoElement = videoElement || this.createVideoElement();
    this.hideVideo();
  }

  private createVideoElement(): HTMLVideoElement {
    const existing = document.getElementById("app-video-player") as HTMLVideoElement | null;

    if (existing) {
      return existing;
    }

    const video = document.createElement("video");

    video.id = "app-video-player";
    video.style.position = "fixed";
    video.style.top = "0";
    video.style.left = "0";
    video.style.width = "100vw";
    video.style.height = "100vh";
    video.style.zIndex = "9999";
    video.style.background = "black";
    video.style.objectFit = "contain";

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("preload", "auto");

    document.body.appendChild(video);

    return video;
  }

  private createShakaPlayer() {
    if (this._player) {
      return;
    }

    this._player = new shaka.Player(this._videoElement);

    this._player.addEventListener("error", event => {
      console.error("Shaka Player error:", event);
    });
  }

  private showVideo() {
    this._videoElement.style.display = "block";
    this._videoElement.style.visibility = "visible";
  }

  private hideVideo() {
    this._videoElement.style.visibility = "hidden";
    this._videoElement.style.display = "none";
  }

  private shouldUseNativeVideo(streamUrl: string) {
    return streamUrl.includes("/stream/direct/");
  }

  private shouldUseShaka(streamUrl: string) {
    const cleanUrl = streamUrl.split("?")[0].toLowerCase();

    return cleanUrl.endsWith(".m3u8") || cleanUrl.endsWith(".mpd");
  }

  async load(streamUrl: string, autoPlay = false, startTime?: number): Promise<void> {
    if (this._isDestroyed) {
      throw new Error("Player was destroyed.");
    }

    if (this.shouldUseNativeVideo(streamUrl)) {
      await this.loadNative(streamUrl, autoPlay, startTime);
      return;
    }

    if (this.shouldUseShaka(streamUrl)) {
      await this.loadWithShaka(streamUrl, autoPlay, startTime);
      return;
    }

    await this.loadNative(streamUrl, autoPlay, startTime);
  }

  private async loadNative(streamUrl: string, autoPlay: boolean, startTime?: number): Promise<void> {
    try {
      this.showVideo();

      const isSameUrl = this._currentUrl === streamUrl;

      if (!isSameUrl) {
        if (this._player) {
          await this._player.unload().catch(() => undefined);
        }

        this._videoElement.pause();
        this._videoElement.src = streamUrl;
        this._videoElement.preload = "auto";
        this._videoElement.load();

        this._currentUrl = streamUrl;
      }

      if (typeof startTime === "number" && Number.isFinite(startTime) && startTime > 0) {
        this._videoElement.currentTime = Math.max(0, startTime);
      }

      if (autoPlay) {
        await this._videoElement.play();
      }
    } catch (error) {
      console.error("Failed to load native stream:", error);
      this.hideVideo();
      throw error;
    }
  }

  private async loadWithShaka(streamUrl: string, autoPlay: boolean, startTime?: number): Promise<void> {
    this.createShakaPlayer();

    if (!this._player) {
      throw new Error("Shaka Player is not initialized.");
    }

    try {
      this.showVideo();

      const isSameUrl = this._currentUrl === streamUrl;

      if (!isSameUrl) {
        await this._player.load(streamUrl, startTime);
        this._currentUrl = streamUrl;
      } else if (typeof startTime === "number" && Number.isFinite(startTime)) {
        this._videoElement.currentTime = Math.max(0, startTime);
      }

      if (autoPlay) {
        await this._videoElement.play();
      }
    } catch (error) {
      console.error("Failed to load Shaka stream:", error);
      this.hideVideo();
      throw error;
    }
  }

  isPaused(): boolean {
    return this._videoElement.paused;
  }

  getDuration(): number {
    return Number.isFinite(this._videoElement.duration) ? this._videoElement.duration : 0;
  }

  getCurrentPosition(): number {
    return Number.isFinite(this._videoElement.currentTime) ? this._videoElement.currentTime : 0;
  }

  togglePlayPause(): void {
    if (this._videoElement.paused) {
      void this._videoElement.play();
    } else {
      this._videoElement.pause();
    }
  }

  play(): void {
    this.showVideo();
    void this._videoElement.play();
  }

  pause(): void {
    this._videoElement.pause();
  }

  stop(): void {
    this.onEnded(null);
    this._videoElement.pause();

    if (this._player) {
      void this._player.unload().catch(err => {
        console.warn("Failed to unload Shaka player:", err);
      });
    }

    this._currentUrl = null;
    this.hideVideo();
  }

  onEnded(callback: (() => void) | null): void {
    if (this._endedHandler) {
      this._videoElement.removeEventListener("ended", this._endedHandler);
      this._endedHandler = null;
    }

    if (callback) {
      this._endedHandler = callback;
      this._videoElement.addEventListener("ended", this._endedHandler);
    }
  }

  async destroy(): Promise<void> {
    this._videoElement.pause();

    if (this._player) {
      await this._player.destroy();
      this._player = null;
    }

    this._currentUrl = null;
    this._isDestroyed = true;
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
