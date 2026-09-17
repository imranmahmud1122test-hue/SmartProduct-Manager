import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Application Crash Caught by ErrorBoundary]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetToHome = () => {
    window.location.href = '/';
  };

  private handleClearCache = () => {
    try {
      localStorage.removeItem('spm_current_user');
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              The application encountered an unexpected issue. You can reload the page or return to the main dashboard to continue without losing your business data.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-slate-100 rounded-xl text-left font-mono text-[11px] text-slate-700 overflow-x-auto border border-slate-200 max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>

              <button
                onClick={this.handleResetToHome}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Home
              </button>

              <button
                onClick={this.handleClearCache}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Session Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
