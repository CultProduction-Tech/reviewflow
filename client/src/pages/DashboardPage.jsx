import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  Plus, FolderOpen, MoreHorizontal, FileText, Users, Calendar,
  CheckCircle2, AlertCircle, Clock, Trash2, Archive, ChevronRight
} from 'lucide-react';
import CreateProjectModal from '../components/CreateProjectModal';

export default function DashboardPage() {
  const [projects, setProjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [filter, setFilter] = useState('active');
  const navigate = useNavigate();

  const load = () => {
    Promise.all([api.getProjects(), api.getFolders()])
      .then(([p, f]) => { setProjects(p.projects); setFolders(f.folders); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filteredProjects = projects.filter(p => {
    if (filter === 'active') return p.status === 'active';
    if (filter === 'archived') return p.status === 'archived';
    return true;
  });

  const handleDelete = async (id) => {
    if (!confirm('Удалить проект и все его файлы?')) return;
    await api.deleteProject(id);
    load();
    setContextMenu(null);
  };

  const handleArchive = async (id) => {
    await api.updateProject(id, { status: 'archived' });
    load();
    setContextMenu(null);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Проекты</h1>
          <p className="text-sm text-gray-500 mt-1">{filteredProjects.length} проект{filteredProjects.length === 1 ? '' : filteredProjects.length < 5 ? 'а' : 'ов'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Новый проект
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'active', label: 'Активные' },
          { key: 'archived', label: 'Архив' },
          { key: 'all', label: 'Все' }
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Сетка проектов */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Пока нет проектов</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
            Создать первый проект
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                    {project.name}
                  </h3>
                  <button
                    className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu === project.id ? null : project.id); }}
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
                )}

                {/* Статистика */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{project.file_count} файл.</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{project.reviewer_group_count} групп</span>
                  {project.due_date && (
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(project.due_date).toLocaleDateString('ru')}</span>
                  )}
                </div>

                {/* Статусы рецензий */}
                <div className="flex items-center gap-2">
                  {project.approved_count > 0 && (
                    <span className="badge-approved flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />{project.approved_count}
                    </span>
                  )}
                  {project.changes_requested_count > 0 && (
                    <span className="badge-changes flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{project.changes_requested_count}
                    </span>
                  )}
                  {project.pending_count > 0 && (
                    <span className="badge-pending flex items-center gap-1">
                      <Clock className="w-3 h-3" />{project.pending_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Контекстное меню */}
              {contextMenu === project.id && (
                <div className="border-t border-gray-100 p-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleArchive(project.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm hover:bg-gray-100 text-gray-600">
                    <Archive className="w-3.5 h-3.5" />В архив
                  </button>
                  <button onClick={() => handleDelete(project.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm hover:bg-red-50 text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}
