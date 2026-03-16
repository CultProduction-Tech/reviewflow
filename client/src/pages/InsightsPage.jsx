import { useState, useEffect } from 'react';
import { api } from '../api';
import { BarChart3, FolderOpen, FileUp, CheckCircle, MessageSquare, TrendingUp } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInsights().then(data => setInsights(data.insights)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!insights) return null;

  const maxActivity = Math.max(...(insights.recent_activity.map(a => a.count) || [1]), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Аналитика</h1>
      <p className="text-sm text-gray-500 mb-6">Обзор активности по рецензированию</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={FolderOpen} label="Активных проектов" value={insights.active_projects} color="bg-primary-100 text-primary-600" />
        <StatCard icon={FileUp} label="Всего версий" value={insights.total_versions} color="bg-blue-100 text-blue-600" />
        <StatCard icon={BarChart3} label="Всего рецензий" value={insights.total_reviews} color="bg-purple-100 text-purple-600" />
        <StatCard icon={CheckCircle} label="Утверждённых" value={insights.approved_reviews} color="bg-green-100 text-green-600" />
        <StatCard icon={MessageSquare} label="Среднее кол-во комментариев" value={insights.avg_comments_per_review} color="bg-orange-100 text-orange-600" />
        <StatCard icon={TrendingUp} label="Процент утверждения"
          value={insights.total_reviews > 0 ? Math.round((insights.approved_reviews / insights.total_reviews) * 100) + '%' : 'Н/Д'}
          color="bg-teal-100 text-teal-600" />
      </div>

      {/* График активности */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Активность (за 30 дней)</h3>
        {insights.recent_activity.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Пока нет активности</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {insights.recent_activity.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary-500 rounded-t min-h-[2px] transition-all hover:bg-primary-600"
                  style={{ height: `${(day.count / maxActivity) * 100}%` }}
                  title={`${day.date}: ${day.count} действий`}
                />
                {i % 5 === 0 && (
                  <span className="text-[9px] text-gray-400 -rotate-45 origin-left">
                    {new Date(day.date).toLocaleDateString('ru', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
