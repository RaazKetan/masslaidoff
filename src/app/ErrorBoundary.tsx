import { Component, type ErrorInfo, type ReactNode } from "react";
import { Logo } from "../components/core";

function isChunkLoadError(error: Error) {
  return (
    error.name === "ChunkLoadError" ||
    /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
      error.message,
    )
  );
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error", error, info);
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    return (
      <main className="not-found">
        <Logo />
        <p className="eyebrow">SOMETHING WENT WRONG</p>
        <h1>This page could not be loaded.</h1>
        <p>
          {stale
            ? "A new version of MassLaidOff is available. Reload to continue."
            : error.message}
        </p>
        {stale ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        ) : (
          // Full page load so the boundary resets.
          <a href="/" className="button button-primary">
            Return home
          </a>
        )}
      </main>
    );
  }
}
