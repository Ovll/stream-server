import { createSignal, onMount } from "solid-js";
import { buildMainRows, fetchCatalog } from "./mediaApi";
import type { MainRow, MediaCatalog } from "./types";

export function useMediaList() {
  const [catalog, setCatalog] = createSignal<MediaCatalog>({
    movies: [],
    series: [],
  });

  const [rows, setRows] = createSignal<MainRow[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let isReloading = false;

  const loadCatalog = async (options?: { silent?: boolean }) => {
    if (isReloading) return;

    try {
      isReloading = true;

      if (!options?.silent) {
        setIsLoading(true);
      }

      setError(null);

      const data = await fetchCatalog();

      setCatalog(data);
      setRows(buildMainRows(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load media catalog:", err);
      setError(message);
    } finally {
      isReloading = false;

      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  onMount(() => {
    void loadCatalog();
  });

  return {
    catalog,
    rows,
    isLoading,
    error,
    reload: loadCatalog,
  };
}
