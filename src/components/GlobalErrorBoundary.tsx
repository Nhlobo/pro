import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Global React error boundary. Catches render-time errors anywhere in the
 * tree and shows a branded fallback. Pair with `installGlobalErrorHandlers()`
 * for unhandled promise rejections / window errors.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[GlobalErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-2xl w-full bg-card border border-border rounded-lg shadow-sm p-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              An unexpected error occurred. Details below — please share these
              with the team if the problem persists.
            </p>
          </div>

          <details open className="mb-4 text-left">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer mb-2">
              Error details
            </summary>
            <pre className="text-xs bg-muted text-muted-foreground p-3 rounded overflow-auto max-h-60 whitespace-pre-wrap break-words">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          </details>

          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.reset}>
              Try again
            </Button>
            <Button onClick={() => window.location.assign("/")}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Install window-level handlers for uncaught errors and unhandled rejections.
 * Call once during app bootstrap.
 */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    console.error("[window.error]", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[unhandledrejection]", event.reason);
  });
}
