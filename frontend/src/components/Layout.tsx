import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ColorPicker } from './ColorPicker';
import { useStore } from '@/store';
import { projects as projectsApi, auth } from '@/lib/api';
import type { Project } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Partial<Project>) => void;
  project?: Project | null;
}

function ProjectModal({ isOpen, onClose, onSave, project }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366F1');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setColor(project.color || '#6366F1');
    } else {
      setName('');
      setDescription('');
      setColor('#6366F1');
    }
  }, [project, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description: description || undefined, color });
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <h2 id="project-modal-title" className="text-xl font-semibold mb-4">
          {project ? 'Edit Project' : 'New Project'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <ColorPicker
            value={color}
            onChange={(c) => setColor(c || '#6366F1')}
            allowNone={false}
          />
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              {project ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser, setProjects, setCurrentProject, currentProject } = useStore();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [navigate]);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    if (!user) {
      auth.me()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token');
          navigate('/login');
        });
    }
  }, [user, navigate, setUser]);

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (projects.length > 0) {
      setProjects(projects);
      if (!currentProject) {
        setCurrentProject(projects[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProject(newProject);
      setProjectModalOpen(false);
    },
  });

  const handleCreateProject = (data: Partial<Project>) => {
    createProjectMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white h-14 flex items-center px-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-800"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="ml-3 text-lg font-bold">
          Project<span className="text-indigo-400">Hub</span>
        </h1>
      </header>

      {/* Sidebar - desktop always visible, mobile slides in */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          projects={projects}
          onCreateProject={() => {
            setProjectModalOpen(true);
            closeMobileMenu();
          }}
          onNavigate={closeMobileMenu}
        />
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={closeMobileMenu}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-60 min-h-screen pt-14 lg:pt-0">
        <Outlet />
      </main>

      {/* Project Modal */}
      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSave={handleCreateProject}
      />
    </div>
  );
}
