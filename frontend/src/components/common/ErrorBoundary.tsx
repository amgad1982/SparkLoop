import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SparkLoop ErrorBoundary caught an unhandled error]:', error, errorInfo);
    this.setState({ errorInfo });

    // Send error report to logger if available
    try {
      fetch('/__client_error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error_boundary',
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }),
      }).catch(() => {});
    } catch {}
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      const isArabic =
        typeof document !== 'undefined' &&
        (document.documentElement.dir === 'rtl' ||
          localStorage.getItem('sparkloop-theme-storage')?.includes('"locale":"ar"'));

      return (
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="min-h-screen w-full bg-[#0b0f17] text-slate-100 flex items-center justify-center p-4 sm:p-6 select-none"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#131b28]/95 border border-rose-500/30 p-6 shadow-2xl backdrop-blur-xl space-y-5 text-center relative overflow-hidden">
            {/* Glow background accent */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/30">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">
                {isArabic ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isArabic
                  ? 'واجه التطبيق خطأً أثناء العرض. يمكنك محاولة إعادة التحميل أو إعادة ضبط الذاكرة المؤقتة.'
                  : 'An unexpected runtime error occurred while rendering the page. You can try refreshing or resetting your session cache.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/30"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إعادة تحميل' : 'Reload App'}</span>
              </button>
              <button
                onClick={this.handleResetCacheAndReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700/80"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{isArabic ? 'إعادة ضبط كاملة' : 'Clear Cache & Reload'}</span>
              </button>
            </div>

            {this.state.error && (
              <div className="pt-2 border-t border-slate-800/80 text-left rtl:text-right">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-300 py-1 transition-colors"
                >
                  <span>{isArabic ? 'التفاصيل التقنية' : 'Technical Details'}</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-2 p-3 rounded-lg bg-black/40 border border-slate-800 text-[10px] font-mono text-rose-300 overflow-x-auto max-h-48 text-left" dir="ltr">
                    <div className="font-bold text-rose-400">{this.state.error.name}: {this.state.error.message}</div>
                    {this.state.error.stack && (
                      <pre className="mt-2 text-slate-500 whitespace-pre-wrap leading-tight text-[9px]">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
