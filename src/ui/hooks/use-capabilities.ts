import { getEngine, type EngineCapabilities } from "@/platform/shared/engine";

/** What the running engine can do. Fixed for the life of the page, so it is not state. */
export function useCapabilities(): EngineCapabilities {
  return getEngine().capabilities;
}
