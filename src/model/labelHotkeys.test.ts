import { describe, expect, it } from "vitest";
import { hotkeyTarget, labelHotkey } from "./labelHotkeys";

describe("hotkeyTarget", () => {
  it("maps the first keys to span labels, as before", () => {
    expect(hotkeyTarget("1", 3, 0)).toEqual({ kind: "span", index: 0 });
    expect(hotkeyTarget("3", 3, 0)).toEqual({ kind: "span", index: 2 });
  });

  it("means nothing for a key past the last span label when there are no tags", () => {
    expect(hotkeyTarget("4", 3, 0)).toBeNull();
  });

  it("continues with the document tags right after the span labels", () => {
    expect(hotkeyTarget("4", 3, 2)).toEqual({ kind: "tag", index: 0 });
    expect(hotkeyTarget("5", 3, 2)).toEqual({ kind: "tag", index: 1 });
    expect(hotkeyTarget("6", 3, 2)).toBeNull();
  });

  it("carries on through 0 and into letters, ignoring case", () => {
    // 9 span labels: 1-9, so the first tag is 0, the next is a.
    expect(hotkeyTarget("0", 9, 2)).toEqual({ kind: "tag", index: 0 });
    expect(hotkeyTarget("A", 9, 2)).toEqual({ kind: "tag", index: 1 });
  });

  it("ignores keys that are not label keys", () => {
    for (const key of ["Enter", "Escape", " ", "ArrowDown", "?"]) expect(hotkeyTarget(key, 3, 2)).toBeNull();
  });

  it("agrees with the key shown beside a tag", () => {
    // The key printed on the tag at index i is labelHotkey(spanCount + i).
    for (let i = 0; i < 4; i++) {
      expect(hotkeyTarget(labelHotkey(10 + i), 10, 4)).toEqual({ kind: "tag", index: i });
    }
  });

  it("runs out after the 36 keys", () => {
    expect(labelHotkey(36)).toBe("");
  });
});
