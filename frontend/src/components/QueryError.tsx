import { AlertTriangle, RefreshCw } from 'lucide-react';

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({ message = 'Failed to load data', onRetry }: QueryErrorProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle size={22} className="text-red-500" aria-hidden="true" />
        </div>
        <p role="alert" className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
