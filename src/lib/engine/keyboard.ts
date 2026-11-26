/**
 * The compositor's keymaps (`input.keyboard.keymaps` in its config), for the
 * menu bar switcher and Settings ▸ Keyboard.
 */
import * as React from "react";
import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
import { useCapabilities } from "@/hooks/use-capabilities";
import { usePiloti } from "@/lib/engine/piloti";
import type { Piloti } from "@/lib/engine/piloti";

export interface Keymap {
  name: string;
  description: string | undefined;
}

export interface KeymapState {
  active: string;
  keymaps: readonly Keymap[];
}

const NONE: KeymapState = { active: "", keymaps: [] };

/** Switches to the keymap with this name; a name the config lacks is ignored. */
export function selectKeymap(piloti: Piloti, name: string): void {
  if (typeof piloti.keyboard?.selectKeymap !== "function") return;
  void piloti.keyboard.selectKeymap(KeymapChoice.Named(name)).catch(() => undefined);
}

/** The live keymaps; empty without system services. */
export function useKeymaps(): KeymapState {
  const piloti = usePiloti();
  const { systemServices } = useCapabilities();
  const [state, setState] = React.useState<KeymapState>(NONE);

  React.useEffect(() => {
    if (!systemServices || typeof piloti.keyboard?.keymaps !== "function") return;
    let live = true;
    let stop: (() => void) | undefined;
    let reader: ReadableStreamDefaultReader<KeymapState> | undefined;

    void piloti.keyboard
      .keymaps()
      .then(async (res) => {
        const listening = res.match({ Ok: (l) => l, Err: () => null });
        if (!listening) return;
        if (!live) return listening.stop();
        stop = listening.stop;
        reader = listening.items.getReader();
        while (live) {
          const { done, value } = await reader.read();
          if (done || !live) break;
          setState({ active: value.active, keymaps: value.keymaps });
        }
      })
      .catch(() => undefined);

    return () => {
      live = false;
      void reader?.cancel().catch(() => undefined);
      stop?.();
    };
  }, [piloti, systemServices]);

  return state;
}
