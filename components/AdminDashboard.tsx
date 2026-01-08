
import React, { useState, useMemo } from 'react';
import { User, Meeting, ProfessionalCategory, AdminSubState } from '../types';
import { Button } from './Button';

interface AdminDashboardProps {
  users: User[];
  meetings: Meeting[];
  adminState: AdminSubState;
  onUpdateUsers: (users: User[]) => void;
  onAutoMatch: () => void;
  onManualMatch: (m: Meeting) => void;
  onResetAll: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  users, 
  meetings,
  adminState,
  onUpdateUsers,
  onAutoMatch,
  onManualMatch,
  onResetAll
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<string>('all');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    company: '',
    role: '',
    categories: [ProfessionalCategory.DSI],
    bio: ''
  });

  const deleteUser = (id: string) => {
    if (confirm("Supprimer définitivement ce pair ?")) {
      onUpdateUsers(users.filter(u => u.id !== id));
    }
  };
  
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categories || formData.categories.length === 0) {
      alert("Au moins une catégorie requise.");
      return;
    }
    if (editingUser) {
      onUpdateUsers(users.map(u => u.id === editingUser.id ? { ...editingUser, ...formData } as User : u));
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        avgScore: 0,
        avatar: `https://picsum.photos/seed/${formData.name}/200`,
        ...formData
      } as User;
      onUpdateUsers([newUser, ...users]);
    }
    setEditingUser(null);
    setShowAddModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      role: '',
      categories: [ProfessionalCategory.DSI],
      bio: ''
    });
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormData(u);
    setShowAddModal(true);
  };

  const openAdd = () => {
    setEditingUser(null);
    resetForm();
    setShowAddModal(true);
  };

  const toggleCategory = (cat: ProfessionalCategory) => {
    setFormData(prev => {
      const current = prev.categories || [];
      const isSelected = current.includes(cat);
      if (isSelected) {
        return { ...prev, categories: current.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...current, cat] };
      }
    });
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const catMatch = filterCategory === 'all' || m.category === filterCategory;
      const roundMatch = filterRound === 'all' || m.round === parseInt(filterRound);
      return catMatch && roundMatch;
    });
  }, [meetings, filterCategory, filterRound]);

  const meetingsByRound = useMemo(() => {
    const rounds: Record<number, Meeting[]> = {};
    filteredMeetings.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    return Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [filteredMeetings]);

  const duos = useMemo(() => {
    return meetings
      .filter(m => m.ratings.length === 2)
      .map(m => {
        const p1 = users.find(u => u.id === m.participant1Id);
        const p2 = users.find(u => u.id === m.participant2Id);
        const avg = (m.ratings[0].score + m.ratings[1].score) / 2;
        return { p1, p2, avg, m };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [meetings, users]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-10 max-w-lg w-full animate-in zoom-in-95 duration-200 border border-white/20">
            <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter uppercase">
              {editingUser ? "ÉDITER LE PROFIL PAIR" : "NOUVEAU PAIR"}
            </h3>
            <form onSubmit={handleSaveUser} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                  <input
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entreprise</label>
                  <input
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fonction</label>
                <input
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégories (Choix multiple)</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {Object.values(ProfessionalCategory).map(c => (
                    <label key={c} className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100 cursor-pointer">
                      <input 
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={(formData.categories || []).includes(c)}
                        onChange={() => toggleCategory(c)}
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expertise & Bio (Analyse IA)</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium italic"
                  rows={3}
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              <div className="flex space-x-3 pt-6">
                <Button type="submit" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest">Enregistrer</Button>
                <Button type="button" variant="outline" className="h-14 rounded-2xl font-black uppercase tracking-widest" onClick={() => setShowAddModal(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">LES PAIRS</h3>
              <p className="text-slate-500 font-medium">Gestion totale de la base de données ({users.length} profils).</p>
            </div>
            <div className="flex space-x-3">
               <Button variant="danger" size="sm" className="rounded-xl font-bold border-none" onClick={onResetAll}>Reset Session</Button>
               <Button size="md" className="rounded-xl px-8 font-black uppercase tracking-widest" onClick={openAdd}>Ajouter un Pair</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pair / Poste</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Spécialités</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">E-Réputation</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-5">
                        <img src={u.avatar} className="w-14 h-14 rounded-2xl shadow-md border-2 border-white group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="font-black text-slate-900 text-lg leading-none mb-1">{u.name}</p>
                          <p className="text-xs text-slate-500 font-bold">{u.role} @ {u.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.categories.map(cat => (
                          <span key={cat} className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100/50 uppercase tracking-widest">{cat}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-black text-amber-500">{u.avgScore.toFixed(1)}</span>
                        <span className="text-amber-300 text-xl">★</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right space-x-3">
                      <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-800 text-sm font-black uppercase tracking-widest">Éditer</button>
                      <button onClick={() => deleteUser(u.id)} className="text-rose-500 hover:text-rose-700 text-sm font-black uppercase tracking-widest">Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminState === 'PLANNING' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="max-w-xl">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">PILOTAGE DES ROUNDS</h3>
              <p className="text-slate-500 mt-2 text-lg font-medium">Matching par catégorie Saison 2 (7 rounds max). Support multi-choix.</p>
            </div>
            <Button size="lg" className="h-20 px-12 text-xl font-black rounded-3xl shadow-indigo-100 shadow-2xl uppercase tracking-widest" onClick={onAutoMatch}>Matching Automatique</Button>
          </div>
          
          <div className="flex flex-wrap items-center gap-6 bg-slate-900 p-8 rounded-[2rem] text-white">
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em] ml-1">Filtre Catégorie</label>
              <select 
                className="bg-white/10 border border-white/10 p-4 rounded-2xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all" className="text-slate-900">Toutes les spécialités</option>
                {Object.values(ProfessionalCategory).map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.2em] ml-1">Filtre Session (Round)</label>
              <select 
                className="bg-white/10 border border-white/10 p-4 rounded-2xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterRound}
                onChange={e => setFilterRound(e.target.value)}
              >
                <option value="all" className="text-slate-900">Tous les rounds</option>
                {[1,2,3,4,5,6,7].map(r => <option key={r} value={r} className="text-slate-900">Round {r}</option>)}
              </select>
            </div>
            <div className="pt-7">
              <span className="bg-indigo-600 px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest">
                {filteredMeetings.length} RDV affichés
              </span>
            </div>
          </div>

          <div className="space-y-16">
            {meetingsByRound.map(([round, roundMeetings]) => (
              <div key={round} className="space-y-8">
                <div className="flex items-center space-x-6">
                  <div className="bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">R{round}</div>
                  <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Round {round} <span className="text-slate-300 ml-2">({roundMeetings.length} échanges)</span></h4>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {roundMeetings.map(m => {
                    const u1 = users.find(u => u.id === m.participant1Id);
                    const u2 = users.find(u => u.id === m.participant2Id);
                    const isOngoing = m.status === 'ongoing';
                    const isCompleted = m.status === 'completed';
                    
                    return (
                      <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-bl-2xl z-10">T{m.tableNumber}</div>
                        <div className="mb-4">
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full line-clamp-1">{m.category}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-6">
                          <div className="text-center flex-1">
                            <img src={u1?.avatar} className="w-12 h-12 rounded-xl mx-auto mb-2 border-2 border-slate-50 shadow-sm" />
                            <p className="text-[10px] font-black truncate max-w-[80px] mx-auto text-slate-900">{u1?.name || "???"}</p>
                          </div>
                          <div className="px-3">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300 italic">VS</div>
                          </div>
                          <div className="text-center flex-1">
                            <img src={u2?.avatar} className="w-12 h-12 rounded-xl mx-auto mb-2 border-2 border-slate-50 shadow-sm" />
                            <p className="text-[10px] font-black truncate max-w-[80px] mx-auto text-slate-900">{u2?.name || "???"}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                          <span className="text-[10px] font-black text-slate-400 uppercase">{m.scheduledTime}</span>
                          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${
                            isOngoing ? 'bg-amber-100 text-amber-700 animate-pulse' : 
                            isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {isOngoing ? 'EN COURS' : isCompleted ? 'TERMINÉ' : 'ATTENTE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminState === 'RESULTS' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section>
             <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                <div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">PALMARÈS DES MATCHS</h3>
                  <p className="text-slate-500 text-lg font-medium">Analyse des Power Duos Saison 2.</p>
                </div>
                <div className="bg-emerald-500 text-white px-8 py-4 rounded-3xl font-black shadow-lg shadow-emerald-200 uppercase tracking-widest text-sm">
                   {duos.length} Duos Validés
                </div>
             </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {duos.length === 0 ? (
                <div className="col-span-2 text-center p-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xl italic">
                  Aucun round n'a encore été évalué par les deux parties.
                </div>
              ) : (
                duos.map((d, i) => (
                  <div key={i} className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-indigo-500/10 border border-slate-100 relative overflow-hidden group hover:-translate-y-2 transition-all duration-300">
                     <div className="absolute top-0 left-0 w-3 h-full bg-emerald-500"></div>
                     <div className="flex justify-between items-center mb-8">
                        <div className="flex -space-x-6">
                           <img src={d.p1?.avatar} className="w-24 h-24 rounded-3xl border-8 border-white shadow-xl relative z-10 group-hover:rotate-6 transition-transform" />
                           <img src={d.p2?.avatar} className="w-24 h-24 rounded-3xl border-8 border-white shadow-xl relative z-0 group-hover:-rotate-6 transition-transform" />
                        </div>
                        <div className="text-right">
                           <div className="text-6xl font-black text-emerald-600 leading-none">{d.avg.toFixed(1)}</div>
                           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Score de Synergie</div>
                        </div>
                     </div>
                     <div className="mb-8 flex justify-between items-end">
                        <div>
                           <p className="text-3xl font-black text-slate-900 tracking-tighter">{d.p1?.name} & {d.p2?.name}</p>
                           <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-2 bg-indigo-50 px-4 py-1.5 rounded-full w-fit line-clamp-1">{d.m.category}</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-emerald-100">DUO D'OR</div>
                     </div>
                     <div className="pt-8 border-t border-slate-100 bg-slate-50/50 -mx-10 px-10 pb-2">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Feedback croisé</h5>
                        <div className="space-y-4">
                           {d.m.ratings.map((r, ri) => (
                              <div key={ri} className="flex items-start space-x-3">
                                 <span className="text-emerald-500 mt-1">✓</span>
                                 <p className="text-sm italic text-slate-700 leading-relaxed font-medium">"{r.comment || "Échange riche entre pairs."}"</p>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
