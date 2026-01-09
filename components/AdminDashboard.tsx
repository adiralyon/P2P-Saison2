
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Meeting, ProfessionalCategory, AdminSubState } from '../types';
import { Button } from './Button';
import * as XLSX from 'xlsx';
import { dbService } from '../services/database';

interface AdminDashboardProps {
  users: User[];
  meetings: Meeting[];
  adminState: AdminSubState;
  currentRound: number | null;
  onUpdateUsers: (users: User[]) => void;
  onDeleteUser: (userId: string) => void;
  onAutoMatch: () => void;
  onIncrementalMatch: () => void;
  onManualMatch: (m: Meeting) => void;
  onSetCurrentRound: (round: number | null) => void;
  onResetAll: () => void;
}

type SortField = 'firstName' | 'lastName' | 'role' | 'company';
type SortOrder = 'asc' | 'desc';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  users = [], 
  meetings = [],
  adminState,
  currentRound,
  onUpdateUsers,
  onDeleteUser,
  onAutoMatch,
  onIncrementalMatch,
  onManualMatch,
  onSetCurrentRound,
  onResetAll
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const [formData, setFormData] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    company: '',
    role: '',
    categories: [ProfessionalCategory.DSI],
    bio: ''
  });

  const generateCode = (firstName: string, lastName: string) => {
    const p = firstName.trim().charAt(0).toUpperCase() || 'X';
    const n = lastName.trim().slice(0, 3).toUpperCase().padEnd(3, 'X');
    return `${p}-${n}`;
  };

  const openAdd = () => {
    setFormData({ firstName: '', lastName: '', company: '', role: '', categories: [ProfessionalCategory.DSI], bio: '' });
    setEditingUser(null);
    setShowAddModal(true);
  };

  const openEdit = (user: User) => {
    setFormData({ 
      firstName: user.firstName, 
      lastName: user.lastName, 
      company: user.company, 
      role: user.role, 
      categories: user.categories, 
      bio: user.bio 
    });
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    
    let filtered = [...users];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.firstName.toLowerCase().includes(q) || 
        u.lastName.toLowerCase().includes(q) || 
        u.company.toLowerCase().includes(q) || 
        u.role.toLowerCase().includes(q) ||
        u.connectionCode?.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortOrder, searchQuery]);

  const processImportData = (data: any[]) => {
    try {
      const newUsers: User[] = data.map((row, index) => {
        const keys = Object.keys(row);
        const prenomKey = keys.find(k => ['prénom', 'prenom', 'first name', 'firstname'].includes(k.toLowerCase().trim()));
        const nomKey = keys.find(k => ['nom', 'last name', 'lastname'].includes(k.toLowerCase().trim()) && k !== prenomKey);
        
        const fName = (row[prenomKey || ''] || '').toString().trim();
        const lName = (row[nomKey || ''] || '').toString().trim();
        const fullName = `${fName} ${lName}`.trim();
        const code = generateCode(fName, lName);

        return {
          id: `u-${Math.random().toString(36).substr(2, 9)}`,
          firstName: fName || 'Prénom',
          lastName: lName || 'Nom',
          name: fullName || `Pair ${index + 1}`,
          company: row['Entreprise'] || row['Société'] || row['Company'] || 'À compléter',
          role: row['Fonction'] || row['Poste'] || row['Job'] || 'Pair',
          categories: [ProfessionalCategory.AUTRE],
          bio: '', 
          avatar: `https://picsum.photos/seed/${fullName}${index}/200`,
          avgScore: 0,
          connectionCode: code
        };
      }).filter(u => u.lastName.length > 0 || u.firstName.length > 0);

      onUpdateUsers([...users, ...newUsers]);
      setShowImportModal(false);
    } catch (e) {
      alert("Erreur lors de l'import.");
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      processImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const code = generateCode(formData.firstName || '', formData.lastName || '');
    
    if (editingUser) {
      onUpdateUsers(users.map(u => u.id === editingUser.id ? { ...editingUser, ...formData, name: fullName, connectionCode: u.connectionCode || code } as User : u));
    } else {
      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        avgScore: 0, 
        avatar: `https://picsum.photos/seed/${fullName}/200`, 
        ...formData,
        name: fullName,
        connectionCode: code
      } as User;
      onUpdateUsers([...users, newUser]);
    }
    setEditingUser(null);
    setShowAddModal(false);
  };

  const handleConfirmMatch = async (u1Id: string, u2Id: string) => {
    if(!confirm("Valider ce Duo comme Match Officiel ?")) return;
    await dbService.updateUser(u1Id, { matchId: u2Id });
    await dbService.updateUser(u2Id, { matchId: u1Id });
    alert("Match validé !");
  };

  const potentialMatches = useMemo(() => {
    const pairs: { u1: User, u2: User, score: number, meeting: Meeting }[] = [];
    const processedIds = new Set<string>();

    meetings.filter(m => m.ratings && m.ratings.length >= 2).forEach(m => {
      const u1 = users.find(u => u.id === m.participant1Id);
      const u2 = users.find(u => u.id === m.participant2Id);
      if(!u1 || !u2) return;

      const r1 = m.ratings.find(r => r.fromId === u1.id && r.toId === u2.id);
      const r2 = m.ratings.find(r => r.fromId === u2.id && r.toId === u1.id);
      
      if(r1 && r2) {
        pairs.push({ u1, u2, score: r1.score + r2.score, meeting: m });
      }
    });

    return pairs.sort((a,b) => b.score - a.score);
  }, [meetings, users]);

  const meetingsByRound = useMemo(() => {
    const rounds: Record<number, Meeting[]> = {};
    let filtered = meetings;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => {
        const u1 = users.find(u => u.id === m.participant1Id);
        const u2 = users.find(u => u.id === m.participant2Id);
        return u1?.name.toLowerCase().includes(q) || u2?.name.toLowerCase().includes(q);
      });
    }

    filtered.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    return Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [meetings, searchQuery, users]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* BARRE DE RECHERCHE */}
      <div className="sticky top-[80px] z-40 bg-white/80 backdrop-blur-md p-4 border-b border-slate-100 rounded-2xl shadow-sm">
        <div className="max-w-xl mx-auto relative group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text" 
            placeholder="Chercher un pair..." 
            className="w-full h-14 pl-14 pr-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* PAIRS */}
      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <div><h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Les Pairs</h3></div>
            <div className="flex gap-3">
               <Button variant="outline" size="sm" className="rounded-xl font-bold px-6" onClick={() => setShowImportModal(true)}>Import</Button>
               <Button size="sm" className="rounded-xl font-black uppercase px-8" onClick={openAdd}>Ajouter</Button>
               <Button variant="danger" size="sm" className="rounded-xl px-6" onClick={onResetAll}>Reset</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-10 py-6">Profil</th>
                  <th className="px-10 py-6">Code</th>
                  <th className="px-10 py-6">Match Final</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-10 py-6">
                      <div className="flex items-center space-x-4">
                        <img src={u.avatar} className="w-10 h-10 rounded-xl" />
                        <div><p className="font-bold">{u.name}</p><p className="text-[10px] text-slate-400 uppercase font-black">{u.company}</p></div>
                      </div>
                    </td>
                    <td className="px-10 py-6 font-black text-indigo-600">{u.connectionCode}</td>
                    <td className="px-10 py-6">
                       {u.matchId ? (
                         <div className="flex items-center space-x-2 text-emerald-600 font-bold">
                           <span>🤝 {users.find(m => m.id === u.matchId)?.name}</span>
                         </div>
                       ) : (
                         <span className="text-slate-300 italic text-xs">Aucun match</span>
                       )}
                    </td>
                    <td className="px-10 py-6 text-right space-x-2">
                      <button onClick={() => openEdit(u)} className="text-indigo-600 font-black text-[10px] uppercase">Editer</button>
                      <button onClick={() => onDeleteUser(u.id)} className="text-rose-500 font-black text-[10px] uppercase">Suppr</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLANNING */}
      {adminState === 'PLANNING' && (
        <div className="space-y-12">
          {/* CONTROLES SESSION */}
          <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl text-center">
            <h3 className="text-4xl font-black text-white uppercase italic mb-10">Pilotage Session</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {[1, 2, 3, 4, 5, 6, 7].map(r => (
                <button 
                  key={r} 
                  onClick={() => onSetCurrentRound(r)}
                  className={`w-24 h-24 rounded-[2rem] font-black text-2xl border-4 transition-all ${currentRound === r ? 'bg-indigo-600 border-white text-white scale-110 shadow-xl' : 'bg-white/5 border-white/10 text-slate-500'}`}
                >R{r}</button>
              ))}
              <div className="w-px h-24 bg-white/10 mx-4"></div>
              <button onClick={() => onSetCurrentRound(0)} className={`h-24 px-10 rounded-[2rem] font-black text-xl border-4 transition-all ${currentRound === 0 ? 'bg-amber-500 border-white text-white scale-110' : 'bg-white/5 border-white/10 text-amber-500'}`}>Pause ☕️</button>
              <button onClick={() => onSetCurrentRound(-1)} className={`h-24 px-10 rounded-[2rem] font-black text-xl border-4 transition-all ${currentRound === -1 ? 'bg-rose-600 border-white text-white scale-110' : 'bg-white/5 border-white/10 text-rose-500'}`}>Clôture 🏁</button>
            </div>
          </div>

          <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 flex justify-between items-center">
             <div><h3 className="text-4xl font-black uppercase italic tracking-tighter">Matches Planning</h3><p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">{meetings.length} créneaux</p></div>
             <div className="flex gap-4"><Button onClick={onAutoMatch}>Reset & Relancer</Button><Button variant="secondary" onClick={onIncrementalMatch}>Actualiser Nouveaux</Button></div>
          </div>

          <div className="space-y-16">
            {meetingsByRound.map(([round, roundMeetings]) => (
              <div key={round} className="space-y-8">
                <h4 className="text-2xl font-black uppercase italic border-l-8 border-indigo-600 pl-4">Round {round}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {roundMeetings.map(m => {
                    const u1 = users.find(u => u.id === m.participant1Id);
                    const u2 = users.find(u => u.id === m.participant2Id);
                    return (
                      <div key={m.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                         <div className="text-center flex-1"><img src={u1?.avatar} className="w-12 h-12 rounded-xl mx-auto mb-1" /><p className="text-[8px] font-black uppercase">{u1?.name}</p></div>
                         <div className="px-4 font-black text-slate-200">VS</div>
                         <div className="text-center flex-1"><img src={u2?.avatar} className="w-12 h-12 rounded-xl mx-auto mb-1" /><p className="text-[8px] font-black uppercase">{u2?.name}</p></div>
                         <div className="ml-4 bg-slate-900 text-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px]">T{m.tableNumber}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BILANS & MATCHS */}
      {adminState === 'RESULTS' && (
        <div className="space-y-12">
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-12 rounded-[3.5rem] text-white">
            <h3 className="text-5xl font-black uppercase italic tracking-tighter mb-4 text-center">🏆 Palmarès des Duos</h3>
            <p className="text-indigo-300 text-center font-bold uppercase tracking-widest text-[10px]">Classement par synergie réciproque (Note A&rarr;B + Note B&rarr;A)</p>
          </div>

          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center">
              <h4 className="text-2xl font-black uppercase italic">Duos Potentiels</h4>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{potentialMatches.length} synergies détectées</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="px-10 py-6">Duo</th>
                    <th className="px-10 py-6">Synergie (Score /10)</th>
                    <th className="px-10 py-6">Etat</th>
                    <th className="px-10 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {potentialMatches.map((pm, idx) => {
                    const isMatched = pm.u1.matchId === pm.u2.id;
                    const isOtherMatched = (pm.u1.matchId && !isMatched) || (pm.u2.matchId && !isMatched);
                    return (
                      <tr key={pm.meeting.id} className={`hover:bg-slate-50 ${isMatched ? 'bg-emerald-50' : isOtherMatched ? 'opacity-30' : ''}`}>
                        <td className="px-10 py-6">
                           <div className="flex items-center space-x-3">
                              <img src={pm.u1.avatar} className="w-8 h-8 rounded-lg" />
                              <span className="font-bold text-xs">{pm.u1.name}</span>
                              <span className="text-slate-300">+</span>
                              <img src={pm.u2.avatar} className="w-8 h-8 rounded-lg" />
                              <span className="font-bold text-xs">{pm.u2.name}</span>
                           </div>
                        </td>
                        <td className="px-10 py-6 font-black text-xl text-indigo-600">{pm.score}</td>
                        <td className="px-10 py-6">
                           {isMatched ? (
                             <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">Duo Officiel</span>
                           ) : isOtherMatched ? (
                             <span className="text-rose-500 text-[8px] font-black uppercase italic">Conflit: Déjà apparié</span>
                           ) : (
                             <span className="text-slate-400 text-[8px] font-black uppercase">Disponible</span>
                           )}
                        </td>
                        <td className="px-10 py-6 text-right">
                           {!isMatched && !isOtherMatched && (
                             <Button size="sm" className="rounded-xl px-4 text-[9px]" onClick={() => handleConfirmMatch(pm.u1.id, pm.u2.id)}>Valider Duo</Button>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALES */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-14 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-4xl font-black text-slate-900 uppercase italic mb-8">{editingUser ? 'Modifier Pair' : 'Nouveau Pair'}</h3>
            <form onSubmit={handleSaveUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prénom</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold uppercase" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entreprise</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poste</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-4 pt-10">
                <button type="button" className="text-slate-400 font-black uppercase text-xs" onClick={() => setShowAddModal(false)}>Annuler</button>
                <Button type="submit">Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-xl p-14 shadow-2xl text-center">
            <div className="text-5xl mb-8">📁</div>
            <h3 className="text-3xl font-black uppercase mb-4">Import Excel</h3>
            <p className="text-slate-500 mb-10">Colonnes requises: Prénom, Nom, Entreprise, Fonction</p>
            <input type="file" accept=".xlsx, .xls" className="hidden" id="excel-up" onChange={handleExcelImport} />
            <label htmlFor="excel-up" className="block w-full py-12 border-4 border-dashed border-slate-100 rounded-[2.5rem] cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition-all font-black text-slate-400 uppercase tracking-widest mb-8">Parcourir</label>
            <button className="text-slate-400 font-black text-xs uppercase" onClick={() => setShowImportModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
};
