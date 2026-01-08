
import React, { useState } from 'react';
import { ProfessionalCategory, User } from '../types';
import { Button } from './Button';

interface RegistrationProps {
  onRegister: (user: User) => void;
}

export const Registration: React.FC<RegistrationProps> = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '',
    categories: [ProfessionalCategory.DSI] as ProfessionalCategory[],
    bio: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.categories.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie.");
      return;
    }
    const newUser: User = {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      ...formData,
      avatar: `https://picsum.photos/seed/${formData.name}/200`,
      avgScore: 0
    };
    onRegister(newUser);
  };

  const toggleCategory = (cat: ProfessionalCategory) => {
    setFormData(prev => {
      const isSelected = prev.categories.includes(cat);
      if (isSelected) {
        return { ...prev, categories: prev.categories.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...prev.categories, cat] };
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-12 rounded-[3rem] shadow-2xl shadow-indigo-500/5 border border-slate-100 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">Inscription Pair</h1>
        <p className="text-slate-500 mt-4 text-xl font-medium max-w-lg mx-auto leading-relaxed">Prêt pour la Saison 2 de matching entre pairs ? Vos 7 rounds vous attendent.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Prénom & Nom</label>
            <input
              type="text"
              required
              placeholder="Jean Dupont"
              className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Entreprise</label>
            <input
              type="text"
              required
              placeholder="Votre société"
              className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Ma Fonction</label>
          <input
            type="text"
            required
            placeholder="Ex: DSI Groupe, Expert Cyber..."
            className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
          />
        </div>

        <div className="space-y-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Mes Catégories (Choix multiple)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
            {Object.values(ProfessionalCategory).map(cat => (
              <label key={cat} className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={formData.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                <span className="text-sm font-bold text-slate-700">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Bio & Centres d'Intérêt (Analyse IA)</label>
          <textarea
            className="w-full p-6 rounded-[1.5rem] bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-medium italic text-slate-700 leading-relaxed"
            rows={4}
            placeholder="Détaillez vos sujets favoris pour faciliter l'échange lors des 8 minutes..."
            value={formData.bio}
            onChange={e => setFormData({ ...formData, bio: e.target.value })}
          ></textarea>
        </div>

        <Button type="submit" className="w-full h-20 text-xl font-black rounded-3xl shadow-indigo-100 shadow-2xl uppercase tracking-[0.3em]" size="lg">
          Rejoindre la Saison 2
        </Button>
      </form>
      
      <div className="mt-10 text-center flex items-center justify-center space-x-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
        <span>Données sécurisées • Échanges entre Pairs</span>
      </div>
    </div>
  );
};
