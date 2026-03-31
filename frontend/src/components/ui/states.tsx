/**
 * Shared UI state components — Loading, Error, Empty.
 *
 * Used consistently across all views to build user confidence:
 * - Loading: animated spinner with optional message
 * - Error: friendly message with retry button (never shows stack traces)
 * - Empty: helpful guidance on what to do next
 */
import { AlertCircle, Loader2, SearchX } from 'lucide-react';

// ============================================================
// Loading Spinner
// ============================================================

export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
}: {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: { icon: 16, text: 'text-xs' },
    md: { icon: 24, text: 'text-sm' },
    lg: { icon: 32, text: 'text-base' },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <Loader2 size={s.icon} className="animate-spin text-blue-500" />
      <p className={`${s.text} text-gray-500`}>{message}</p>
    </div>
  );
}

/**
 * Inline loading — smaller, for use within cards or table sections
 */
export function InlineLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-gray-400">
      <Loader2 size={14} className="animate-spin" />
      <span className="text-xs">{message}</span>
    </div>
  );
}


// ============================================================
// Error State
// ============================================================

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn\'t load this data. This might be a temporary issue.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 px-4 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Inline error — smaller, for use within cards
 */
export function InlineError({
  message = 'Failed to load',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-red-400">
      <AlertCircle size={14} />
      <span className="text-xs">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-blue-500 hover:underline ml-1">
          Retry
        </button>
      )}
    </div>
  );
}


// ============================================================
// Empty State
// ============================================================

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-3">
      {icon || <SearchX size={40} className="text-gray-300" />}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {message && <p className="text-xs text-gray-400 mt-1 max-w-md">{message}</p>}
      </div>
      {action}
    </div>
  );
}
