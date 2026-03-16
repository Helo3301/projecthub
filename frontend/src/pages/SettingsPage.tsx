import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Palette, Save, Moon, Sun } from 'lucide-react';
import { useStore } from '@/store';
import { users } from '@/lib/api';
import { useToast } from '@/components/Toast';

const avatarColors: { hex: string; name: string }[] = [
  { hex: '#EF4444', name: 'Red' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#F43F5E', name: 'Rose' },
];

export function SettingsPage() {
  const { user, setUser, darkMode, toggleDarkMode } = useStore();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#4F46E5');

  const isDirty = fullName !== (user?.full_name || '') || avatarColor !== (user?.avatar_color || '#4F46E5');

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string; avatar_color?: string }) =>
      users.updateMe(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      toast('Settings saved.', 'success');
    },
    onError: () => { toast('Failed to save settings. Please try again.'); },
  });

  const handleSave = () => {
    updateMutation.mutate({
      full_name: fullName || undefined,
      avatar_color: avatarColor,
    });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <User size={20} aria-hidden="true" />
            Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                id="settings-username"
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
            </div>

            <div>
              <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">Contact an admin to change your email</p>
            </div>

            <div>
              <label htmlFor="settings-full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                id="settings-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Palette size={20} aria-hidden="true" />
            Appearance
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dark Mode
              </p>
              <p id="dark-mode-desc" className="text-xs text-gray-400 mt-0.5">Switch between light and dark theme</p>
            </div>
            <button
              role="switch"
              aria-checked={darkMode}
              onClick={toggleDarkMode}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                darkMode ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
              aria-label="Dark mode"
              aria-describedby="dark-mode-desc"
            >
              <div
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center transition-transform ${
                  darkMode ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              >
                {darkMode ? <Moon size={14} className="text-indigo-600" aria-hidden="true" /> : <Sun size={14} className="text-yellow-500" aria-hidden="true" />}
              </div>
            </button>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avatar Color
            </p>
            <div className="flex items-center gap-4">
              <div
                role="img"
                aria-label={`Avatar preview for ${user?.full_name || user?.username || 'user'}`}
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: avatarColor }}
              >
                {user?.username?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-wrap gap-2">
                {avatarColors.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setAvatarColor(color.hex)}
                    aria-label={`Set avatar color to ${color.name}`}
                    aria-pressed={avatarColor === color.hex}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      avatarColor === color.hex
                        ? 'border-gray-800 dark:border-gray-100 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !isDirty}
            aria-busy={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? (
              'Saving...'
            ) : (
              <>
                <Save size={20} aria-hidden="true" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
