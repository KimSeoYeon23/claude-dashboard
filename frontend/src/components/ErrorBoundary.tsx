import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { reportError } from "../api";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError("render_crash", error.message, {
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
          <div className="glass-card max-w-md p-8 text-center">
            <p className="text-lg font-semibold text-red">오류가 발생했습니다</p>
            <p className="mt-2 text-sm text-text-secondary">
              {this.state.error?.message || "알 수 없는 오류"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
