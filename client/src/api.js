const BASE = '/api';

async function request(url, options = {}, retries = 1) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(`${BASE}${url}`, { ...options, headers, credentials: 'include' });
  } catch (err) {
    if (retries > 0) return request(url, options, retries - 1);
    throw new Error('Ошибка сети. Попробуйте ещё раз.');
  }

  if (res.status === 401) {
    localStorage.removeItem('token');
    if (!url.includes('/auth/')) window.location.href = '/login';
    throw new Error('Требуется авторизация');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    if (retries > 0) return request(url, options, retries - 1);
    throw new Error('Ошибка сервера. Попробуйте ещё раз.');
  }

  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, name, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Projects
  getProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Sections
  createSection: (projectId, data) => request(`/projects/${projectId}/sections`, { method: 'POST', body: JSON.stringify(data) }),

  // Reviewer Groups
  createReviewerGroup: (projectId, data) => request(`/projects/${projectId}/reviewer-groups`, { method: 'POST', body: JSON.stringify(data) }),
  deleteReviewerGroup: (projectId, groupId) => request(`/projects/${projectId}/reviewer-groups/${groupId}`, { method: 'DELETE' }),
  addGroupMember: (projectId, groupId, data) => request(`/projects/${projectId}/reviewer-groups/${groupId}/members`, { method: 'POST', body: JSON.stringify(data) }),

  // Files
  uploadFiles: (projectId, files, sectionId) => {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    if (sectionId) formData.append('section_id', sectionId);
    return request(`/projects/${projectId}/files`, { method: 'POST', body: formData });
  },
  getFile: (fileId) => request(`/files/${fileId}`),
  deleteFile: (fileId) => request(`/files/${fileId}`, { method: 'DELETE' }),
  uploadVersion: (fileId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/files/${fileId}/versions`, { method: 'POST', body: formData });
  },

  // Reviews
  getReview: (reviewId) => request(`/reviews/${reviewId}`),
  submitDecision: (reviewId, decision) => request(`/reviews/${reviewId}/decide`, { method: 'POST', body: JSON.stringify({ decision }) }),
  startReview: (reviewId) => request(`/reviews/${reviewId}/start`, { method: 'POST' }),
  resetReview: (reviewId) => request(`/reviews/${reviewId}/reset`, { method: 'POST' }),
  setDueDate: (reviewId, due_date) => request(`/reviews/${reviewId}/due-date`, { method: 'PUT', body: JSON.stringify({ due_date }) }),
  getMyReviews: () => request(`/my-reviews`),

  // Comments
  getComments: (versionId, groupId) => request(`/versions/${versionId}/comments${groupId ? `?reviewer_group_id=${groupId}` : ''}`),
  addComment: (versionId, data) => request(`/versions/${versionId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  updateComment: (commentId, data) => request(`/comments/${commentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComment: (commentId) => request(`/comments/${commentId}`, { method: 'DELETE' }),

  // Activity & Notifications
  getActivity: (projectId) => request(`/activity${projectId ? `?project_id=${projectId}` : ''}`),
  getNotifications: () => request('/notifications'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PUT' }),

  // Insights
  getInsights: () => request('/insights'),

  // Search
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),

  // Folders
  getFolders: () => request('/folders'),
  createFolder: (data) => request('/folders', { method: 'POST', body: JSON.stringify(data) }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),
};
