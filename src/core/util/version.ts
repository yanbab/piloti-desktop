import pkg from "../../../package.json";

declare const __PILOTI_VERSION__: string | undefined;

/** `0.10.9-3` in a build (see scripts/version.mjs); package.json's otherwise. */
export const PILOTI_VERSION: string =
  typeof __PILOTI_VERSION__ === "string" ? __PILOTI_VERSION__ : pkg.version;
