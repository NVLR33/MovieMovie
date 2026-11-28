import type { UserTitleCollection } from "./user-titles";
export type TitleStudioFilter = "all" | "unlocked" | "locked";
/** Presentation only: availability and permanent ownership remain server-owned. */
export function titleStudioView(
  collection: UserTitleCollection,
  filter: TitleStudioFilter,
) {
  const unlocked = collection.options.filter(
    (option) => option.unlocked,
  ).length;
  return {
    total: collection.options.length,
    unlocked,
    locked: collection.options.length - unlocked,
    options: collection.options.filter(
      (option) =>
        filter === "all" ||
        (filter === "unlocked" ? option.unlocked : !option.unlocked),
    ),
    next:
      collection.options.find(
        (option) => option.metric === "watches" && !option.unlocked,
      ) ?? null,
  };
}
