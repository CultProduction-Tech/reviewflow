import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, ChevronRight, MessageSquare, Send, CheckCircle2, AlertCircle,
  Clock, X, Upload, Eye, RotateCcw, Check, Maximize2, ZoomIn, ZoomOut,
  Download, MoreHorizontal, Trash2, Reply
} from 'lucide-react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FileViewerPage() {
  const { projectId, fileId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [compareVersion, setCompareVersion] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [pendingPin, setPendingPin] = useState(null);
  const [selectedComment, setSelectedComment] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [reviewerGroups, setReviewerGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const viewerRef = useRef(null);
  const videoRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const fileData = await api.getFile(fileId);
      setFile(fileData.file);
      setVersions(fileData.versions);
      if (fileData.versions.length > 0) {
        const latest = fileData.versions[0];
        setCurrentVersion(latest);
      }
      const projData = await api.getProject(projectId);
      setReviewerGroups(projData.reviewerGroups);
    } catch {
      navigate(`/projects/${projectId}`);
    } finally {
      setLoading(false);
    }
  }, [fileId, projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (currentVersion) {
      api.getComments(currentVersion.id, selectedGroup).then(data => setComments(data.comments)).catch(() => {});
    }
  }, [currentVersion, selectedGroup]);

  const handleViewerClick = (e) => {
    if (!annotationMode || !viewerRef.current) return;
    const rect = viewerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setAnnotationMode(false);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !currentVersion) return;
    const data = {
      content: newComment.trim(),
      reviewer_group_id: selectedGroup || undefined,
      parent_id: replyTo || undefined,
    };
    if (pendingPin && !replyTo) {
      data.pos_x = pendingPin.x;
      data.pos_y = pendingPin.y;
    }
    if (videoRef.current && !replyTo) {
      data.time_marker = videoRef.current.currentTime;
    }
    await api.addComment(currentVersion.id, data);
    setNewComment('');
    setPendingPin(null);
    setReplyTo(null);
    const res = await api.getComments(currentVersion.id, selectedGroup);
    setComments(res.comments);
  };

  const handleResolve = async (commentId, resolved) => {
    await api.updateComment(commentId, { is_resolved: resolved });
    const res = await api.getComments(currentVersion.id, selectedGroup);
    setComments(res.comments);
  };

  const handleDeleteComment = async (commentId) => {
    await api.deleteComment(commentId);
    const res = await api.getComments(currentVersion.id, selectedGroup);
    setComments(res.comments);
  };

  const handleUploadVersion = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.uploadVersion(fileId, file);
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!file || !currentVersion) return null;

  const fileUrl = `/api/uploads/${currentVersion.file_path}`;
  const isImage = currentVersion.file_type === 'image';
  const isVideo = currentVersion.file_type === 'video';
  const isAudio = currentVersion.file_type === 'audio';
  const isPdf = currentVersion.file_type === 'pdf';

  return (
    <div className="h-full flex flex-col">
      {/* Верхняя панель */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={`/projects/${projectId}`} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{file.name}</h2>
            <p className="text-xs text-gray-500">Версия {currentVersion.version_number} из {versions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Выбор версии */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              disabled={currentVersion.version_number <= 1}
              onClick={() => {
                const prev = versions.find(v => v.version_number === currentVersion.version_number - 1);
                if (prev) setCurrentVersion(prev);
              }}
              className="p-1 rounded hover:bg-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={currentVersion.id}
              onChange={e => setCurrentVersion(versions.find(v => v.id === e.target.value))}
              className="bg-transparent text-xs font-medium px-1 outline-none"
            >
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.version_number}</option>
              ))}
            </select>
            <button
              disabled={currentVersion.version_number >= versions.length}
              onClick={() => {
                const next = versions.find(v => v.version_number === currentVersion.version_number + 1);
                if (next) setCurrentVersion(next);
              }}
              className="p-1 rounded hover:bg-white disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Сравнение версий */}
          {versions.length > 1 && (
            <select
              value={compareVersion?.id || ''}
              onChange={e => setCompareVersion(e.target.value ? versions.find(v => v.id === e.target.value) : null)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1"
            >
              <option value="">Сравнить с...</option>
              {versions.filter(v => v.id !== currentVersion.id).map(v => (
                <option key={v.id} value={v.id}>v{v.version_number}</option>
              ))}
            </select>
          )}

          {/* Масштаб */}
          {isImage && (
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1 rounded hover:bg-gray-100">
                <ZoomOut className="w-4 h-4 text-gray-500" />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-gray-100">
                <ZoomIn className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}

          <a href={fileUrl} download className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Скачать">
            <Download className="w-4 h-4" />
          </a>

          <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />Новая версия
            <input type="file" className="hidden" onChange={handleUploadVersion} />
          </label>

          <button
            onClick={() => setShowComments(!showComments)}
            className={`p-1.5 rounded transition-colors ${showComments ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Комментарии"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className="flex-1 flex overflow-hidden">
        {/* Просмотрщик файла */}
        <div className={`flex-1 overflow-auto bg-gray-100 flex items-center justify-center relative`}>
          {compareVersion ? (
            <div className="flex w-full h-full">
              <div className="flex-1 flex items-center justify-center p-4 border-r border-gray-300 relative">
                <p className="absolute top-2 left-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded">v{currentVersion.version_number}</p>
                {isImage && <img src={fileUrl} className="max-w-full max-h-full object-contain" />}
              </div>
              <div className="flex-1 flex items-center justify-center p-4 relative">
                <p className="absolute top-2 left-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded">v{compareVersion.version_number}</p>
                {isImage && <img src={`/api/uploads/${compareVersion.file_path}`} className="max-w-full max-h-full object-contain" />}
              </div>
            </div>
          ) : (
            <div
              ref={viewerRef}
              className={`relative ${annotationMode ? 'cursor-crosshair' : ''}`}
              onClick={handleViewerClick}
            >
              {isImage && (
                <img
                  src={fileUrl}
                  className="max-w-full max-h-full object-contain transition-transform"
                  style={{ transform: `scale(${zoom})` }}
                  draggable={false}
                />
              )}
              {isVideo && (
                <video ref={videoRef} src={fileUrl} controls className="max-w-full max-h-[80vh]">
                  Ваш браузер не поддерживает воспроизведение видео.
                </video>
              )}
              {isAudio && (
                <div className="p-8 bg-white rounded-xl shadow">
                  <audio ref={videoRef} src={fileUrl} controls className="w-96" />
                </div>
              )}
              {isPdf && (
                <iframe src={fileUrl} className="w-full h-full min-h-[80vh]" style={{ minWidth: '60vw' }} />
              )}
              {!isImage && !isVideo && !isAudio && !isPdf && (
                <div className="p-8 bg-white rounded-xl shadow text-center">
                  <p className="text-gray-500">Предпросмотр недоступен для этого типа файла</p>
                  <a href={fileUrl} download className="btn-primary mt-4 inline-block">Скачать файл</a>
                </div>
              )}

              {/* Пины аннотаций */}
              {isImage && comments.filter(c => c.pos_x != null).map((c, i) => (
                <div
                  key={c.id}
                  className={`annotation-pin ${selectedComment === c.id ? 'ring-2 ring-primary-300 bg-primary-700' : ''} ${c.is_resolved ? 'opacity-40' : ''}`}
                  style={{ left: `${c.pos_x}%`, top: `${c.pos_y}%` }}
                  onClick={(e) => { e.stopPropagation(); setSelectedComment(selectedComment === c.id ? null : c.id); }}
                >
                  {i + 1}
                </div>
              ))}

              {/* Новый пин */}
              {pendingPin && (
                <div className="annotation-pin bg-orange-500 animate-pulse" style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}>
                  ?
                </div>
              )}
            </div>
          )}
        </div>

        {/* Панель комментариев */}
        {showComments && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Комментарии ({comments.length})</h3>
                <button
                  onClick={() => { setAnnotationMode(!annotationMode); setPendingPin(null); }}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${annotationMode ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {annotationMode ? 'Кликните на файл...' : '+ Пин'}
                </button>
              </div>

              {/* Фильтр по группе */}
              {reviewerGroups.length > 0 && (
                <select
                  value={selectedGroup || ''}
                  onChange={e => setSelectedGroup(e.target.value || null)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1"
                >
                  <option value="">Все группы</option>
                  {reviewerGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}

              {/* Кнопки утверждения */}
              {currentVersion && currentVersion.reviews?.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {currentVersion.reviews.map(r => (
                    <div key={r.id} className="flex-1">
                      <p className="text-[10px] text-gray-400 truncate mb-0.5">{r.group_name}</p>
                      <div className="flex gap-1">
                        <button onClick={() => api.submitDecision(r.id, 'approved').then(load)}
                          className="flex-1 py-1 rounded text-[10px] bg-green-50 text-green-600 hover:bg-green-100" title="Утвердить">
                          <CheckCircle2 className="w-3 h-3 mx-auto" />
                        </button>
                        <button onClick={() => api.submitDecision(r.id, 'changes_requested').then(load)}
                          className="flex-1 py-1 rounded text-[10px] bg-orange-50 text-orange-600 hover:bg-orange-100" title="Нужны правки">
                          <AlertCircle className="w-3 h-3 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Список комментариев */}
            <div className="flex-1 overflow-auto">
              {comments.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  Пока нет комментариев
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {comments.map((comment, idx) => (
                    <div
                      key={comment.id}
                      className={`p-3 hover:bg-gray-50 transition-colors ${selectedComment === comment.id ? 'bg-primary-50' : ''} ${comment.is_resolved ? 'opacity-50' : ''}`}
                      onClick={() => setSelectedComment(comment.id)}
                    >
                      <div className="flex items-start gap-2">
                        {comment.pos_x != null && (
                          <span className="w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-900">{comment.user_name || 'Неизвестный'}</span>
                            <div className="flex items-center gap-1">
                              {comment.time_marker != null && (
                                <span className="text-[10px] text-gray-400">{formatTime(comment.time_marker)}</span>
                              )}
                              <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleString('ru')}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.content}</p>

                          {/* Действия */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <button onClick={(e) => { e.stopPropagation(); setReplyTo(comment.id); }}
                              className="text-[10px] text-gray-400 hover:text-primary-600 flex items-center gap-0.5">
                              <Reply className="w-3 h-3" />Ответить
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleResolve(comment.id, !comment.is_resolved); }}
                              className="text-[10px] text-gray-400 hover:text-green-600 flex items-center gap-0.5">
                              <Check className="w-3 h-3" />{comment.is_resolved ? 'Открыть' : 'Решено'}
                            </button>
                            {comment.user_id === user?.id && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }}
                                className="text-[10px] text-gray-400 hover:text-red-600 flex items-center gap-0.5">
                                <Trash2 className="w-3 h-3" />Удалить
                              </button>
                            )}
                          </div>

                          {/* Ответы */}
                          {comment.replies?.length > 0 && (
                            <div className="mt-2 pl-3 border-l-2 border-gray-200 space-y-2">
                              {comment.replies.map(reply => (
                                <div key={reply.id}>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-medium text-gray-700">{reply.user_name}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(reply.created_at).toLocaleString('ru')}</span>
                                  </div>
                                  <p className="text-xs text-gray-600">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ввод комментария */}
            <div className="p-3 border-t border-gray-100">
              {replyTo && (
                <div className="flex items-center justify-between mb-2 px-2 py-1 bg-gray-100 rounded text-xs">
                  <span className="text-gray-500">Ответ на комментарий</span>
                  <button onClick={() => setReplyTo(null)}><X className="w-3 h-3" /></button>
                </div>
              )}
              {pendingPin && (
                <div className="flex items-center justify-between mb-2 px-2 py-1 bg-orange-50 rounded text-xs">
                  <span className="text-orange-600">Пин установлен — добавьте комментарий</span>
                  <button onClick={() => setPendingPin(null)}><X className="w-3 h-3" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                  placeholder="Написать комментарий..."
                  className="input flex-1 text-sm"
                />
                <button onClick={submitComment} disabled={!newComment.trim()} className="btn-primary px-3">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
