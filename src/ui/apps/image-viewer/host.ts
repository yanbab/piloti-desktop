/** What the Image Viewer needs from whoever runs it. */
import type { DocumentHost } from "@/core/ports/app-host";

export interface ImageViewerHost extends DocumentHost {
  /** Files are real files; the browser demo keeps pictures as data URLs. */
  binaryFiles: boolean;
}
