import { FolderOpen } from 'lucide-react';

interface EmptyProjectStateProps {
  feature: string;
}

export function EmptyProjectState({ feature }: EmptyProjectStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-2rem)]">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FolderOpen size={28} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">No Project Selected</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">
          Select a project from the sidebar to view {feature}
        </p>
      </div>
    </div>
  );
}
