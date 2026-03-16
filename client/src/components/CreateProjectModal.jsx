import { useState } from 'react';
import { api } from '../api';
import { X, Plus, Trash2 } from 'lucide-react';

export default function CreateProjectModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [groups, setGroups] = useState([{ name: 'Группа рецензентов 1' }]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        reviewer_groups: groups.filter(g => g.name.trim())
      });
      onCreated();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Новый проект</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название проекта *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Например, Маркетинговая кампания Q1" autoFocus required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input" rows={2} placeholder="О чём этот проект?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дедлайн</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Группы рецензентов</label>
            <div className="space-y-2">
              {groups.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={g.name}
                    onChange={e => { const ng = [...groups]; ng[i].name = e.target.value; setGroups(ng); }}
                    className="input flex-1"
                    placeholder="Название группы"
                  />
                  {groups.length > 1 && (
                    <button type="button" onClick={() => setGroups(groups.filter((_, j) => j !== i))}
                      className="p-2 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setGroups([...groups, { name: `Группа рецензентов ${groups.length + 1}` }])}
              className="mt-2 text-sm text-primary-600 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" />Добавить группу
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={loading || !name.trim()} className="btn-primary">
              {loading ? 'Создание...' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
