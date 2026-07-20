import { WebGlCoreRenderer, SdfTextRenderer } from "@lightningjs/renderer/webgl";
import { Inspector } from "@lightningjs/renderer/inspector";
import { DeviceCommon } from "./device";

export const config = {
  name: "common",
  quality: {
    image: {
      ratio: 1,
      quality: 80,
    },
  },
  timing: {
    hero: 500,
  },
  lightning: {
    debug: false,
    focusDebug: false,
    fontSettings: { fontFamily: "NotoSans", color: 0xffffffff, fontSize: 40 },
    animationSettings: { easing: "ease-out", duration: 300 },
    rendererOptions: {
      appHeight: 1080,
      appWidth: 1920,
      numImageWorkers: 2,
      fontEngines: [SdfTextRenderer],
      renderEngine: WebGlCoreRenderer,
      inspector: import.meta.env.DEV ? Inspector : undefined,
      deviceLogicalPixelRatio: Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
      devicePhysicalPixelRatio: window.devicePixelRatio || 1,
      // Increase to preload images coming from offscreen
      boundsMargin: 200,
      createImageBitmapSupport: "auto",
      textureMemory: {
        criticalThreshold: 200e6,
        targetThresholdLevel: 0.8,
      },
      enableClear: false,
      enableAlphaChannel: true,
      textureEnableAlphaFormats: ["png"],
    },
  },
  keys: {
    Back: ["b", 66],
    Left: ["ArrowLeft", 37],
    Right: ["ArrowRight", 39],
    Up: ["ArrowUp", 38],
    Down: ["ArrowDown", 40],
    Enter: ["Enter", 13],
    Play: ["p", 80],
    Pause: ["a", 65],
    Menu: ["m"],
    PlayPause: ["t", 84],
    FastForward: ["f", 70],
    FastForward10: ["d", 68],
    Rewind: ["r", 82],
    Rewind10: ["e", 69],
    Stop: ["s", 83],
    Key0: ["0", 96, 48],
    Key1: ["1", 97, 49],
    Key2: ["2", 98, 50],
    Key3: ["3", 99, 51],
    Key4: ["4", 100, 52],
    Key5: ["5", 101, 53],
    Key6: ["6", 102, 54],
    Key7: ["7", 103, 55],
    Key8: ["8", 104, 56],
    Key9: ["9", 105, 57],
  },
  keyHoldOptions: {
    userKeyHoldMap: {
      EnterHold: ["Enter", 13],
      BackHold: ["b", 66],
    },
    holdThreshold: 1000,
  },
  initialize: function (): Promise<DeviceCommon> {
    return DeviceCommon.initialize();
  },
};
