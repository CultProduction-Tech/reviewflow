import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileCheck, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, name, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('demo@filestage.local');
    setPassword('demo123');
    setIsRegister(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <FileCheck className="w-10 h-10 text-white" />
            <h1 className="text-3xl font-bold text-white">ReviewFlow</h1>
          </div>
          <p className="text-primary-200">Платформа для согласования и утверждения файлов</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold mb-6">{isRegister ? 'Регистрация' : 'Вход'}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@email.com" required />
            </div>
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="input" placeholder="Иван Иванов" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" required minLength={4} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : (
                <>{isRegister ? 'Создать аккаунт' : 'Войти'}<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-sm text-primary-600 hover:underline">
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <button onClick={fillDemo} className="text-xs text-gray-500 hover:text-primary-600">
              Демо-аккаунт (demo@filestage.local / demo123)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
