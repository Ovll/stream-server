import { Show } from "solid-js";
import { View, Text } from "@lightningtv/solid";

import { useMediaList } from "./main/useMediaList";
import { useMainNavigation } from "./main/useMainNavigation";
import MediaList from "./main/MediaList";
import SeriesDetails from "./main/SeriesDetails";
import { useCatalogEvents } from "./main/useCatalogEvents";

const Main = () => {
  const { rows, reload } = useMediaList();

  const navigation = useMainNavigation({
    rows,
    reloadCatalog: reload,
  });

  useCatalogEvents(navigation.reloadCatalogAndRefreshSelectedSeries);

  return (
    <View x={100} y={100} width={1720} height={880}>
      <Show
        when={navigation.isPlaying()}
        fallback={
          <Show
            when={navigation.screenMode() === "seriesDetails" && navigation.selectedSeries()}
            fallback={
              <>
                <Text fontSize={48} color="#ffffff">
                  stream-server
                </Text>

                <MediaList
                  rows={rows()}
                  focusedRowIndex={navigation.focusedRowIndex()}
                  focusedItemIndex={navigation.focusedItemIndex()}
                />
              </>
            }
          >
            {series => (
              <SeriesDetails series={series()} focusedEpisodeIndex={navigation.focusedEpisodeIndex()} />
            )}
          </Show>
        }
      >
        <View width={1920} height={1080} />
      </Show>
    </View>
  );
};

export default Main;
