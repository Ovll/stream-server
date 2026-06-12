import { For, Show } from "solid-js";
import { View } from "@lightningtv/solid";
import type { MainCardItem, MainRow } from "./types";

type MediaListProps = {
  rows: MainRow[];
  focusedRowIndex: number;
  focusedItemIndex: number;
  onItemHover?: (rowIndex: number, itemIndex: number) => void;
  onItemClick?: (item: MainCardItem) => void;
};

const CARD_WIDTH = 190;
const CARD_HEIGHT = 285;
const CARD_GAP = 34;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const ROW_STEP = 390;

const MediaList = (props: MediaListProps) => {
  return (
    <View y={110}>
      <For each={props.rows}>
        {(row, rowIndex) => {
          return (
            <View y={rowIndex() * ROW_STEP}>
              <View y={58}>
                <For each={row.items}>
                  {(item, itemIndex) => {
                    const isFocused = () =>
                      rowIndex() === props.focusedRowIndex && itemIndex() === props.focusedItemIndex;

                    return (
                      <View
                        x={itemIndex() * CARD_STEP}
                        y={0}
                        width={CARD_WIDTH}
                        height={350}
                        onFocus={() => props.onItemHover?.(rowIndex(), itemIndex())}
                        onMouseClick={() => props.onItemClick?.(item)}
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
                            <Show when={item.posterUrl}>
                              {posterUrl => (
                                <View
                                  x={0}
                                  y={0}
                                  width={CARD_WIDTH - 4}
                                  height={CARD_HEIGHT - 4}
                                  src={posterUrl()}
                                />
                              )}
                            </Show>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                </For>
              </View>
            </View>
          );
        }}
      </For>
    </View>
  );
};

export default MediaList;
