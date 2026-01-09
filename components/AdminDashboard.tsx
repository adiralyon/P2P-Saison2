
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Meeting, ProfessionalCategory, AdminSubState } from '../types';
import { Button } from './Button';
import * as XLSX from 'xlsx';

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
  const [editingExpertiseUserId, setEditingExpertiseUserId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editExpertiseRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editExpertiseRef.current && !editExpertiseRef.current.contains(event.target as Node)) {
        setEditingExpertiseUserId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

        // Nouveau format de code P-NOM
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
    // Nouveau format de code P-NOM
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

  const toggleInlineExpertise = (userId: string, category: ProfessionalCategory) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const cats = u.categories || [];
        const newCats = cats.includes(category) 
          ? cats.filter(c => c !== category) 
          : [...cats, category];
        return { ...u, categories: newCats };
      }
      return u;
    });
    onUpdateUsers(updatedUsers);
  };

  const meetingsByRound = useMemo(() => {
    const rounds: Record<number, Meeting[]> = {};
    let filtered = meetings.filter(m => {
      const catMatch = filterCategory === 'all' || m.category === filterCategory;
      const roundMatch = filterRound === 'all' || m.round === parseInt(filterRound);
      return catMatch && roundMatch;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => {
        const u1 = users.find(u => u.id === m.participant1Id);
        const u2 = users.find(u => u.id === m.participant2Id);
        return u1?.name.toLowerCase().includes(q) || u2?.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      });
    }

    filtered.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    Object.keys(rounds).forEach(r => rounds[parseInt(r)].sort((a, b) => a.tableNumber - b.tableNumber));
    return Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [meetings, filterCategory, filterRound, searchQuery, users]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Recherche Globale / Filtre */}
      <div className="sticky top-[80px] z-40 bg-white/80 backdrop-blur-md p-4 border-b border-slate-100 rounded-2xl shadow-sm">
        <div className="max-w-xl mx-auto relative group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">🔍</span>
          <input 
            type="text" 
            placeholder="Rechercher un pair, une entreprise, un code..." 
            className="w-full h-14 pl-14 pr-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* PROFILES TAB */}
      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden min-h-[600px]">
          <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
            <div><h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Les Pairs</h3><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">{filteredAndSortedUsers.length} affichés sur {users.length}</p></div>
            <div className="flex gap-3">
               <Button variant="outline" size="sm" className="rounded-xl font-bold px-6 border-slate-200" onClick={() => setShowImportModal(true)}>Import</Button>
               <Button size="sm" className="rounded-xl font-black uppercase px-8 shadow-xl" onClick={openAdd}>Ajouter</Button>
               <Button variant="danger" size="sm" className="rounded-xl font-bold px-6" onClick={onResetAll}>Reset All</Button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('firstName')}>Prénom</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('lastName')}>Nom</th>
                  <th className="px-10 py-6">Code</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('role')}>Fonction</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('company')}>Entreprise</th>
                  <th className="px-10 py-6">Expertises</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-indigo-50/10 transition-colors group">
                    <td className="px-10 py-6 font-bold text-slate-900">{u.firstName}</td>
                    <td className="px-10 py-6 font-black text-slate-900 uppercase tracking-tight">{u.lastName}</td>
                    <td className="px-10 py-6"><span className="bg-indigo-50 text-indigo-700 font-black px-2 py-1 rounded text-[10px] border border-indigo-100">{u.connectionCode || '----'}</span></td>
                    <td className="px-10 py-6 text-sm font-medium text-slate-600">{u.role}</td>
                    <td className="px-10 py-6 text-sm font-bold text-indigo-600">{u.company}</td>
                    <td className="px-10 py-6 relative">
                      <div className={`flex flex-wrap gap-1 cursor-pointer p-2 rounded-xl transition-all ${editingExpertiseUserId === u.id ? 'bg-white ring-4 ring-indigo-500/10 shadow-lg' : 'hover:bg-indigo-50'}`} onClick={() => setEditingExpertiseUserId(u.id)}>
                        {(u.categories || []).length > 0 ? (
                           u.categories.map(cat => (<span key={cat} className="text-[7px] font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100 uppercase">{cat}</span>))
                        ) : (<span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest italic">Aucune</span>)}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right space-x-4">
                      <button onClick={() => openEdit(u)} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all">Éditer</button>
                      <button onClick={() => onDeleteUser(u.id)} className="text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all">Suppr</button>
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
          {/* BARRE DE LANCEMENT DES ROUNDS */}
          <div className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-10 mb-10">
              <div className="text-center md:text-left">
                <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">Lancer les Rounds</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-3">Activez l'interface pour tous les participants</p>
              </div>
              {currentRound && (
                <Button variant="danger" size="sm" className="rounded-xl px-8" onClick={() => onSetCurrentRound(null)}>Arrêter Session</Button>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(r => (
                <button
                  key={r}
                  onClick={() => onSetCurrentRound(r)}
                  className={`w-20 h-20 md:w-28 md:h-28 rounded-3xl md:rounded-[2rem] font-black text-xl md:text-3xl transition-all flex flex-col items-center justify-center border-4 ${
                    currentRound === r 
                      ? 'bg-indigo-600 text-white border-white shadow-[0_0_30px_rgba(79,70,229,0.5)] scale-110' 
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-[10px] uppercase opacity-50 mb-1">Round</span>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-10">
             <div className="text-center md:text-left"><h3 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter">Générateur Planning</h3><p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-3">{meetings.length} matchs actifs</p></div>
             <div className="flex flex-col sm:flex-row gap-4"><Button size="lg" className="rounded-2xl h-18 px-12 font-black uppercase" onClick={onAutoMatch}>Reset & Relancer</Button><Button variant="secondary" size="lg" className="rounded-2xl h-18 px-12 font-black uppercase" onClick={onIncrementalMatch}>Actualiser Nouveaux</Button></div>
          </div>
          <div className="grid grid-cols-1 gap-16">
            {meetingsByRound.map(([round, roundMeetings]) => (
              <div key={round} className="space-y-8">
                <div className="flex items-center space-x-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl rotate-3 transition-colors ${parseInt(round) === currentRound ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-900 text-white'}`}>R{round}</div>
                  <h4 className={`text-3xl font-black uppercase italic ${parseInt(round) === currentRound ? 'text-indigo-600' : 'text-slate-900'}`}>Round {round}</h4>
                  <div className="h-px bg-slate-100 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {roundMeetings.map(m => {
                    const u1 = users.find(u => u.id === m.participant1Id);
                    const u2 = users.find(u => u.id === m.participant2Id);
                    const isSelected = selectedMeetingId === m.id;
                    const statusLabel = m.status === 'completed' ? 'Fini' : (m.status === 'ongoing' ? 'En cours' : 'À lancer');
                    const color = m.status === 'completed' ? 'bg-emerald-500' : (m.status === 'ongoing' ? 'bg-amber-500' : 'bg-slate-400');
                    return (
                      <div key={m.id} onClick={() => setSelectedMeetingId(isSelected ? null : m.id)} className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative cursor-pointer hover:shadow-2xl transition-all ${isSelected ? 'ring-4 ring-indigo-500/20' : ''} ${parseInt(round) === currentRound ? 'ring-2 ring-indigo-500/10 bg-indigo-50/10' : ''}`}>
                        <div className="absolute top-0 right-0 px-5 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-bl-[1.5rem] tracking-widest">T{m.tableNumber}</div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="text-center flex-1">
                            <img src={u1?.avatar} className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{u1?.firstName}</p>
                            <p className="text-[10px] font-black text-slate-900 uppercase">{u1?.lastName}</p>
                          </div>
                          <div className="px-4 text-[10px] font-black text-slate-200 tracking-[0.3em] rotate-90">VS</div>
                          <div className="text-center flex-1">
                            <img src={u2?.avatar} className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white mx-auto mb-2" />
                            <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{u2?.firstName}</p>
                            <p className="text-[10px] font-black text-slate-900 uppercase">{u2?.lastName}</p>
                          </div>
                        </div>
                        <div className="mt-8 flex justify-center"><div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase text-white shadow-lg ${color}`}>{statusLabel}</div></div>
                        <div className={`mt-6 pt-4 border-t border-slate-50 space-y-2 transition-all ${isSelected ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                           <p className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">Synergie : {m.category}</p>
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
    </div>
  );
};
