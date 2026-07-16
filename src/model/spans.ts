// Pure span helpers — no Vue, no DOM. Everything here is a plain function of
// its inputs so the annotation rules stay testable in isolation.
import type { Annotation, AnnotationLevel } from "../types";
import type { OffsetRange } from "./selection";

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

function trim(text: string, r: OffsetRange): OffsetRange {
  let { start, end } = r;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

function wordSegments(text: string): OffsetRange[] {
  const segments: OffsetRange[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) segments.push({ start: m.index, end: m.index + m[0].length });
  return segments;
}

/** True if the first non-whitespace character at/after index `i` is an
 * uppercase letter, or there is none (end of text). Guards against
 * abbreviations like "Art. 5" — "5" isn't capitalized, so that period
 * doesn't end the sentence. */
function followedByCapitalOrEnd(text: string, i: number): boolean {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j++;
  return j === text.length || /[A-Z]/.test(text[j]);
}

/** Splits after a `.`/`!`/`?` run followed by whitespace (or end-of-text)
 * and then a capitalized word (or end-of-text). A heuristic — doesn't know
 * about abbreviations in general — but the capitalization check handles the
 * common case, and it's predictable and good enough for snapping a
 * selection to "the sentence it touches". */
function sentenceSegments(text: string): OffsetRange[] {
  const segments: OffsetRange[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const isTerminator = text[i] === "." || text[i] === "!" || text[i] === "?";
    const atBoundary = i === text.length - 1 || /\s/.test(text[i + 1]);
    if (isTerminator && atBoundary && followedByCapitalOrEnd(text, i + 1)) {
      segments.push(trim(text, { start, end: i + 1 }));
      start = i + 1;
    }
  }
  if (start < text.length) segments.push(trim(text, { start, end: text.length }));
  return segments.filter((s) => s.end > s.start);
}

/** Splits on blank-line runs (tolerant of \r\n). Text with no blank line is
 * one paragraph. */
function paragraphSegments(text: string): OffsetRange[] {
  const segments: OffsetRange[] = [];
  const re = /\n\s*\n/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    segments.push(trim(text, { start, end: m.index }));
    start = m.index + m[0].length;
  }
  segments.push(trim(text, { start, end: text.length }));
  return segments.filter((s) => s.end > s.start);
}

/**
 * Expand [start, end) to the union of every word/sentence/paragraph segment
 * it overlaps, so a partial selection still captures the whole unit the
 * annotator touched — a no-op for "character" and "document" levels. Only
 * ever expands: a selection landing purely in whitespace (no segment
 * overlap) falls back to itself unchanged.
 */
export function snapToLevel(
  fullText: string,
  level: AnnotationLevel,
  start: number,
  end: number,
): OffsetRange {
  const segmenter =
    level === "word" ? wordSegments : level === "sentence" ? sentenceSegments : level === "paragraph" ? paragraphSegments : null;
  if (!segmenter) return { start, end };

  const overlapping = segmenter(fullText).filter((s) => s.start < end && s.end > start);
  if (!overlapping.length) return { start, end };

  return {
    start: Math.min(start, ...overlapping.map((s) => s.start)),
    end: Math.max(end, ...overlapping.map((s) => s.end)),
  };
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
