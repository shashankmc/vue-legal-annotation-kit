// 1–9, then 0 for the tenth, then letters for the rest.
const KEYS = [..."1234567890", ..."abcdefghijklmnopqrstuvwxyz"];

/** The key that arms the label at `index`, or "" past the last key. */
export const labelHotkey = (index: number): string => KEYS[index] ?? "";

/** The label index a key press arms, or -1. Letters ignore case. */
export const labelIndexForKey = (key: string): number =>
  key.length === 1 ? KEYS.indexOf(key.toLowerCase()) : -1;

/** What a key press means in a task with span labels and, optionally, document tags. */
export type HotkeyTarget = { kind: "span" | "tag"; index: number };

/**
 * The span label or document tag a key press stands for, or null. The keys run
 * on in one sequence: the span labels take the first `spanCount`, and the tags
 * continue right after them (with 10 span labels, the first tag's key is the one
 * after the tenth label's). A key beyond the last tag means nothing.
 */
export function hotkeyTarget(key: string, spanCount: number, tagCount: number): HotkeyTarget | null {
  const index = labelIndexForKey(key);
  if (index < 0) return null;
  if (index < spanCount) return { kind: "span", index };
  const tag = index - spanCount;
  return tag < tagCount ? { kind: "tag", index: tag } : null;
}
