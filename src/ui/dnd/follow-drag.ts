/**
 * Moves a surface with the pointer during an HTML drag, whose own drag image is
 * a snapshot: of a window it can show neither a Linux client nor the frame
 * around it. A margin moves it without touching the transform that places it,
 * and the compositor follows the element.
 */
export function followDrag(
  surface: HTMLElement,
  start: { clientX: number; clientY: number },
  target: EventTarget = document,
): () => void {
  const before = { marginLeft: surface.style.marginLeft, marginTop: surface.style.marginTop };
  const move = (event: Event) => {
    const { clientX, clientY } = event as DragEvent;
    surface.style.marginLeft = `${clientX - start.clientX}px`;
    surface.style.marginTop = `${clientY - start.clientY}px`;
  };
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const [type, listener] of listeners) target.removeEventListener(type, listener, true);
    Object.assign(surface.style, before);
  };
  // After the drop has moved the window: it must not show where it was first.
  // A source that leaves the page gets no `dragend`, hence the drop too.
  const end = () => void setTimeout(stop, 0);
  const listeners: [string, (event: Event) => void][] = [
    ["dragover", move],
    ["drop", end],
    ["dragend", end],
  ];
  for (const [type, listener] of listeners) target.addEventListener(type, listener, true);
  return stop;
}

/** Hides the browser's drag image, when the surface itself follows. */
export function hideDragImage(data: DataTransfer): void {
  data.setDragImage(blank, 0, 0);
}

const blank = typeof Image === "undefined" ? (null as never) : new Image();
if (blank) blank.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
