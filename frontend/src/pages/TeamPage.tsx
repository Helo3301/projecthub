import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Shield, UserPlus } from 'lucide-react';
import { users } from '@/lib/api';
import type { UserBrief } from '@/types';

export function TeamPage() {
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-gray-500">Manage your team members</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Members ({teamMembers.length})
            </h2>
            <Link
              to="/team/add"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <UserPlus size={18} />
              Add User
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {teamMembers.length > 0 ? (
            teamMembers.map((member: UserBrief) => (
              <div key={member.id} className="p-4 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                  style={{ backgroundColor: member.avatar_color || '#4F46E5' }}
                >
                  {member.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {member.full_name || member.username}
                  </div>
                  <div className="text-sm text-gray-500">@{member.username}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Shield size={16} />
                  <span>Member</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No team members yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
