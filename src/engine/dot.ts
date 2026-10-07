/**
 * dot.ts — one event's dot, on the timeline and on the map.
 *
 * A date known only to the decade or century (an ancient birth, "c. 400 BC") is drawn HOLLOW:
 * a ring of the same colour and size. Its text already says "c."; the ring says it before the
 * text is read, so a dense row of Antiquity does not look more exact than it is.
 */
export function drawDot(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, hollow: boolean): void {
  const rr = Math.max(0.5, r);
  c.beginPath();
  if (!hollow) {
    c.fillStyle = color;
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fill();
    return;
  }
  // the ring keeps the dot's outer edge where the full dot would end
  const lw = Math.max(1, rr * 0.45);
  // the caller's line width and colour are its own: the rows, wars and grid are stroked after
  const prevW = c.lineWidth, prevS = c.strokeStyle;
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.arc(x, y, Math.max(0.5, rr - lw / 2), 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = prevW;
  c.strokeStyle = prevS;
}
