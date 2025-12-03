import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Palette, Save, Check } from 'lucide-react';
import { useStore } from '@/store';
import { users } from '@/lib/api';

const avatarColors = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E',
];

export function SettingsPage() {
  const { user, setUser } = useStore();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#4F46E5');
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string; avatar_color?: string }) =>
      users.updateMe(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User size={20} />
            Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Palette size={20} />
            Appearance
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar Color
            </label>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: avatarColor }}
              >
                {user?.username?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-wrap gap-2">
                {avatarColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      avatarColor === color
                        ? 'border-gray-800 scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
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
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saved ? (
              <>
                <Check size={20} />
                Saved!
              </>
            ) : updateMutation.isPending ? (
              'Saving...'
            ) : (
              <>
                <Save size={20} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
