
import React, { useState } from 'react';
import { Button } from './Button';

interface AdminAuthProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === 'P2P-2026') {
      onSuccess();
    } else {
      setError(true);
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6">
      <div className="bg-white rounded-[3rem] shadow-2xl p-12 max-w-md w-full animate-in zoom-in-95 duration-500 border border-white/20">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-4xl shadow-2xl shadow-indigo-500/20">
            🔑
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">ACCÈS ADMIN</h2>
          <p className="text-slate-500 text-lg mt-3 font-medium">Authentification de session d'administration Saison 2.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="relative group">
            <input
              type="password"
              placeholder="CODE D'ACCÈS"
              className={`w-full p-6 bg-slate-50 border-4 rounded-3xl text-center text-3xl font-black tracking-[0.5em] focus:outline-none transition-all placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-300 ${
                error ? 'border-rose-500 animate-shake bg-rose-50/30' : 'border-slate-100 focus:border-indigo-600'
              }`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            {error && <p className="text-rose-500 text-xs font-black mt-3 text-center uppercase tracking-widest">Code Invalide</p>}
          </div>

          <div className="flex flex-col space-y-4 pt-4">
            <Button type="submit" className="w-full h-18 text-xl font-black rounded-[1.5rem] shadow-indigo-200 shadow-2xl uppercase tracking-[0.2em]">VALIDER</Button>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 text-sm font-black hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]"
            >
              Retour au portail public
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
