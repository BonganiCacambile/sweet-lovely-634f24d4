import { Component, type ReactNode } from "react";

/**
 * Local error boundary for Framer/unframer subtrees.
 *
 * Unframer occasionally throws during hydration when its internal container
 * ref hasn't attached yet (e.g. "Cannot read properties of undefined (reading
 * 'addEventListener')"). Without a local boundary that error bubbles to the
 * root route's `errorComponent` and the entire page renders the generic
 * "This page didn't load" fallback. Wrapping every Framer usage in this
 * boundary keeps the rest of the page functional and silently drops the
 * broken widget instead of tearing down the app.
 */
export class FramerBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Log so we can observe if this ever fires, but don't propagate.
    console.warn("[FramerBoundary] suppressed framer render error:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
