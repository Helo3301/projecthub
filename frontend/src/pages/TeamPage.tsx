import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Shield, UserPlus } from 'lucide-react';
import { users } from '@/lib/api';
import { QueryError } from '@/components/QueryError';
import type { UserBrief } from '@/types';

function MemberRow({ member }: { member: UserBrief }) {
  return (
    <div role="listitem" className="p-4 flex items-center gap-4">
      <div
        role="img"
        aria-label={member.full_name || member.username}
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
        style={{ backgroundColor: member.avatar_color || '#4F46E5' }}
      >
        {member.username.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {member.full_name || member.username}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">@{member.username}</div>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Shield size={16} aria-hidden="true" />
        <span>Member</span>
      </div>
    </div>
  );
}

export function TeamPage() {
  const { data: teamMembers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your team members</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {isLoading ? 'Members' : `Members (${teamMembers.length})`}
            </h2>
            <Link
              to="/team/add"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <UserPlus size={18} aria-hidden="true" />
              Add User
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))
          ) : isError && !teamMembers.length ? (
            <QueryError message="Failed to load team members" onRetry={refetch} />
          ) : (
            <>
              {isError && teamMembers.length > 0 && (
                <div role="alert" className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm flex items-center justify-between">
                  <span>Failed to refresh — showing cached data</span>
                  <button onClick={() => refetch()} className="underline hover:no-underline">Retry</button>
                </div>
              )}
              {teamMembers.length > 0 ? (
                <div role="list">
                  {teamMembers.map((member: UserBrief) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Users size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-500" aria-hidden="true" />
                  <p>No team members yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
