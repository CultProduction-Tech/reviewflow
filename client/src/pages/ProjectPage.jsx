import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import {
  Upload, Plus, ChevronLeft, FileText, Image, Video, Music, Globe, File,
  CheckCircle2, AlertCircle, Clock, MoreHorizontal, Trash2, Users, Settings,
  Calendar, FolderPlus, Eye, UploadCloud, X, UserPlus
} from 'lucide-react';

function FileIcon({ type, className = "w-5 h-5" }) {
  const icons = {
    image: <Image className={`${className} text-pink-500`} />,
    video: <Video className={`${className} text-purple-500`} />,
    audio: <Music className={`${className} text-orange-500`} />,
    pdf: <FileText className={`${className} text-red-500`} />,
    document: <FileText className={`${className} text-blue-500`} />,
    html: <Globe className={`${className} text-green-500`} />,
  };
  return icons[type] || <File className={`${className} text-gray-400`} />;
}

function ReviewStatus({ status, onClick }) {
  const configs = {
    approved: { label: 'Утверждено', class: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
    changes_requested: { label: 'Правки', class: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
    in_review: { label: 'На рецензии', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: Eye },
    pending: { label: 'Ожидает', class: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock },
  };
  const c = configs[status] || configs.pending;
  const Icon = c.icon;
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${c.class} hover:opacity-80 transition-opacity`}>
      <Icon className="w-3 h-3" />{c.label}
    </button>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

const actionLabels = {
  file_uploaded: 'загрузил файл',
  comment_added: 'добавил комментарий',
  review_decision: 'вынес решение',
};

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [sections, setSections] = useState([]);
  const [reviewerGroups, setReviewerGroups] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAddMember, setShowAddMember] = useState(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [activity, setActivity] = useState([]);

  const load = useCallback(() => {
    api.getProject(projectId)
      .then(data => {
        setProject(data.project);
        setSections(data.sections);
        setReviewerGroups(data.reviewerGroups);
        setFiles(data.files);
        setMembers(data.members);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getActivity(projectId).then(data => setActivity(data.activities)).catch(() => {});
  }, [projectId]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length === 0) return;
    await uploadFiles(droppedFiles);
  }, [projectId, sections]);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    await uploadFiles(selectedFiles);
  };

  const uploadFiles = async (fileList) => {
    setUploading(true);
    try {
      await api.uploadFiles(projectId, fileList, sections[0]?.id);
      load();
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId, e) => {
    e.stopPropagation();
    if (!confirm('Удалить этот файл?')) return;
    await api.deleteFile(fileId);
    load();
  };

  const handleAddGroup = async () => {
    await api.createReviewerGroup(projectId, { name: `Группа рецензентов ${reviewerGroups.length + 1}` });
    load();
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Удалить группу рецензентов?')) return;
    await api.deleteReviewerGroup(projectId, groupId);
    load();
  };

  const handleAddMember = async (groupId) => {
    if (!newMemberEmail.trim()) return;
    await api.addGroupMember(projectId, groupId, { email: newMemberEmail.trim() });
    setNewMemberEmail('');
    setShowAddMember(null);
    load();
  };

  const handleReviewAction = async (reviewId, action) => {
    if (action === 'approve') await api.submitDecision(reviewId, 'approved');
    else if (action === 'request_changes') await api.submitDecision(reviewId, 'changes_requested');
    else if (action === 'start') await api.startReview(reviewId);
    else if (action === 'reset') await api.resetReview(reviewId);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!project) return null;

  return (
    <div
      className={`h-full flex flex-col ${dragActive ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* Шапка */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          {project.status === 'archived' && (
            <span className="badge-pending">Архив</span>
          )}
        </div>
        {project.description && <p className="text-sm text-gray-500 ml-9">{project.description}</p>}
        <div className="flex items-center gap-4 mt-3 ml-9">
          <label className="btn-primary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />Загрузить файлы
            <input type="file" multiple className="hidden" onChange={handleFileSelect} />
          </label>
          <button onClick={() => handleAddGroup()} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" />Добавить группу
          </button>
          {project.due_date && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />Дедлайн: {new Date(project.due_date).toLocaleDateString('ru')}
            </span>
          )}
        </div>
      </div>

      {/* Оверлей при перетаскивании */}
      {dragActive && (
        <div className="absolute inset-0 z-40 bg-primary-500/10 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <UploadCloud className="w-12 h-12 text-primary-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-900">Перетащите файлы для загрузки</p>
          </div>
        </div>
      )}

      {/* Таблица файлов с колонками рецензентов */}
      <div className="flex-1 overflow-auto">
        {files.length === 0 && !uploading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <div className="drop-zone max-w-md w-full mx-auto">
              <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Перетащите файлы сюда</p>
              <p className="text-sm text-gray-400 mt-1">или нажмите кнопку «Загрузить файлы» выше</p>
              <p className="text-xs text-gray-400 mt-3">Поддерживаются изображения, видео, PDF, документы, презентации, аудио</p>
            </div>
          </div>
        ) : (
          <div className="min-w-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                    Файл
                  </th>
                  {reviewerGroups.map(group => (
                    <th key={group.id} className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <span>{group.name}</span>
                        <button onClick={() => setShowAddMember(showAddMember === group.id ? null : group.id)}
                          className="p-0.5 rounded hover:bg-gray-200 ml-1" title="Добавить рецензента">
                          <UserPlus className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteGroup(group.id)}
                          className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500" title="Удалить группу">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Участники */}
                      <div className="flex items-center justify-center gap-1 mt-1.5">
                        {group.members.map(m => (
                          <span key={m.id} className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-[9px] flex items-center justify-center font-bold"
                            title={m.name || m.email}>
                            {(m.name || m.email)[0].toUpperCase()}
                          </span>
                        ))}
                      </div>
                      {/* Добавление участника */}
                      {showAddMember === group.id && (
                        <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                          <input value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)}
                            className="input text-xs py-1" placeholder="email..." onKeyDown={e => e.key === 'Enter' && handleAddMember(group.id)} />
                          <button onClick={() => handleAddMember(group.id)} className="btn-primary text-xs py-1 px-2">OK</button>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {uploading && (
                  <tr>
                    <td colSpan={reviewerGroups.length + 2} className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        Загрузка файлов...
                      </div>
                    </td>
                  </tr>
                )}
                {files.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50 cursor-pointer group"
                    onClick={() => navigate(`/projects/${projectId}/files/${file.id}`)}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {file.thumbnail_path ? (
                          <img src={`/api/uploads/${file.thumbnail_path}`} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <FileIcon type={file.file_type} />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            v{file.latest_version || 1} · {formatSize(file.file_size || 0)} · {file.uploader_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    {reviewerGroups.map(group => {
                      const review = file.reviews?.[group.id];
                      return (
                        <td key={group.id} className="px-4 py-3 text-center">
                          {review ? (
                            <div className="flex flex-col items-center gap-1">
                              <ReviewStatus status={review.status} onClick={(e) => {
                                e.stopPropagation();
                                if (review.status === 'pending') handleReviewAction(review.id, 'start');
                                else if (review.status === 'in_review') handleReviewAction(review.id, 'approve');
                              }} />
                              {review.status === 'in_review' && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); handleReviewAction(review.id, 'approve'); }}
                                    className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200" title="Утвердить">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleReviewAction(review.id, 'request_changes'); }}
                                    className="p-1 rounded bg-orange-100 text-orange-600 hover:bg-orange-200" title="Запросить правки">
                                    <AlertCircle className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              {(review.status === 'approved' || review.status === 'changes_requested') && (
                                <button onClick={(e) => { e.stopPropagation(); handleReviewAction(review.id, 'reset'); }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Сбросить
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2" onClick={e => e.stopPropagation()}>
                      <button onClick={(e) => handleDeleteFile(file.id, e)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Лента активности */}
      {activity.length > 0 && (
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex-shrink-0 max-h-32 overflow-auto">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Последняя активность</p>
          <div className="space-y-1">
            {activity.slice(0, 5).map(a => (
              <p key={a.id} className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{a.user_name}</span>
                {' '}{actionLabels[a.action] || a.action.replace(/_/g, ' ')}
                {' '}<span className="text-gray-400">{new Date(a.created_at).toLocaleString('ru')}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
