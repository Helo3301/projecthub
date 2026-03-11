import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ColorPicker } from './ColorPicker';
import { useToast } from './Toast';
import { useStore } from '@/store';
import { projects as projectsApi, auth } from '@/lib/api';
import type { Project } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Partial<Project>) => void;
  project?: Project | null;
  isPending?: boolean;
}

function ProjectModal({ isOpen, onClose, onSave, project, isPending = false }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366F1');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setName(project.name);
        setDescription(project.description || '');
        setColor(project.color || '#6366F1');
      } else {
        setName('');
        setDescription('');
        setColor('#6366F1');
      }
      // Focus first interactive element on open
      requestAnimationFrame(() => {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.[0]?.focus();
      });
    }
  }, [project, isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!isPending) onClose();
      return;
    }
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose, isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description: description || undefined, color });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      <div className="absolute inset-0 bg-black/50" onClick={!isPending ? onClose : undefined} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <h2 id="project-modal-title" className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {project ? 'Edit Project' : 'New Project'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
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
              disabled={isPending}
              className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 px-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : (project ? 'Update' : 'Create')}
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
  const { toast } = useToast();
  const { user, setUser, setProjects, setCurrentProject, currentProject, darkMode } = useStore();

  // Apply dark class on mount from persisted state
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    if (!user) {
      let cancelled = false;
      auth.me()
        .then((u) => { if (!cancelled) setUser(u); })
        .catch((err) => {
          if (cancelled) return;
          // Only redirect on auth failures, not transient network errors
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            localStorage.removeItem('token');
            navigate('/login');
          }
          // For network errors or 5xx, keep user on page — token is still valid
        });
      return () => { cancelled = true; };
    }
  }, [user, navigate, setUser]);

  // Fetch projects
  const { data: projects = [], dataUpdatedAt } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!dataUpdatedAt) return; // Skip until query has actually resolved
    setProjects(projects);
    // Read currentProject from store directly to avoid stale closure
    const current = useStore.getState().currentProject;
    if (projects.length === 0) {
      if (current) setCurrentProject(null);
    } else if (!current || !projects.find((p) => p.id === current.id)) {
      setCurrentProject(projects[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, dataUpdatedAt]);

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCurrentProject(newProject);
      setProjectModalOpen(false);
      toast('Project created successfully.', 'success');
    },
    onError: () => {
      toast('Failed to create project. Please try again.');
    },
  });

  const handleCreateProject = (data: Partial<Project>) => {
    createProjectMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100 transition-colors">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white h-14 flex items-center px-4">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-800"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
        <h1 className="ml-3 text-lg font-bold">
          Project<span className="text-indigo-400">Hub</span>
        </h1>
      </header>

      {/* Sidebar - desktop always visible, mobile slides in */}
      <div
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
      </div>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          aria-hidden="true"
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
        isPending={createProjectMutation.isPending}
      />
    </div>
  );
}
