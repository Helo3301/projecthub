import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, GanttChart, Calendar, FolderOpen,
  Plus, Settings, Users, ChevronDown, LogOut, Bot
} from 'lucide-react';
import { useStore } from '@/store';
import type { Project } from '@/types';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Kanban, label: 'Kanban', path: '/kanban' },
  { icon: GanttChart, label: 'Gantt', path: '/gantt' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
];

interface SidebarProps {
  projects: Project[];
  onCreateProject: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ projects, onCreateProject, onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, currentProject, setCurrentProject } = useStore();
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-screen">
      {/* Logo - hidden on mobile since we have header */}
      <div className="hidden lg:block p-5 border-b border-gray-700">
        <h1 className="text-xl font-bold">
          Project<span className="text-indigo-400">Hub</span>
        </h1>
      </div>
      {/* Spacer for mobile to account for header */}
      <div className="lg:hidden h-14" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 text-xs uppercase text-gray-500 tracking-wider">Main</div>
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Projects */}
        <div className="mt-6">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            aria-expanded={projectsExpanded}
            aria-label="Toggle projects section"
            className="w-full flex items-center justify-between px-4 mb-2 text-xs uppercase text-gray-500 tracking-wider hover:text-gray-300"
          >
            <span>Projects</span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`transition-transform ${projectsExpanded ? '' : '-rotate-90'}`}
            />
          </button>
          {projectsExpanded && (
            <ul className="space-y-1 px-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    onClick={() => {
                      setCurrentProject(project);
                      onNavigate?.();
                    }}
                    aria-pressed={currentProject?.id === project.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      currentProject?.id === project.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate" title={project.name}>{project.name}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={onCreateProject}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Plus size={20} aria-hidden="true" />
                  <span>New Project</span>
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Agents */}
        <div className="mt-6">
          <div className="px-4 mb-2 text-xs uppercase text-gray-500 tracking-wider">AI</div>
          <ul className="space-y-1 px-2">
            <li>
              <Link
                to="/agents"
                onClick={onNavigate}
                aria-current={location.pathname === '/agents' ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === '/agents'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Bot size={20} aria-hidden="true" />
                <span>Agents</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Settings */}
        <div className="mt-6">
          <div className="px-4 mb-2 text-xs uppercase text-gray-500 tracking-wider">Settings</div>
          <ul className="space-y-1 px-2">
            <li>
              <Link
                to="/team"
                onClick={onNavigate}
                aria-current={location.pathname === '/team' ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === '/team'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Users size={20} aria-hidden="true" />
                <span>Team</span>
              </Link>
            </li>
            <li>
              <Link
                to="/settings"
                onClick={onNavigate}
                aria-current={location.pathname === '/settings' ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === '/settings'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings size={20} aria-hidden="true" />
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <div
            role="img"
            aria-label={user?.full_name || user?.username || 'User avatar'}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: user?.avatar_color || '#4F46E5' }}
          >
            {user?.username?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" title={user?.full_name || user?.username}>{user?.full_name || user?.username}</div>
            <div className="text-sm text-gray-400 truncate" title={user?.email}>{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
