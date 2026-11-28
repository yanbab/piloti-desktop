/** What Selfies needs from whoever runs it. */
import type { AppHost } from "@/core/ports/app-host";

export interface SelfiesHost extends Pick<AppHost, "vfs" | "userDir" | "close"> {
  /** Files are real files; the browser demo keeps captures as data URLs. */
  binaryFiles: boolean;
}
