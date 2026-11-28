/** Focus of a document of its own (a module, or the demo's iframe). */
export function watchDocumentFocus(listener: (focused: boolean) => void): () => void {
  const onFocus = () => listener(true);
  const onBlur = () => listener(false);
  listener(document.hasFocus());
  addEventListener("focus", onFocus);
  addEventListener("blur", onBlur);
  return () => {
    removeEventListener("focus", onFocus);
    removeEventListener("blur", onBlur);
  };
}
