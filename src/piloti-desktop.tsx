/// <reference types="@domicile-desktop/react/elements" />
import * as React from "react";
import {
  DomicileProvider,
  useDomicile,
} from "@domicile-desktop/react/domicile-provider";
import "./styles/globals.css";
import { mount } from "@domicile-desktop/react/mount";
import { Desktop as DesktopView } from "./components/shell/Desktop";
import { ShellErrorBoundary } from "./components/shell/ShellErrorBoundary";
import { createBrowserDomicile } from "./lib/engine-web";
import {
  hasNativeSystemHost,
  markNativeSystemHostAvailable,
  useEngineOverride,
} from "@/lib/engine/engine-override";

export function Desktop() {
  const initialDomicile = useDomicile();
  const initialNativeRef = React.useRef<boolean | null>(null);
  if (initialNativeRef.current === null) {
    const isBrowserHost =
      typeof window !== "undefined" &&
      Boolean(
        (window as { __PILOTI_BROWSER_HOST__?: boolean })
          .__PILOTI_BROWSER_HOST__,
      );
    if (!isBrowserHost) {
      markNativeSystemHostAvailable();
    }
    initialNativeRef.current = !isBrowserHost;
  }

  const override = useEngineOverride();
  const useWebEngine =
    !initialNativeRef.current || override === "web";

  if (typeof window !== "undefined" && hasNativeSystemHost()) {
    (window as { __PILOTI_BROWSER_HOST__?: boolean }).__PILOTI_BROWSER_HOST__ =
      useWebEngine;
  }

  const webDomicile = React.useMemo(() => {
    if (!initialNativeRef.current || !useWebEngine) return null;
    return createBrowserDomicile(initialDomicile.files);
  }, [initialDomicile, useWebEngine]);

  const activeDomicile =
    initialNativeRef.current && useWebEngine && webDomicile
      ? webDomicile
      : initialDomicile;
  const engineKey = useWebEngine ? "web" : "native";

  return (
    <ShellErrorBoundary>
      <DomicileProvider domicile={activeDomicile}>
        <DesktopView key={engineKey} />
      </DomicileProvider>
    </ShellErrorBoundary>
  );
}

export const Shell = mount(Desktop);
