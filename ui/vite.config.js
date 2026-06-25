import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import hexColorTransform from "@lightningtv/vite-hex-transform";
import { viteSingleFile } from "vite-plugin-singlefile";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import deviceConfigPlugin from "./devices/deviceConfigPlugin.js";

const targetDevice = process.env.TARGET_DEVICE || "lg";
const isLg = targetDevice === "lg";

export default defineConfig(({ mode }) => {
  return {
    base: "./",
    envDir: "./environments",
    define: {
      __DEV__: mode !== "production",
      __SERVER_BASE__: JSON.stringify(
        isLg
          ? (process.env.VITE_SERVER_BASE || "http://192.168.1.22:4000")
          : ""
      ),
    },
    plugins: [
      deviceConfigPlugin(targetDevice),

      hexColorTransform({
        include: ["src/**/*.{ts,tsx,js,jsx}"],
      }),

      solidPlugin({
        solid: {
          moduleName: "@lightningtv/solid",
          generate: "universal",
        },
      }),

      // LG B9 / webOS 4.5 uses an old Chromium engine.
      // Do NOT use viteSingleFile for LG, because it keeps Vite's module style.
      // Instead, generate legacy nomodule scripts.
      isLg &&
      legacy({
        targets: ["Chrome 53"],
        renderLegacyChunks: true,
        modernPolyfills: false,
      }),

      // Keep single-file mode only for non-LG targets if needed.
      !isLg && viteSingleFile(),
    ].filter(Boolean),

    resolve: {
      alias: {
        theme: path.resolve(__dirname, "./theme.js"),
        "@": path.resolve(__dirname, "./src"),
        "#devices": path.resolve(__dirname, "./devices"),
      },
      dedupe: ["solid-js", "@lightningtv/solid", "@lightningtv/core", "@lightningjs/renderer"],
    },

    build: {
      target: isLg ? "chrome53" : "es2015",
      cssTarget: "chrome53",
      minify: "terser",
      sourcemap: false,
      outDir: `dist/${targetDevice}`,
      emptyOutDir: true,
    },
  };
});