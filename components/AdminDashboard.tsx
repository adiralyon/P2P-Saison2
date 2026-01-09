
import React, { useState, useMemo, useRef } from 'react';
import { User, Meeting, ProfessionalCategory, AdminSubState } from '../types';
import { Button } from './Button';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  users: User[];
  meetings: Meeting[];
  adminState: AdminSubState;
  onUpdateUsers: (users: User[]) => void;
  onAutoMatch: () => void;
  onIncrementalMatch: () => void;
  onManualMatch: (m: Meeting) => void;
  onResetAll: () => void;
}

type SortField = 'firstName' | 'lastName' | 'role' | 'company';
type SortOrder = 'asc' | 'desc';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  users = [], 
  meetings = [],
  adminState,
  onUpdateUsers,
  onAutoMatch,
  onIncrementalMatch,
  onManualMatch,
  onResetAll
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<string>('all');
  
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

  const openAdd = () => {
    setFormData({ 
      firstName: '', 
      lastName: '', 
      company: '', 
      role: '', 
      categories: [ProfessionalCategory.DSI], 
      bio: '' 
    });
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

  const sortedUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    return [...users].sort((a, b) => {
      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortOrder]);

  const processImportData = (data: any[]) => {
    try {
      const newUsers: User[] = data.map((row, index) => {
        const keys = Object.keys(row);
        const prenomKey = keys.find(k => ['prénom', 'prenom', 'first name', 'firstname'].includes(k.toLowerCase().trim()));
        const nomKey = keys.find(k => ['nom', 'last name', 'lastname'].includes(k.toLowerCase().trim()) && k !== prenomKey);
        
        const fName = (row[prenomKey || ''] || '').toString().trim();
        const lName = (row[nomKey || ''] || '').toString().trim();
        const fullName = `${fName} ${lName}`.trim();

        return {
          id: `u-${Math.random().toString(36).substr(2, 9)}`,
          firstName: fName || 'Prénom',
          lastName: lName || 'Nom',
          name: fullName || `Pair ${index + 1}`,
          company: row['Entreprise'] || row['Société'] || row['Company'] || 'À compléter',
          role: row['Fonction'] || row['Poste'] || row['Job'] || 'Pair',
          categories: [ProfessionalCategory.AUTRE],
          bio: row['Bio'] || 'Profil importé.',
          avatar: `https://picsum.photos/seed/${fullName}${index}/200`,
          avgScore: 0
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
    if (editingUser) {
      onUpdateUsers(users.map(u => u.id === editingUser.id ? { ...editingUser, ...formData, name: fullName } as User : u));
    } else {
      const newUser: User = { 
        id: Math.random().toString(36).substr(2, 9), 
        avgScore: 0, 
        avatar: `https://picsum.photos/seed/${fullName}/200`, 
        ...formData,
        name: fullName 
      } as User;
      onUpdateUsers([...users, newUser]);
    }
    setEditingUser(null);
    setShowAddModal(false);
  };

  const meetingsByRound = useMemo(() => {
    const rounds: Record<number, Meeting[]> = {};
    const filtered = meetings.filter(m => {
      const catMatch = filterCategory === 'all' || m.category === filterCategory;
      const roundMatch = filterRound === 'all' || m.round === parseInt(filterRound);
      return catMatch && roundMatch;
    });
    filtered.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    Object.keys(rounds).forEach(r => rounds[parseInt(r)].sort((a, b) => a.tableNumber - b.tableNumber));
    return Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [meetings, filterCategory, filterRound]);

  const duos = useMemo(() => {
    return meetings
      .filter(m => m.status === 'completed' && (m.ratings?.length || 0) > 0)
      .map(m => ({ p1: users.find(u => u.id === m.participant1Id), p2: users.find(u => u.id === m.participant2Id), m }))
      .filter(d => d.p1 && d.p2);
  }, [meetings, users]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-12 max-w-2xl w-full">
            <h3 className="text-3xl font-black text-slate-900 mb-6 uppercase">Import de Contacts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div onClick={() => fileInputRef.current?.click()} className="h-48 border-4 border-dashed border-indigo-50 rounded-[2rem] bg-indigo-50/20 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-all">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Excel / CSV</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
              </div>
              <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] h-48 font-mono text-[10px] outline-none" placeholder="Prénom, Nom (par ligne)" value={importText} onChange={(e) => setImportText(e.target.value)} />
            </div>
            <div className="flex space-x-4">
              <Button onClick={() => {
                const lines = importText.split('\n').filter(l => l.trim().length > 0);
                processImportData(lines.map(l => l.includes(',') ? { 'Prénom': l.split(',')[0], 'Nom': l.split(',')[1] } : { 'Prénom': l.trim() }));
                setImportText('');
              }} className="flex-1 h-16 rounded-2xl font-black uppercase text-xs">Importer</Button>
              <Button variant="outline" onClick={() => setShowImportModal(false)} className="h-16 px-10 rounded-2xl font-black uppercase text-xs">Fermer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-3xl w-full my-8">
            <h3 className="text-3xl font-black text-slate-900 mb-8 uppercase italic">{editingUser ? 'Modifier le Pair' : 'Nouveau Pair'}</h3>
            <form onSubmit={handleSaveUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Prénom</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Entreprise</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Fonction</label>
                  <input type="text" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} />
                </div>
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expertises (Multi-choix)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  {Object.values(ProfessionalCategory).map(cat => (
                    <label key={cat} className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                      <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={formData.categories?.includes(cat)} onChange={() => {
                        const cats = formData.categories || [];
                        setFormData({ ...formData, categories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] });
                      }} />
                      <span className="text-xs font-bold text-slate-700 truncate">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Bio & Centres d'Intérêt</label>
                <textarea className="w-full p-4 md:p-6 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none font-medium italic text-slate-700 text-sm" rows={3} value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} />
              </div>
              <div className="flex space-x-3 pt-6">
                <Button type="submit" className="flex-1 h-16 rounded-2xl font-black uppercase tracking-widest shadow-xl">Sauvegarder</Button>
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="h-16 px-10 rounded-2xl font-black uppercase text-xs tracking-widest">Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROFILES TAB */}
      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
            <div>
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Les Pairs</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">{users.length} inscrits synchronisés</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" size="sm" className="rounded-xl font-bold px-6 border-slate-200" onClick={() => setShowImportModal(true)}>Import</Button>
               <Button size="sm" className="rounded-xl font-black uppercase px-8 shadow-xl" onClick={openAdd}>Ajouter</Button>
               <Button variant="danger" size="sm" className="rounded-xl font-bold px-6" onClick={() => { if(confirm("Supprimer TOUS les contacts et matchs ?")) onResetAll(); }}>Reset All</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('firstName')}>Prénom</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('lastName')}>Nom</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('role')}>Fonction</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('company')}>Entreprise</th>
                  <th className="px-10 py-6">Expertises</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="px-10 py-6 font-bold text-slate-900">{u.firstName}</td>
                    <td className="px-10 py-6 font-black text-slate-900 uppercase tracking-tight">{u.lastName}</td>
                    <td className="px-10 py-6 text-sm font-medium text-slate-600">{u.role}</td>
                    <td className="px-10 py-6 text-sm font-bold text-indigo-600">{u.company}</td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-1">
                        {(u.categories || []).map(cat => (
                          <span key={cat} className="text-[7px] font-black text-indigo-700 bg-white px-2 py-1 rounded-full border border-indigo-100 uppercase">{cat}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right space-x-4">
                      <button onClick={() => openEdit(u)} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest">Éditer</button>
                      <button onClick={() => { if(confirm("Supprimer ce profil ?")) onUpdateUsers(users.filter(user => user.id !== u.id)); }} className="text-rose-500 font-black text-[10px] uppercase tracking-widest">Suppr</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLANNING TAB */}
      {adminState === 'PLANNING' && (
        <div className="space-y-12">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-10">
             <div className="text-center md:text-left">
                <h3 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter">Pilotage Rounds</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-3">{meetings.length} matchs actifs</p>
             </div>
             <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="rounded-2xl h-18 px-12 font-black uppercase" onClick={onAutoMatch}>Reset & Relancer</Button>
                <Button variant="secondary" size="lg" className="rounded-2xl h-18 px-12 font-black uppercase" onClick={onIncrementalMatch}>Actualiser Nouveaux</Button>
             </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
             <select value={filterRound} onChange={e => setFilterRound(e.target.value)} className="p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none">
               <option value="all">Tous les Rounds</option>
               {[1,2,3,4,5,6,7].map(r => <option key={r} value={r}>Round {r}</option>)}
             </select>
             <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none">
               <option value="all">Toutes les expertises</option>
               {Object.values(ProfessionalCategory).map(c => <option key={c} value={c}>{c}</option>)}
             </select>
          </div>
          <div className="grid grid-cols-1 gap-16">
            {meetingsByRound.map(([round, roundMeetings]) => (
              <div key={round} className="space-y-8">
                <div className="flex items-center space-x-6">
                  <div className="bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl rotate-3">R{round}</div>
                  <h4 className="text-3xl font-black text-slate-900 uppercase italic">Round {round}</h4>
                  <div className="h-px bg-slate-100 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {roundMeetings.map(m => {
                    const u1 = users.find(u => u.id === m.participant1Id);
                    const u2 = users.find(u => u.id === m.participant2Id);
                    const isSelected = selectedMeetingId === m.id;
                    const status = m.status === 'completed' ? 'Fini' : (m.status === 'ongoing' ? 'En cours' : 'À lancer');
                    const color = m.status === 'completed' ? 'bg-emerald-500' : (m.status === 'ongoing' ? 'bg-amber-500' : 'bg-slate-400');
                    return (
                      <div key={m.id} onClick={() => setSelectedMeetingId(isSelected ? null : m.id)} className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative cursor-pointer hover:shadow-2xl transition-all ${isSelected ? 'ring-4 ring-indigo-500/20' : ''}`}>
                        <div className="absolute top-0 right-0 px-5 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-bl-[1.5rem] tracking-widest">T{m.tableNumber}</div>
                        <div className="flex items-center justify-between mt-4">
                          <img src={u1?.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-md border-2 border-white" />
                          <div className="text-[10px] font-black text-slate-200 tracking-[0.3em] rotate-90">VS</div>
                          <img src={u2?.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-md border-2 border-white" />
                        </div>
                        <div className="mt-8 flex justify-center"><div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white shadow-lg ${color}`}>{status}</div></div>
                        <div className={`mt-6 pt-4 border-t border-slate-50 space-y-2 transition-all ${isSelected ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                           <p className="text-[11px] font-black text-slate-900 uppercase text-center leading-none">{u1?.name} & {u2?.name}</p>
                           <p className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">{m.category}</p>
                           <p className="text-center font-black text-indigo-600 text-sm mt-2">{m.ratings?.reduce((acc, r) => acc + r.score, 0).toFixed(1) || '---'}</p>
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

      {/* RESULTS TAB */}
      {adminState === 'RESULTS' && (
        <div className="space-y-12 animate-in fade-in duration-1000">
          <h3 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter">Performance Duos</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {duos.length === 0 ? (
              <div className="col-span-2 py-20 bg-white rounded-[3rem] text-center border-4 border-dashed border-slate-50">
                <p className="text-slate-300 font-black uppercase tracking-widest">En attente de résultats...</p>
              </div>
            ) : duos.map((d, i) => (
              <div key={i} className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 flex justify-between items-center group">
                 <div className="flex -space-x-8">
                    <img src={d.p1?.avatar} className="w-24 h-24 rounded-3xl border-8 border-white shadow-2xl rotate-[-6deg]" />
                    <img src={d.p2?.avatar} className="w-24 h-24 rounded-3xl border-8 border-white shadow-2xl rotate-[6deg]" />
                 </div>
                 <div className="flex-1 px-12">
                    <p className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">{d.p1?.name} & {d.p2?.name}</p>
                    <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">{d.m.category}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total</p>
                    <div className="text-5xl font-black text-emerald-500 italic">{(d.m.ratings?.reduce((acc, r) => acc + r.score, 0) || 0).toFixed(1)}</div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
