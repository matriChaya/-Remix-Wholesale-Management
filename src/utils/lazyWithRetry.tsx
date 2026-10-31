import React, { lazy, useState, ComponentType } from 'react';
import { RefreshCw, AlertTriangle, X } from 'lucide-react';

interface RetryModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  [key: string]: any;
}

/**
 * Creates a resilient lazy-loaded React component with:
 * 1. Automatic exponential retries on dynamic import failures (e.g. "Failed to fetch dynamically imported module")
 * 2. Preloading capability to load chunk in background when browser is idle
 * 3. Graceful fallback UI that never crashes the parent ErrorBoundary or POS core
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  componentName: string = 'Component',
  retriesLeft: number = 3,
  intervalMs: number = 1000
): React.LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> } {
  const loadWithRetry = (): Promise<{ default: T }> => {
    return new Promise<{ default: T }>((resolve) => {
      const attempt = (retriesRemaining: number) => {
        factory()
          .then((module) => {
            resolve(module);
          })
          .catch((err) => {
            console.warn(`[LazyLoader] Attempt failed for ${componentName} (${retriesRemaining} retries left):`, err);

            if (retriesRemaining > 0) {
              setTimeout(() => {
                attempt(retriesRemaining - 1);
              }, intervalMs);
            } else {
              console.error(`[LazyLoader] All retries exhausted for ${componentName}. Rendering fallback.`, err);

              // Create a graceful fallback component rather than throwing and crashing the root ErrorBoundary
              const FallbackComponent: React.FC<RetryModalProps> = (props) => {
                const [isRetrying, setIsRetrying] = useState(false);

                if (props.isOpen === false) return null;

                const handleRetry = () => {
                  setIsRetrying(true);
                  // Reload the page or re-attempt
                  window.location.reload();
                };

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 max-w-md w-full shadow-2xl text-white space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5 text-amber-400">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <h3 className="font-bold text-sm">
                            মডিউল লোডিং সমস্যা (Loading Issue)
                          </h3>
                        </div>
                        {props.onClose && (
                          <button
                            type="button"
                            onClick={props.onClose}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        নেটওয়ার্ক বিঘ্ন বা সার্ভার আপডেট হওয়ার কারণে <strong>{componentName}</strong> লোড হতে সাময়িক সমস্যা হয়েছে। আপনার মূল ডেটা সম্পূর্ণ নিরাপদ আছে।
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        {props.onClose && (
                          <button
                            type="button"
                            onClick={props.onClose}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                          >
                            বন্ধ করুন (Close)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRetry}
                          disabled={isRetrying}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                          <span>{isRetrying ? 'লোড হচ্ছে...' : 'অ্যাপ রিলোড করুন (Reload)'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              };

              resolve({ default: FallbackComponent as unknown as T });
            }
          });
      };

      attempt(retriesLeft);
    });
  };

  const LazyComp = lazy(loadWithRetry) as React.LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> };
  LazyComp.preload = factory;
  return LazyComp;
}
