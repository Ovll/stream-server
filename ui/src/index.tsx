import { createRenderer, Config as LightningConfig, loadFonts } from "@lightningtv/solid";
import { Route } from "@solidjs/router";
import { HashRouter, useFocusManager } from "@lightningtv/solid/primitives";
import App from "./pages/App";
import Main from "./pages/Main";
import TextPage from "./pages/Text";
import NotFound from "./pages/NotFound";
import fonts from "./fonts";
import { merge } from "lodash-es";
import { config } from "@/device/config";
import {
  Rounded,
  RoundedWithShadow,
  RoundedWithBorder,
  RoundedWithBorderAndShadow,
  RadialGradient,
  LinearGradient,
  HolePunch,
} from "@lightningjs/renderer/webgl/shaders";

/**
 * LG B9 / webOS notes:
 * - App is built with Vite legacy output.
 * - postbuild-lg.cjs rewrites index.html to classic legacy scripts.
 * - Do not rely only on DOMContentLoaded; legacy bundle can execute after it.
 */

function runWhenDomReady(fn: () => void) {
  if (typeof document === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function showFatalError(err: unknown) {
  if (typeof document === "undefined") return;

  document.body.style.margin = "0";
  document.body.style.background = "#300";

  const text = err instanceof Error ? err.stack || err.message : String(err);

  let box = document.getElementById("lg-fatal-error") as HTMLPreElement | null;

  if (!box) {
    box = document.createElement("pre");
    box.id = "lg-fatal-error";
    box.style.position = "fixed";
    box.style.left = "0";
    box.style.top = "0";
    box.style.right = "0";
    box.style.bottom = "0";
    box.style.zIndex = "9999999";
    box.style.margin = "0";
    box.style.padding = "36px";
    box.style.background = "#300";
    box.style.color = "white";
    box.style.fontSize = "24px";
    box.style.lineHeight = "1.25";
    box.style.whiteSpace = "pre-wrap";
    box.style.overflow = "auto";
    box.style.fontFamily = "monospace";
    document.body.appendChild(box);
  }

  box.textContent = "LG APP CRASHED\n\n" + text;
}

function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.onerror = function (message, source, lineno, colno, error) {
    showFatalError(
      "window.onerror\n\n" +
        "message: " +
        String(message) +
        "\nsource: " +
        String(source) +
        "\nline: " +
        String(lineno) +
        "\ncolumn: " +
        String(colno) +
        "\n\n" +
        String(error instanceof Error ? error.stack || error.message : error),
    );

    return true;
  };

  window.onunhandledrejection = function (event) {
    showFatalError(
      "unhandledrejection\n\n" +
        String(event.reason instanceof Error ? event.reason.stack || event.reason.message : event.reason),
    );
  };
}

function installWebOsPolyfills() {
  if (typeof window === "undefined") return;

  if (!window.globalThis) {
    (window as any).globalThis = window;
  }

  if (!(window as any).process) {
    (window as any).process = { env: {} };
  }

  if (!(window as any).process.env) {
    (window as any).process.env = {};
  }

  if (window.crypto && typeof window.crypto.randomUUID !== "function") {
    window.crypto.randomUUID = function (): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);

      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));

      return (hex.slice(0, 4).join("") +
        "-" +
        hex.slice(4, 6).join("") +
        "-" +
        hex.slice(6, 8).join("") +
        "-" +
        hex.slice(8, 10).join("") +
        "-" +
        hex.slice(10, 16).join("")) as `${string}-${string}-${string}-${string}-${string}`;
    };
  }
}

function configureLightning() {
  config.lightning.rendererOptions.deviceLogicalPixelRatio = 1;
  config.lightning.rendererOptions.devicePhysicalPixelRatio = 1;

  merge(LightningConfig, config.lightning);

  const finalOpts = LightningConfig.rendererOptions as Record<string, any>;

  finalOpts.numWorkers = 0;
  finalOpts.numImageWorkers = 0;
  finalOpts.threadX = false;
  finalOpts.forceInMainThread = true;
  finalOpts.enableWebGl = true;
}

function bootApp() {
  try {
    document.body.style.margin = "0";
    document.body.style.background = "black";
    document.body.style.overflow = "hidden";

    installGlobalErrorHandlers();
    installWebOsPolyfills();
    configureLightning();

    const { render, renderer } = createRenderer();

    const shManager = renderer.stage.shManager;

    shManager.registerShaderType("rounded", Rounded);
    shManager.registerShaderType("roundedWithBorder", RoundedWithBorder);
    shManager.registerShaderType("roundedWithShadow", RoundedWithShadow);

    // Keep both names because theme/components may use either spelling.
    shManager.registerShaderType("roundedWithBorderWithShadow", RoundedWithBorderAndShadow);
    shManager.registerShaderType("roundedWithBorderAndShadow", RoundedWithBorderAndShadow);

    shManager.registerShaderType("radialGradient", RadialGradient);
    shManager.registerShaderType("linearGradient", LinearGradient);
    shManager.registerShaderType("holePunch", HolePunch);

    loadFonts(fonts);

    render(() => {
      useFocusManager(config.keys, config.keyHoldOptions);

      return (
        <HashRouter root={App}>
          <Route path="/" component={Main} />
          <Route path="/text" component={TextPage} />
          <Route path="/*all" component={NotFound} />
        </HashRouter>
      );
    });
  } catch (err) {
    showFatalError(err);
  }
}

runWhenDomReady(() => {
  bootApp();
});
