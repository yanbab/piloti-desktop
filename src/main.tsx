import { Shell } from "../desktop";
import { createBrowserDomicile } from "./lib/browser-domicile";

const root = document.getElementById("root");
if (root) {
  const domicile = createBrowserDomicile();
  Shell(root, domicile);
}

