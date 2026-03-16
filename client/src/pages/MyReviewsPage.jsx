import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CheckCircle, Clock, FileText, Image, Video, Music, AlertCircle } from 'lucide-react';

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getMyReviews().then(data => setReviews(data.reviews)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ожидают моей рецензии</h1>
      <p className="text-sm text-gray-500 mb-6">{reviews.length} элемент{reviews.length === 1 ? '' : reviews.length < 5 ? 'а' : 'ов'} на рецензии</p>

      {reviews.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500">Всё просмотрено! Нечего рецензировать.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/projects/${r.project_id}/files/${r.file_id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    {r.file_type === 'image' ? <Image className="w-5 h-5 text-pink-500" /> :
                     r.file_type === 'video' ? <Video className="w-5 h-5 text-purple-500" /> :
                     r.file_type === 'audio' ? <Music className="w-5 h-5 text-orange-500" /> :
                     <FileText className="w-5 h-5 text-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.file_name}</p>
                    <p className="text-xs text-gray-500">{r.project_name} · v{r.version_number} · {r.group_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.due_date && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      new Date(r.due_date) < new Date() ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      До {new Date(r.due_date).toLocaleDateString('ru')}
                    </span>
                  )}
                  <span className={`badge-${r.status === 'in_review' ? 'review' : 'pending'}`}>
                    {r.status === 'in_review' ? 'На рецензии' : 'Ожидает'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
