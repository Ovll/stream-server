import { onCleanup, onMount } from "solid-js";
import { runtime } from "@/runtime";

type ReloadCatalog = (options?: { silent?: boolean }) => Promise<void>;

export function useCatalogEvents(reloadCatalog: ReloadCatalog) {
  let events: EventSource | null = null;
  let reloadTimer: number | undefined;

  const scheduleReload = () => {
    if (reloadTimer !== undefined) {
      window.clearTimeout(reloadTimer);
    }

    reloadTimer = window.setTimeout(() => {
      void reloadCatalog({ silent: true }).catch(err => {
        console.error("Failed to reload catalog after SSE event:", err);
      });
    }, 500);
  };

  onMount(() => {
    if (typeof EventSource === "undefined") {
      console.warn("EventSource is not supported on this device.");
      return;
    }

    events = new EventSource(`${runtime.serverBase}/api/events`);

    events.addEventListener("connected", event => {
      console.log("Catalog events connected:", event);
    });

    events.addEventListener("catalog-changed", event => {
      console.log("Catalog changed:", event);
      scheduleReload();
    });

    events.onerror = err => {
      console.warn("Catalog events connection error:", err);
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
