import { config } from "@/device/config";

export const runtime = {
  device: config.name,
  keys: config.keys,
  keyHoldOptions: config.keyHoldOptions,

  isLg: config.name === "lg",
  isTizen: config.name === "tizen",

  serverBase: (typeof __SERVER_BASE__ !== "undefined" && __SERVER_BASE__)
    ? __SERVER_BASE__
    : window.location.origin,
};

export function keyMatches(event: KeyboardEvent, value: unknown) {
  const keyCode = event.keyCode || event.which;

  if (Array.isArray(value)) {
    return value.includes(keyCode) || value.includes(event.key);
  }

  return value === keyCode || value === event.key;
}

export function getRuntimeKeyState(event: KeyboardEvent) {
  const keys = runtime.keys;

  return {
    back:
      event.key === "Escape" ||
      event.key === "Backspace" ||
      event.key === "GoBack" ||
      event.key === "BrowserBack" ||
      keyMatches(event, keys.Back),

    enter:
      event.key === "Enter" ||
      keyMatches(event, keys.Enter),

    up:
      event.key === "ArrowUp" ||
      keyMatches(event, keys.Up),

    down:
      event.key === "ArrowDown" ||
      keyMatches(event, keys.Down),

    left:
      event.key === "ArrowLeft" ||
      keyMatches(event, keys.Left),

    right:
      event.key === "ArrowRight" ||
      keyMatches(event, keys.Right),

    play: keyMatches(event, keys.Play),

    pause: keyMatches(event, keys.Pause),

    playPause:
      event.key === " " ||
      keyMatches(event, keys.PlayPause),

    stop: keyMatches(event, keys.Stop),

    fastForward: keyMatches(event, keys.FastForward),

    rewind: keyMatches(event, keys.Rewind),
  };
}

export function consumeKeyboardEvent(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}