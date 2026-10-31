import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModalErrorBoundary extends Component<Props, State> {
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
    console.error('[ModalErrorBoundary] Caught modal exception:', error, errorInfo);
    const msg = error?.message?.toLowerCase() || '';
    if (
      msg.includes('null (reading \'usestate\')') ||
      msg.includes('invalid hook call') ||
      msg.includes('failed to fetch dynamically imported module')
    ) {
      const now = Date.now();
      const last = Number(sessionStorage.getItem('last_sw_reload') || '0');
      if (now - last > 6000) {
        sessionStorage.setItem('last_sw_reload', String(now));
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const r of registrations) r.unregister();
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm">
                  {this.props.title || 'মডেল প্রদর্শন সাময়িক সমস্যা'}
                </h3>
              </div>
              {this.props.onReset && (
                <button
                  type="button"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    this.props.onReset?.();
                  }}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              এই উইন্ডোটি খোলার সময় একটি সাময়িক ত্রুটি ঘটেছে। আপনার সেলস ও স্টক সংক্রান্ত মূল ডেটা অক্ষত আছে।
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              {this.props.onReset && (
                <button
                  type="button"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    this.props.onReset?.();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  বন্ধ করুন (Close)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>রিফ্রেশ করুন (Refresh)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
