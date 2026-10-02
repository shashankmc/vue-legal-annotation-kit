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

/** True if the next sentence plausibly starts at/after index `i`: the first
 * non-whitespace character, past any opening quotes or brackets, is an
 * uppercase letter in any script — or there is nothing left. Guards against
 * abbreviations like "Art. 5" — "5" isn't capitalized, so that period doesn't
 * end the sentence. */
function followedByCapitalOrEnd(text: string, i: number): boolean {
  let j = i;
  while (j < text.length && /\s/.test(text[j])) j++;
  while (j < text.length && OPENERS.test(text[j])) j++;
  return j === text.length || /\p{Lu}/u.test(text[j]);
}

const TERMINATOR = /[.!?]/;
/** Characters that close a sentence after its full stop: quotes and brackets. */
const CLOSERS = /[)\]}"'\u2019\u201D\u00BB]/;
const OPENERS = /[(\[{"'\u2018\u201C\u00AB]/;
/** A citation marker as Wikipedia and many judgments print them: "[12]",
 * "[a]", "[note 3]" — short, bracketed, right after the full stop. */
const CITATION = /^\[[^\]\n]{1,12}\]/;

/** Index just past the end of a sentence whose terminator is at `i`: the run
 * of terminators ("?!", "..."), then any closing quotes, brackets and citation
 * markers ("Television.[51][52]", "said so.\u201D"). */
function sentenceEnd(text: string, i: number): number {
  let j = i + 1;
  while (j < text.length && TERMINATOR.test(text[j])) j++;
  for (;;) {
    if (j < text.length && CLOSERS.test(text[j])) {
      j++;
      continue;
    }
    const citation = CITATION.exec(text.slice(j, j + 14));
    if (citation) {
      j += citation[0].length;
      continue;
    }
    return j;
  }
}

/** Sentences, never crossing a blank line: a heading or title without a full
 * stop is a sentence of its own, not the start of the one below it. Within a
 * paragraph, splits after a `.`/`!`/`?` — plus whatever closes the sentence
 * after it — followed by whitespace (or end-of-text) and then a capitalized
 * word (or end-of-text). A heuristic — doesn't know about abbreviations in
 * general — but the capitalization check handles the common case, and it's
 * predictable and good enough for snapping a selection to "the sentence it
 * touches". A single line break is not a boundary: in text extracted from a
 * PDF, or hard-wrapped, most of them fall mid-sentence. */
function sentenceSegments(text: string): OffsetRange[] {
  return paragraphSegments(text).flatMap((p) => sentencesWithin(text, p));
}

function sentencesWithin(text: string, paragraph: OffsetRange): OffsetRange[] {
  const segments: OffsetRange[] = [];
  const within = text.slice(0, paragraph.end);
  let start = paragraph.start;
  for (let i = paragraph.start; i < paragraph.end; i++) {
    if (!TERMINATOR.test(within[i])) continue;
    const end = sentenceEnd(within, i);
    const atBoundary = end === within.length || /\s/.test(within[end]);
    if (atBoundary && followedByCapitalOrEnd(within, end)) {
      segments.push(trim(text, { start, end }));
      start = end;
    }
    i = end - 1;
  }
  if (start < paragraph.end) segments.push(trim(text, { start, end: paragraph.end }));
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
