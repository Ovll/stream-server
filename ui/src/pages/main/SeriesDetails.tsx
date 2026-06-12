import { For, Show } from "solid-js";
import { View, Text } from "@lightningtv/solid";
import type { EpisodeItem, SeriesItem } from "./types";

type SeriesDetailsProps = {
  series: SeriesItem;
  focusedEpisodeIndex: number;
  onEpisodeHover?: (episodeIndex: number) => void;
  onEpisodeClick?: (episode: EpisodeItem) => void;
};

const CARD_WIDTH = 330;
const CARD_HEIGHT = 186;
const CARD_GAP = 30;
const CARD_STEP = CARD_WIDTH + CARD_GAP;

const VIEWPORT_WIDTH = 1720;
const LEFT_RENDER_LIMIT = -300;
const RIGHT_RENDER_LIMIT = VIEWPORT_WIDTH + 300;

const LAST_FULLY_VISIBLE_FOCUS_INDEX = Math.floor((VIEWPORT_WIDTH - CARD_WIDTH) / CARD_STEP) + 1;

type VisibleEpisode = {
  episode: EpisodeItem;
  index: number;
  x: number;
};

function getEpisodeCode(episode: EpisodeItem) {
  return `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(
    2,
    "0",
  )}`;
}

function getEpisodeTitle(episode: EpisodeItem) {
  return episode.title || getEpisodeCode(episode);
}

const SeriesDetails = (props: SeriesDetailsProps) => {
  const episodes = () => props.series.seasons.flatMap(season => season.episodes);

  const carouselOffset = () => {
    const focusIndex = props.focusedEpisodeIndex;

    if (focusIndex <= LAST_FULLY_VISIBLE_FOCUS_INDEX) {
      return 0;
    }

    return (focusIndex - LAST_FULLY_VISIBLE_FOCUS_INDEX) * CARD_STEP;
  };

  const visibleEpisodes = (): VisibleEpisode[] => {
    const offset = carouselOffset();

    return episodes()
      .map((episode, index) => ({
        episode,
        index,
        x: index * CARD_STEP - offset,
      }))
      .filter(item => {
        return item.x > LEFT_RENDER_LIMIT && item.x < RIGHT_RENDER_LIMIT;
      });
  };

  return (
    <View x={0} y={150} width={1720} height={880}>
      <Text fontSize={48} color="#ffffff">
        {props.series.title}
      </Text>

      <Text x={0} y={70} fontSize={28} color="#9ca3af">
        Season 1
      </Text>

      <View x={0} y={130} width={VIEWPORT_WIDTH} height={330}>
        <For each={visibleEpisodes()}>
          {item => {
            const episode = item.episode;
            const isFocused = () => item.index === props.focusedEpisodeIndex;
            const isCompleted = () => episode.completed === 1;

            return (
              <View
                x={item.x}
                y={0}
                width={CARD_WIDTH}
                height={290}
                onFocus={() => props.onEpisodeHover?.(item.index)}
                onMouseClick={() => props.onEpisodeClick?.(episode)}
              >
                <View
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  color={isFocused() ? "#93c5fd" : "#4b5563"}
                  borderRadius={4}
                >
                  <View
                    x={2}
                    y={2}
                    width={CARD_WIDTH - 4}
                    height={CARD_HEIGHT - 4}
                    color={isFocused() ? "#3b82f6" : "#1f2937"}
                    borderRadius={3}
                  >
                    <Show when={episode.stillUrl}>
                      {stillUrl => (
                        <View x={0} y={0} width={CARD_WIDTH - 4} height={CARD_HEIGHT - 4} src={stillUrl()} />
                      )}
                    </Show>

                    <Show when={isCompleted()}>
                      <View x={CARD_WIDTH - 44} y={8} width={28} height={28} src="/icons/watched.png" />
                    </Show>
                  </View>
                </View>

                <Text x={4} y={202} width={320} fontSize={24} color={isFocused() ? "#ffffff" : "#d1d5db"} contain="width" maxLines={2}>
                  {getEpisodeTitle(episode)}
                </Text>
              </View>
            );
          }}
        </For>
      </View>
    </View>
  );
};

export default SeriesDetails;
