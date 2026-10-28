/**
 * Work out which word a click landed on: collect the text of the clicked block, find the clicked
 * character in it, and later turn the matched word back into a DOM range to highlight.
 * Positions are code points when they travel to the API and UTF-16 units inside the DOM.
 */

const BLOCK = "p, li, pre, h1, h2, h3, h4, td, dd, dt, blockquote, div";
/** How much text around the click goes to the server: enough for a long word and its look-back. */
const BEFORE = 8;
const AFTER = 30;

export type ClickContext = {
  /** Text sent to the lookup, and the clicked character's code-point index within it. */
  text: string;
  offset: number;
  /** Where `text` begins inside the block's text (UTF-16 units), to find the DOM range again. */
  blockStart: number;
  block: Element;
};

function textNodesOf(block: Element): Text[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    // furigana (<rt>) and its fallback brackets are not part of the sentence
    acceptNode: (n) => (n.parentElement?.closest("rt, rp") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

export function clickContext(node: Text, nodeOffset: number): ClickContext | null {
  const block = node.parentElement?.closest(BLOCK);
  if (!block) return null;
  const nodes = textNodesOf(block);
  let before = 0;
  let found = false;
  let full = "";
  for (const n of nodes) {
    if (n === node) {
      before = full.length + nodeOffset;
      found = true;
    }
    full += n.data;
  }
  if (!found || before >= full.length) return null;

  const from = Math.max(0, before - BEFORE);
  const text = full.slice(from, before + AFTER);
  const offset = [...full.slice(from, before)].length;
  return { text, offset, blockStart: from, block };
}

/** The DOM range covering code points [start, start + length) of the text sent for `ctx`. */
export function rangeForMatch(ctx: ClickContext, start: number, length: number): Range | null {
  const chars = [...ctx.text];
  const startUnit = ctx.blockStart + chars.slice(0, start).join("").length;
  const endUnit = startUnit + chars.slice(start, start + length).join("").length;

  const range = document.createRange();
  let pos = 0;
  let startSet = false;
  for (const n of textNodesOf(ctx.block)) {
    const next = pos + n.data.length;
    if (!startSet && startUnit < next) {
      range.setStart(n, startUnit - pos);
      startSet = true;
    }
    if (startSet && endUnit <= next) {
      range.setEnd(n, endUnit - pos);
      return range;
    }
    pos = next;
  }
  return null;
}

/** The text position under a pointer, across the browsers' two spellings of the API. */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}
