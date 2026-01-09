
import React, { useState, useEffect } from 'react';
import { ProfessionalCategory, User } from '../types';
import { Button } from './Button';
import { AvatarPicker } from './AvatarPicker';

interface RegistrationProps {
  onRegister: (user: User) => void;
}

export const Registration: React.FC<RegistrationProps> = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    role: '',
    categories: [] as ProfessionalCategory[],
    bio: '',
    avatar: ''
  });

  // Génération d'un avatar par défaut à l'initialisation
  useEffect(() => {
    const defaultAvatar = `https://picsum.photos/seed/${Math.random().toString(36).substr(2, 9)}/200`;
    setFormData(prev => ({ ...prev, avatar: defaultAvatar }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.categories.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie.");
      return;
    }
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const newUser: User = {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      ...formData,
      name: fullName,
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
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-12 rounded-3xl md:rounded-[3rem] shadow-2xl shadow-indigo-500/5 border border-slate-100 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase">Inscription</h1>
        <p className="text-slate-500 mt-2 md:mt-4 text-base md:text-xl font-medium max-w-lg mx-auto leading-relaxed">Sessions de matching Saison 2.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Section Avatar */}
        <div className="flex flex-col items-center justify-center space-y-4 py-4 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Votre Photo de Profil</label>
           <AvatarPicker 
             currentAvatar={formData.avatar} 
             onAvatarChange={(base64) => setFormData(prev => ({ ...prev, avatar: base64 }))} 
           />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-1 md:space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Prénom</label>
            <input
              type="text"
              required
              placeholder="Jean"
              className="w-full p-4 md:p-5 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nom</label>
            <input
              type="text"
              required
              placeholder="Dupont"
              className="w-full p-4 md:p-5 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-1 md:space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Entreprise</label>
            <input
              type="text"
              required
              placeholder="Votre société"
              className="w-full p-4 md:p-5 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.company}
              onChange={e => setFormData({ ...formData, company: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Fonction</label>
            <input
              type="text"
              required
              placeholder="Ex: DSI Groupe, Expert Cyber..."
              className="w-full p-4 md:p-5 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 md:space-y-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Expertise (Multi-choix)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 max-h-48 md:max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100">
            {Object.values(ProfessionalCategory).map(cat => (
              <label key={cat} className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all group">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={formData.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 truncate">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1 md:space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Bio & Centres d'Intérêt</label>
          <textarea
            className="w-full p-4 md:p-6 rounded-2xl md:rounded-[1.5rem] bg-slate-50 border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-medium italic text-slate-700 leading-relaxed text-sm md:text-base"
            rows={3}
            placeholder="Sujets favoris pour faciliter l'échange..."
            value={formData.bio}
            onChange={e => setFormData({ ...formData, bio: e.target.value })}
          ></textarea>
        </div>

        <Button type="submit" className="w-full h-16 md:h-20 text-lg md:text-xl font-black rounded-2xl md:rounded-3xl shadow-indigo-100 shadow-2xl uppercase tracking-[0.2em]" size="lg">
          Valider l'inscription
        </Button>
      </form>
      
      <div className="mt-8 md:mt-10 text-center flex items-center justify-center space-x-2 text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
        <span>Données sécurisées • Échanges Privés</span>
      </div>
    </div>
  );
};
