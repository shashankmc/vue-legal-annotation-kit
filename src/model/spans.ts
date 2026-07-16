// Pure span helpers — no Vue, no DOM. Everything here is a plain function of
// its inputs so the annotation rules stay testable in isolation.
import type { Annotation } from "../types";

/**
 * The uniqueness rule: the same label may not cover the exact same range twice.
 * Overlaps with other labels (or the same label on a different range) are fine.
 */
export function isDuplicate(
  annotations: Annotation[],
  label: string,
  start: number,
  end: number,
): boolean {
  return annotations.some(
    (a) => a.label === label && a.start === start && a.end === end,
  );
}

/** Next temporary id for a client-created item (negative to avoid clashing
 * with real database ids until the row is persisted). Shared by annotations
 * and document-level annotations, each keeping their own id sequence. */
export function nextTempId(items: { id: number }[]): number {
  const min = items.reduce((m, a) => Math.min(m, a.id), 0);
  return Math.min(-1, min - 1);
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  /** ids of every annotation covering this segment (empty = plain text). */
  annotationIds: number[];
}

/**
 * Split `fullText` into non-overlapping segments at every annotation boundary.
 * Because segments are cut at each start/end, overlapping annotations naturally
 * produce a segment that lists all of the annotations covering it.
 */
export function segmentText(
  fullText: string,
  annotations: Annotation[],
): Segment[] {
  const bounds = new Set<number>([0, fullText.length]);
  for (const a of annotations) {
    if (a.start >= 0 && a.start <= fullText.length) bounds.add(a.start);
    if (a.end >= 0 && a.end <= fullText.length) bounds.add(a.end);
  }
  const points = [...bounds].sort((x, y) => x - y);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (start === end) continue;
    segments.push({
      text: fullText.slice(start, end),
      start,
      end,
      annotationIds: annotations
        .filter((a) => a.start <= start && a.end >= end)
        .map((a) => a.id),
    });
  }
  return segments;
}
