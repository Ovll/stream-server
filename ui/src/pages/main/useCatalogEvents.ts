import { onCleanup, onMount } from "solid-js";
import { runtime } from "@/runtime";

type OnCatalogChanged = () => Promise<void> | void;

export function useCatalogEvents(onCatalogChanged: OnCatalogChanged) {
  let events: EventSource | null = null;
  let reloadTimer: number | undefined;

  const scheduleReload = () => {
    if (reloadTimer !== undefined) {
      window.clearTimeout(reloadTimer);
    }

    reloadTimer = window.setTimeout(() => {
      Promise.resolve(onCatalogChanged()).catch(err => {
        console.error("Failed to refresh catalog after SSE event:", err);
      });
    }, 500);
  };

  onMount(() => {
    if (typeof EventSource === "undefined") {
      console.warn("EventSource is not supported on this device.");
      return;
    }

    let hadError = false;

    events = new EventSource(`${runtime.serverBase}/api/events`);

    events.addEventListener("connected", () => {
      if (hadError) {
        hadError = false;
        console.log("Catalog events reconnected — reloading catalog.");
        scheduleReload();
      }
    });

    events.addEventListener("catalog-changed", event => {
      console.log("Catalog changed:", event);
      scheduleReload();
    });

    events.onerror = err => {
      console.warn("Catalog events connection error:", err);
      hadError = true;
    };
  });

  onCleanup(() => {
    if (reloadTimer !== undefined) {
      window.clearTimeout(reloadTimer);
      reloadTimer = undefined;
    }

    if (events) {
      events.close();
      events = null;
    }
  });
}
