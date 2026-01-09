
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
  onResetPlanning: () => void;
  onResetPalmares: () => void;
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
  onResetAll,
  onResetPlanning,
  onResetPalmares
}) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingExpertiseUserId, setEditingExpertiseUserId] = useState<string | null>(null);
  const expertiseMenuRef = useRef<HTMLDivElement>(null);
  
  const [filterPlanningRound, setFilterPlanningRound] = useState<number | 'all'>('all');
  const [filterPlanningExpertise, setFilterPlanningExpertise] = useState<ProfessionalCategory | 'all'>('all');
  const [filterPlanningTable, setFilterPlanningTable] = useState<string>('');

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
      if (expertiseMenuRef.current && !expertiseMenuRef.current.contains(event.target as Node)) {
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

  const exportUsersToExcel = () => {
    const exportData = users.map(u => ({
      ID: u.id,
      Prénom: u.firstName,
      Nom: u.lastName,
      Entreprise: u.company,
      Fonction: u.role,
      Expertises: u.categories.join(', '),
      Code: u.connectionCode,
      'Note Moyenne': u.avgScore.toFixed(2),
      'Match Final ID': u.matchId || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pairs");
    XLSX.writeFile(wb, "P2P_Pairs_Saison2.xlsx");
  };

  const exportPlanningToExcel = () => {
    const exportData = meetings.map(m => {
      const u1 = users.find(u => u.id === m.participant1Id);
      const u2 = users.find(u => u.id === m.participant2Id);
      return {
        Round: m.round,
        Table: m.tableNumber,
        Catégorie: m.category,
        'Participant 1': u1?.name || m.participant1Id,
        'Entreprise 1': u1?.company || '',
        'Participant 2': u2?.name || m.participant2Id,
        'Entreprise 2': u2?.company || '',
        Statut: m.status
      };
    }).sort((a, b) => a.Round - b.Round || a.Table - b.Table);

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planning");
    XLSX.writeFile(wb, "P2P_Planning_Saison2.xlsx");
  };

  const exportResultsToExcel = () => {
    const exportData = potentialMatches.map(pm => ({
      'Pair 1': pm.u1.name,
      'Entreprise 1': pm.u1.company,
      'Pair 2': pm.u2.name,
      'Entreprise 2': pm.u2.company,
      'Score Synergie (Somme)': pm.score,
      'Moyenne (/5)': (pm.score / 2).toFixed(2),
      'Match Validé': pm.u1.matchId === pm.u2.id ? 'OUI' : 'NON'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matchs");
    XLSX.writeFile(wb, "P2P_Resultats_Duos_Saison2.xlsx");
  };

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
    if(!confirm("Valider ce Duo comme Match Officiel pour le Palmarès ?")) return;
    await dbService.updateUser(u1Id, { matchId: u2Id });
    await dbService.updateUser(u2Id, { matchId: u1Id });
    alert("Match validé ! Les participants recevront le résultat.");
  };

  const toggleQuickCategory = (userId: string, category: ProfessionalCategory) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const currentCats = user.categories || [];
    const isSelected = currentCats.includes(category);
    let newCats;
    if (isSelected) {
      newCats = currentCats.filter(c => c !== category);
    } else {
      newCats = [...currentCats, category];
    }
    onUpdateUsers(users.map(u => u.id === userId ? { ...u, categories: newCats } : u));
  };

  const potentialMatches = useMemo(() => {
    const pairs: { u1: User, u2: User, score: number, meeting: Meeting }[] = [];
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

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const roundMatch = filterPlanningRound === 'all' || m.round === filterPlanningRound;
      const expertiseMatch = filterPlanningExpertise === 'all' || m.category === filterPlanningExpertise;
      const tableMatch = !filterPlanningTable || m.tableNumber.toString().includes(filterPlanningTable);
      
      let searchMatch = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const u1 = users.find(u => u.id === m.participant1Id);
        const u2 = users.find(u => u.id === m.participant2Id);
        searchMatch = (u1?.name.toLowerCase().includes(q) || u2?.name.toLowerCase().includes(q));
      }

      return roundMatch && expertiseMatch && tableMatch && searchMatch;
    });
  }, [meetings, filterPlanningRound, filterPlanningExpertise, filterPlanningTable, searchQuery, users]);

  const meetingsByRound = useMemo(() => {
    const rounds: Record<number, Meeting[]> = {};
    
    filteredMeetings.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });

    Object.keys(rounds).forEach(r => {
      rounds[parseInt(r)].sort((a, b) => a.tableNumber - b.tableNumber);
    });

    return Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b));
  }, [filteredMeetings]);

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      
      <div className="sticky top-[80px] z-40 bg-white/80 backdrop-blur-md p-4 border-b border-slate-100 rounded-2xl shadow-sm">
        <div className="max-w-xl mx-auto relative group">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">🔍</span>
          <input 
            type="text" 
            placeholder="Rechercher un pair, entreprise, code..." 
            className="w-full h-14 pl-14 pr-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center bg-slate-50/30 gap-6">
            <div><h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Les Pairs</h3><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">{filteredAndSortedUsers.length} profils actifs</p></div>
            <div className="flex flex-wrap gap-3">
               <Button variant="outline" size="sm" className="rounded-xl font-bold px-6 border-slate-200" onClick={() => setShowImportModal(true)}>📁 Import Excel</Button>
               <Button variant="outline" size="sm" className="rounded-xl font-bold px-6 border-slate-200" onClick={exportUsersToExcel}>📤 Exporter (.xlsx)</Button>
               <Button size="sm" className="rounded-xl font-black uppercase px-8 shadow-xl" onClick={openAdd}>➕ Ajouter Manuel</Button>
               <Button variant="danger" size="sm" className="rounded-xl font-bold px-6 shadow-lg shadow-rose-100" onClick={onResetAll}>⚠️ Reset Tout (Global)</Button>
            </div>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('firstName')}>Prénom</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('lastName')}>Nom</th>
                  <th className="px-10 py-6 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('company')}>Entreprise</th>
                  <th className="px-10 py-6">Code</th>
                  <th className="px-10 py-6">Expertises (Clic pour modif.)</th>
                  <th className="px-10 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-6 font-bold text-slate-900">{u.firstName}</td>
                    <td className="px-10 py-6 font-black text-slate-900 uppercase tracking-tight">{u.lastName}</td>
                    <td className="px-10 py-6 text-sm font-medium text-slate-600">{u.company}</td>
                    <td className="px-10 py-6"><span className="bg-indigo-50 text-indigo-700 font-black px-2 py-1 rounded text-[10px] border border-indigo-100">{u.connectionCode || '----'}</span></td>
                    <td className="px-10 py-6 relative">
                      <div 
                        onClick={() => setEditingExpertiseUserId(u.id)}
                        className="flex flex-wrap gap-1 max-w-[250px] cursor-pointer hover:bg-indigo-50 p-2 rounded-xl border border-transparent hover:border-indigo-100 transition-all min-h-[40px]"
                      >
                        {u.categories?.length > 0 ? (
                          u.categories.map(c => (
                            <span key={c} className="text-[8px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase truncate">{c}</span>
                          ))
                        ) : (
                          <span className="text-[9px] text-slate-300 italic font-medium">Cliquer pour choisir</span>
                        )}
                      </div>
                      
                      {editingExpertiseUserId === u.id && (
                        <div 
                          ref={expertiseMenuRef}
                          className="absolute z-50 top-full left-10 mt-2 w-64 bg-white shadow-2xl rounded-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-200"
                        >
                          <div className="mb-3 flex justify-between items-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Modifier Expertises</p>
                            <button onClick={() => setEditingExpertiseUserId(null)} className="text-slate-400 hover:text-rose-500 font-bold text-xs">&times;</button>
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                            {Object.values(ProfessionalCategory).map(cat => (
                              <label key={cat} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                                <input 
                                  type="checkbox" 
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={u.categories?.includes(cat)}
                                  onChange={() => toggleQuickCategory(u.id, cat)}
                                />
                                <span className={`text-[9px] font-bold uppercase truncate ${u.categories?.includes(cat) ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-900'}`}>{cat}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
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

      {adminState === 'PLANNING' && (
        <div className="space-y-12">
          <div className="bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl text-center">
            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-10">Pilotage Live</h3>
            <div className="flex flex-wrap justify-center gap-6">
              {[1, 2, 3, 4, 5, 6, 7].map(r => (
                <button 
                  key={r} 
                  onClick={() => onSetCurrentRound(r)}
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-[2rem] font-black text-2xl border-4 transition-all flex flex-col items-center justify-center ${currentRound === r ? 'bg-indigo-600 border-white text-white scale-110 shadow-xl' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                >
                  <span className="text-[8px] uppercase opacity-50 mb-1">Round</span>
                  {r}
                </button>
              ))}
              <div className="w-px h-24 bg-white/10 mx-2 hidden md:block"></div>
              <button 
                onClick={() => onSetCurrentRound(0)} 
                className={`h-24 px-10 rounded-[2.5rem] font-black text-xl border-4 transition-all ${currentRound === 0 ? 'bg-amber-500 border-white text-white scale-110 shadow-xl' : 'bg-white/5 border-white/10 text-amber-500 hover:border-amber-500/20'}`}
              >
                Pause ☕️
              </button>
              <button 
                onClick={() => onSetCurrentRound(-1)} 
                className={`h-24 px-10 rounded-[2.5rem] font-black text-xl border-4 transition-all ${currentRound === -1 ? 'bg-rose-600 border-white text-white scale-110 shadow-xl' : 'bg-white/5 border-white/10 text-rose-500 hover:border-rose-500/20'}`}
              >
                Fin & Résultats 🏁
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Filtres Planning</h4>
              <div className="flex flex-wrap gap-2">
                 <Button variant="secondary" size="sm" className="rounded-xl h-12 font-black uppercase" onClick={onAutoMatch}>Reset & Tout Relancer</Button>
                 <Button variant="outline" size="sm" className="rounded-xl h-12 border-slate-200 font-black uppercase" onClick={onIncrementalMatch}>Matching Nouveaux</Button>
                 <Button variant="outline" size="sm" className="rounded-xl h-12 border-slate-200 font-black uppercase" onClick={exportPlanningToExcel}>📤 Exporter Planning</Button>
                 <Button variant="danger" size="sm" className="rounded-xl h-12 font-black uppercase" onClick={onResetPlanning}>🗑 Vider Planning</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-2">Afficher Round</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button onClick={() => setFilterPlanningRound('all')} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterPlanningRound === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>Tous</button>
                  {[1,2,3,4,5,6,7].map(r => (
                    <button key={r} onClick={() => setFilterPlanningRound(r)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${filterPlanningRound === r ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>{r}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-2">Table n°</label>
                <input 
                  type="number" 
                  placeholder="Ex: 5"
                  className="h-10 w-24 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold outline-none focus:border-indigo-600"
                  value={filterPlanningTable}
                  onChange={(e) => setFilterPlanningTable(e.target.value)}
                />
              </div>

              <div className="space-y-2 flex-1 min-w-[200px]">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-2">Filtrer Synergie</label>
                <select 
                  className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-[10px] font-black uppercase outline-none focus:border-indigo-600"
                  value={filterPlanningExpertise}
                  onChange={(e) => setFilterPlanningExpertise(e.target.value as any)}
                >
                  <option value="all">Toutes les expertises</option>
                  {Object.values(ProfessionalCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => { setFilterPlanningRound('all'); setFilterPlanningExpertise('all'); setFilterPlanningTable(''); setSearchQuery(''); }}
                className="h-10 px-4 text-[8px] font-black text-rose-500 uppercase hover:bg-rose-50 rounded-xl transition-all"
              >
                Effacer Filtres
              </button>
            </div>
          </div>

          <div className="space-y-16">
            {meetingsByRound.length === 0 ? (
              <div className="p-20 text-center flex flex-col items-center">
                <span className="text-5xl mb-6 opacity-20">📭</span>
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Aucun match ne correspond aux filtres actuels.</p>
              </div>
            ) : (
              meetingsByRound.map(([round, roundMeetings]) => (
                <div key={round} className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center space-x-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${parseInt(round) === currentRound ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900 text-white'}`}>R{round}</div>
                    <h4 className={`text-2xl font-black uppercase italic ${parseInt(round) === currentRound ? 'text-indigo-600' : 'text-slate-900'}`}>Round {round}</h4>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{roundMeetings.length} matchs</span>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {roundMeetings.map(m => {
                      const u1 = users.find(u => u.id === m.participant1Id);
                      const u2 = users.find(u => u.id === m.participant2Id);
                      return (
                        <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
                           <div className="absolute top-0 right-0 px-3 py-1.5 bg-slate-900 text-white text-[8px] font-black uppercase rounded-bl-xl tracking-widest">T{m.tableNumber}</div>
                           <div className="flex items-center justify-between mt-2">
                             <div className="text-center flex-1">
                               <img src={u1?.avatar} className="w-10 h-10 rounded-xl mx-auto mb-1 border-2 border-slate-50" />
                               <p className="text-[7px] font-black uppercase truncate">{u1?.name}</p>
                             </div>
                             <div className="px-2 font-black text-slate-100 text-[8px]">&rarr;</div>
                             <div className="text-center flex-1">
                               <img src={u2?.avatar} className="w-10 h-10 rounded-xl mx-auto mb-1 border-2 border-slate-50" />
                               <p className="text-[7px] font-black uppercase truncate">{u2?.name}</p>
                             </div>
                         </div>
                         <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[120px]">{m.category}</span>
                            <div className={`w-2 h-2 rounded-full ${m.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : m.status === 'ongoing' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-200'}`}></div>
                         </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {adminState === 'RESULTS' && (
        <div className="space-y-12">
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full"></div>
            <h3 className="text-5xl font-black uppercase italic tracking-tighter mb-4 text-center">🏆 Palmarès des Synergies</h3>
            <p className="text-indigo-200 text-center font-bold uppercase tracking-widest text-xs">Analyse des duos basée sur les notes réciproques (Somme des deux scores / 10)</p>
          </div>

          <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
              <div><h4 className="text-3xl font-black uppercase italic tracking-tight">Matchs & Alliances</h4><p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2">{potentialMatches.length} alliances potentielles détectées</p></div>
              <div className="flex gap-4">
                <Button variant="outline" size="sm" className="rounded-xl h-12 border-slate-200 font-black uppercase" onClick={exportResultsToExcel}>📤 Exporter Matchs</Button>
                <Button variant="danger" size="sm" className="rounded-xl h-12 font-black uppercase" onClick={onResetPalmares}>🗑 Reset Palmarès</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="px-10 py-6">Duo Performance</th>
                    <th className="px-10 py-6">Synergie (Score)</th>
                    <th className="px-10 py-6">Statut Alliance</th>
                    <th className="px-10 py-6 text-right">Décision Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {potentialMatches.map((pm) => {
                    const isMatched = pm.u1.matchId === pm.u2.id;
                    const isOtherMatched = (pm.u1.matchId && !isMatched) || (pm.u2.matchId && !isMatched);
                    return (
                      <tr key={pm.meeting.id} className={`hover:bg-slate-50 transition-colors ${isMatched ? 'bg-emerald-50/50' : isOtherMatched ? 'opacity-30' : ''}`}>
                        <td className="px-10 py-6">
                           <div className="flex items-center space-x-4">
                              <div className="flex -space-x-4">
                                <img src={pm.u1.avatar} className="w-12 h-12 rounded-xl border-2 border-white shadow-lg" />
                                <img src={pm.u2.avatar} className="w-12 h-12 rounded-xl border-2 border-white shadow-lg" />
                              </div>
                              <div>
                                <p className="font-black text-sm text-slate-900 uppercase tracking-tight">{pm.u1.name} & {pm.u2.name}</p>
                                <p className="text-[10px] text-indigo-500 font-bold">{pm.u1.company} • {pm.u2.company}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center space-x-4">
                            <span className="font-black text-3xl text-indigo-600">{pm.score}</span>
                            <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${pm.score * 10}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                           {isMatched ? (
                             <div className="flex items-center space-x-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                               <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                               <span>Duo Officiel</span>
                             </div>
                           ) : isOtherMatched ? (
                             <div className="text-rose-400 font-bold text-[9px] uppercase italic">Conflit: Participant apparié</div>
                           ) : (
                             <div className="text-slate-300 font-black text-[10px] uppercase tracking-widest">En attente</div>
                           )}
                        </td>
                        <td className="px-10 py-6 text-right">
                           {!isMatched && !isOtherMatched && (
                             <Button size="sm" className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest shadow-xl" onClick={() => handleConfirmMatch(pm.u1.id, pm.u2.id)}>Valider Duo</Button>
                           )}
                           {isMatched && (
                             <span className="text-emerald-500 font-black text-xl">🤝</span>
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

      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-14 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-4xl font-black text-slate-900 uppercase italic mb-8">{editingUser ? 'Modifier Pair' : 'Nouveau Pair'}</h3>
            <form onSubmit={handleSaveUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Prénom</label>
                  <input type="text" required className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:border-indigo-600 outline-none" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nom</label>
                  <input type="text" required className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold uppercase focus:border-indigo-600 outline-none" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Entreprise</label>
                  <input type="text" required className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:border-indigo-600 outline-none" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Poste</label>
                  <input type="text" required className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold focus:border-indigo-600 outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Expertises</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 rounded-3xl border border-slate-100">
                   {Object.values(ProfessionalCategory).map(cat => (
                     <label key={cat} className="flex items-center space-x-3 p-2 bg-white rounded-xl border cursor-pointer hover:border-indigo-300 transition-all">
                       <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-indigo-600"
                        checked={formData.categories?.includes(cat)} 
                        onChange={() => {
                          const current = formData.categories || [];
                          const updated = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
                          setFormData({...formData, categories: updated});
                        }} 
                       />
                       <span className="text-[9px] font-bold text-slate-600 uppercase truncate">{cat}</span>
                     </label>
                   ))}
                </div>
              </div>
              <div className="flex justify-end gap-6 pt-10 border-t border-slate-50">
                <button type="button" className="text-slate-400 font-black uppercase text-xs tracking-widest" onClick={() => setShowAddModal(false)}>Annuler</button>
                <Button type="submit" className="px-12 rounded-2xl h-16 uppercase font-black tracking-widest">Enregistrer</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl p-16 shadow-2xl animate-in zoom-in-95 duration-300 text-center">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 text-5xl">📁</div>
            <h3 className="text-3xl font-black text-slate-900 uppercase italic mb-4">Importation Pairs</h3>
            <p className="text-slate-500 font-medium mb-12">Le fichier doit contenir les colonnes : <br/><span className="font-bold text-indigo-600 uppercase tracking-wider">Prénom, Nom, Entreprise, Fonction</span></p>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              id="excel-up-admin-final-v3" 
              onChange={handleExcelImport} 
            />
            <label 
              htmlFor="excel-up-admin-final-v3" 
              className="block w-full py-14 border-4 border-dashed border-slate-100 rounded-[3rem] cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition-all font-black text-slate-300 hover:text-indigo-600 uppercase tracking-[0.3em] mb-10"
            >
              Cliquer pour parcourir
            </label>
            <button className="text-slate-400 font-black text-xs uppercase tracking-widest" onClick={() => setShowImportModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
};
