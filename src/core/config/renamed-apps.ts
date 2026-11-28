/**
 * Apps renamed after users had them pinned, saved or chosen: Text Editor is
 * Texts, Camera is Selfies. Old ids are read as the new ones.
 */
const RENAMED: Record<string, string> = { "text-editor": "texts", camera: "selfies" };

export const currentAppId = (id: string): string => RENAMED[id] ?? id;

/** The id an app had before its rename, if it had one. */
export const formerAppId = (id: string): string | undefined =>
  Object.keys(RENAMED).find((old) => RENAMED[old] === id);

/** Window bounds keys are `<app>` or `<app>:<document>`. */
export function renameBoundsKeys<T>(bounds: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(bounds).map(([key, value]) => {
      const [app, ...rest] = key.split(":");
      return [[currentAppId(app), ...rest].join(":"), value];
    }),
  );
}
