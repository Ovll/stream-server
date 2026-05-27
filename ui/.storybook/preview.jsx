import { createRenderer, Config, loadFonts } from "@lightningtv/solid";
import { WebGlCoreRenderer, SdfTextRenderer } from "@lightningjs/renderer/webgl";
import { Inspector } from "@lightningjs/renderer/inspector";
import fonts from "../src/fonts";
import { useFocusManager } from "@lightningtv/solid/primitives";
import { createSignal, Show } from "solid-js";
import {
  Rounded,
  RoundedWithShadow,
  RoundedWithBorderAndShadow,
  RadialGradient,
  LinearGradient,
  HolePunch,
} from "@lightningjs/renderer/webgl/shaders";
import { RoundedWithBorder } from "@lightningtv/solid/shaders";

Config.rendererOptions = {
  appWidth: 1920,
  appHeight: 1080,
  deviceLogicalPixelRatio: 2 / 3,
  inspector: Inspector,
  devicePhysicalPixelRatio: 1,
  fontEngines: [SdfTextRenderer],
  renderEngine: WebGlCoreRenderer,
};

Config.fontSettings.fontFamily = "Roboto";

let startRenderer = true;
const solidRoot = document.createElement("div");
let toRender, setToRender;

const preview = {
  tags: ["autodocs"],
  parameters: {
    backgrounds: { default: "dark" },
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      expanded: true,
    },
    docs: {
      story: {
        inline: false,
        iframeHeight: "360px",
      },
      source: {
        type: "code",
        language: "jsx",
      },
    },
  },
  decorators: [
    (Story, _context) => {
      if (setToRender) {
        setToRender(Story);
      }

      if (startRenderer) {
        startRenderer = false;
        const { render, renderer } = createRenderer(undefined, solidRoot);
        const shManager = renderer.stage.shManager;
        shManager.registerShaderType("rounded", Rounded);
        shManager.registerShaderType("roundedWithBorder", RoundedWithBorder);
        shManager.registerShaderType("roundedWithShadow", RoundedWithShadow);
        shManager.registerShaderType("roundedWithBorderWithShadow", RoundedWithBorderAndShadow);
        shManager.registerShaderType("radialGradient", RadialGradient);
        shManager.registerShaderType("linearGradient", LinearGradient);
        shManager.registerShaderType("holePunch", HolePunch);
        loadFonts(fonts);

        render(() => {
          useFocusManager();
          [toRender, setToRender] = createSignal(Story);
          return (
            <Show when={toRender()}>
              {
                <view x={20} y={20}>
                  {toRender()}
                </view>
              }
            </Show>
          );
        });
      }

      return solidRoot;
    },
  ],
};

export default preview;
