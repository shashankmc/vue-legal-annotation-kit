// 1–9, then 0 for the tenth, then letters for the rest.
const KEYS = [..."1234567890", ..."abcdefghijklmnopqrstuvwxyz"];

/** The key that arms the label at `index`, or "" past the last key. */
export const labelHotkey = (index: number): string => KEYS[index] ?? "";

/** The label index a key press arms, or -1. Letters ignore case. */
export const labelIndexForKey = (key: string): number =>
  key.length === 1 ? KEYS.indexOf(key.toLowerCase()) : -1;
