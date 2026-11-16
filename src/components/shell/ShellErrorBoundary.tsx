import * as React from "react";

interface ShellErrorBoundaryState {
  error: Error | null;
}

function formatErrorDetails(error: Error): string {
  return error.stack || error.message || String(error);
}

/**
 * Full-screen recovery BSOD catching runtime and lazy-chunk errors inside the
 * shell before `@domicile-desktop/react`'s bare `FailureBoundary` can brick the UI.
 */
export class ShellErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ShellErrorBoundaryState
> {
  state: ShellErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ShellErrorBoundaryState {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  componentDidMount() {
    window.addEventListener("vite:preloadError", this.handlePreloadError);
    window.addEventListener("residence:bsod", this.handlePreloadError);
  }

  componentWillUnmount() {
    window.removeEventListener("vite:preloadError", this.handlePreloadError);
    window.removeEventListener("residence:bsod", this.handlePreloadError);
  }

  private handlePreloadError = (event: Event) => {
    const custom = event as CustomEvent<Error>;
    const err =
      custom.detail instanceof Error
        ? custom.detail
        : new Error("Failed to load a dynamically imported shell module.");
    this.setState({ error: err });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("piloti.dock-icons")) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.clear();
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError =
      /dynamically imported module|loading chunk|preload/i.test(error.message);

    return (
      <div
        role="alert"
        className="fixed inset-0 z-[99999] flex flex-col justify-center bg-[#1a5fb4] px-8 py-12 text-white select-text sm:px-16 lg:px-28"
      >
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="text-[72px] leading-none font-light tracking-tight select-none">
            :(
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Piloti Shell ran into a problem and needs to reload.
            </h1>
            <p className="text-sm leading-relaxed text-white/85 sm:text-base">
              {isChunkError
                ? "A shell module could not be fetched (often caused by a rebuild while the session was running). Reloading the shell will load the updated bundle."
                : "An unexpected error occurred while rendering the desktop shell."}
            </p>
          </div>

          <pre className="max-h-52 overflow-auto rounded-lg border border-white/20 bg-black/25 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-white/90">
            {formatErrorDetails(error)}
          </pre>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              autoFocus
              onClick={this.handleReload}
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#1a5fb4] shadow-sm active:brightness-90"
            >
              Reload Shell
            </button>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="rounded-md border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-medium text-white active:bg-white/20"
            >
              Clear Cache &amp; Reload
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md border border-white/20 px-4 py-2.5 text-sm font-medium text-white/85 active:bg-white/10"
            >
              Try to Continue
            </button>
          </div>
        </div>
      </div>
    );
  }
}

