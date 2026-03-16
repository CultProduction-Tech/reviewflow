import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import {
  LayoutDashboard, FolderOpen, CheckCircle, BarChart3, Bell, Search,
  LogOut, ChevronDown, Menu, X, FileCheck
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    api.getNotifications().then(data => {
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    }).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setShowNotifs(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeout = setTimeout(() => {
        api.search(searchQuery).then(data => setSearchResults(data.results));
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const nav = [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
    { to: '/my-reviews', icon: CheckCircle, label: 'Мои рецензии' },
    { to: '/insights', icon: BarChart3, label: 'Аналитика' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Боковая панель */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <Link to="/" className="flex items-center gap-2">
              <FileCheck className="w-7 h-7 text-primary-600" />
              <span className="font-bold text-lg text-gray-900">ReviewFlow</span>
            </Link>
          ) : (
            <FileCheck className="w-7 h-7 text-primary-600 mx-auto" />
          )}
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {nav.map(item => {
            const active = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Основная область */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Верхняя панель */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Быстрый поиск...</span>
              <kbd className="ml-4 px-1.5 py-0.5 bg-white rounded text-xs border border-gray-200">F</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Уведомления */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-auto">
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-sm">Уведомления</span>
                    {unreadCount > 0 && (
                      <button onClick={() => { api.markAllRead(); setUnreadCount(0); }} className="text-xs text-primary-600 hover:underline">
                        Прочитать все
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">Нет уведомлений</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.is_read ? 'bg-primary-50/30' : ''}`}
                      onClick={() => { api.markRead(n.id); if (n.link) navigate(n.link); setShowNotifs(false); }}>
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Меню пользователя */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: user?.avatar_color || '#6366f1' }}>
                  {initials}
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Поиск */}
        {searchOpen && (
          <div className="fixed inset-0 z-50 bg-black/20 flex justify-center pt-20" onClick={() => setSearchOpen(false)}>
            <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-200 h-fit max-h-96 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск по проектам, файлам, комментариям..."
                  className="flex-1 outline-none text-sm"
                  autoFocus
                />
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs border border-gray-200 text-gray-400">ESC</kbd>
              </div>
              {searchResults.length > 0 && (
                <div className="overflow-auto max-h-72">
                  {searchResults.map(r => (
                    <button
                      key={`${r.type}-${r.id}`}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery('');
                        if (r.type === 'project') navigate(`/projects/${r.id}`);
                        else if (r.type === 'file') navigate(`/projects/${r.project_id}/files/${r.id}`);
                        else if (r.type === 'comment') navigate(`/projects/${r.project_id}/files/${r.file_id}`);
                      }}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                        r.type === 'project' ? 'bg-primary-100 text-primary-700' :
                        r.type === 'file' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.type === 'project' ? 'проект' : r.type === 'file' ? 'файл' : 'коммент'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{r.name}</p>
                        {r.detail && <p className="text-xs text-gray-500 truncate">{r.detail}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">Ничего не найдено</p>
              )}
            </div>
          </div>
        )}

        {/* Контент */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
