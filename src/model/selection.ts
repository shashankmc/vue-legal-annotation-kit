// Maps a browser text selection to character offsets in the document text.
// Kept separate from the pure span logic because it touches the DOM.

/** Character offset of (node, offset) within `container`, counting the text of
 * every text node that precedes it — works even when highlights have split the
 * text into many nodes. */
function offsetWithin(container: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
  }
  return total;
}

export interface OffsetRange {
  start: number;
  end: number;
}

/** Current selection as offsets within `container`, or null if there is no
 * usable (non-empty, fully-contained) selection. */
export function selectionOffsets(container: HTMLElement): OffsetRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null;

  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  )
    return null;

  const a = offsetWithin(container, range.startContainer, range.startOffset);
  const b = offsetWithin(container, range.endContainer, range.endOffset);
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return start === end ? null : { start, end };
}
