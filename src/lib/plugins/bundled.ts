/**
 * The script plugins Piloti ships (`/usr/share/piloti/plugins`), built into the
 * shell. On Linux its security policy only runs the shell's own code, so a
 * script read from disk can't be imported.
 */
import type { PluginModule } from "./loader";
// @ts-expect-error Plugins are plain JavaScript.
import * as appDarkMode from "../../../data/files/usr/share/piloti/plugins/app-dark-mode/index.js";
// @ts-expect-error Plugins are plain JavaScript.
import * as pictureInPicture from "../../../data/files/usr/share/piloti/plugins/picture-in-picture/index.js";

export const BUNDLED_PLUGINS: Record<string, PluginModule> = {
  "app-dark-mode": appDarkMode,
  "picture-in-picture": pictureInPicture,
};
