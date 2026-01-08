
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
  onManualMatch: (m: Meeting) => void;
  onResetAll: () => void;
}

type SortField = 'name' | 'role' | 'expertise' | 'score';
type SortOrder = 'asc' | 'desc';

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<string>('all');
  
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    company: '',
    role: '',
    categories: [ProfessionalCategory.DSI],
    bio: ''
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let valA: any = a[sortField as keyof User] || '';
      let valB: any = b[sortField as keyof User] || '';

      if (sortField === 'expertise') {
        valA = a.categories[0] || '';
        valB = b.categories[0] || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortOrder]);

  const processImportData = (data: any[]) => {
    const newUsers: User[] = data.map((row, index) => {
      // Cherche les colonnes Nom et Prénom (insensible à la casse)
      const keys = Object.keys(row);
      const nomKey = keys.find(k => k.toLowerCase().includes('nom')) || 'Nom';
      const prenomKey = keys.find(k => k.toLowerCase().includes('prénom') || k.toLowerCase().includes('prenom')) || 'Prénom';
      
      const nom = row[nomKey] || '';
      const prenom = row[prenomKey] || `User ${index + 1}`;
      
      return {
        id: `u-${Math.random().toString(36).substr(2, 9)}`,
        name: `${prenom} ${nom}`.trim(),
        company: row['Entreprise'] || row['Société'] || 'À compléter',
        role: row['Fonction'] || row['Poste'] || 'Consultant / Expert',
        categories: [ProfessionalCategory.AUTRE],
        bio: row['Bio'] || 'Profil importé via Excel.',
        avatar: `https://picsum.photos/seed/${nom}${prenom}${index}/200`,
        avgScore: 0
      };
    }).filter(u => u.name.length > 2);

    if (newUsers.length > 0) {
      onUpdateUsers([...newUsers, ...users]);
      setShowImportModal(false);
      alert(`${newUsers.length} contacts importés avec succès.`);
    } else {
      alert("Aucune donnée valide trouvée. Vérifiez que votre fichier contient des colonnes 'Nom' et 'Prénom'.");
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processImportData(data);
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier Excel.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleTextImport = () => {
    const lines = importText.split('\n').filter(l => l.trim().includes(','));
    const data = lines.map(line => {
      const [nom, prenom] = line.split(',').map(s => s.trim());
      return { Nom: nom, Prénom: prenom };
    });
    processImportData(data);
    setImportText('');
  };

  const deleteUser = (id: string) => {
    if (confirm("Supprimer définitivement ce pair ?")) {
      onUpdateUsers(users.filter(u => u.id !== id));
    }
  };
  
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categories || formData.categories.length === 0) {
      alert("At least one category required.");
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
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-10 max-w-xl w-full animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase">Import de Contacts</h3>
            <p className="text-slate-500 text-xs mb-8">Format recommandé : .xlsx ou .csv avec colonnes <b>Nom, Prénom</b>.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Excel Import Area */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Option 1 : Excel / CSV</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-40 border-2 border-dashed border-indigo-100 rounded-3xl bg-indigo-50/30 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all group"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">📊</div>
                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Choisir un fichier</p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleExcelImport}
                  />
                </div>
              </div>

              {/* Text Import Area */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Option 2 : Copier/Coller</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-3xl h-40 font-mono text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Dupont, Jean&#10;Martin, Alice"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <Button onClick={handleTextImport} disabled={!importText.trim()} className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs">Importer le texte</Button>
              <Button variant="outline" onClick={() => setShowImportModal(false)} className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs">Annuler</Button>
            </div>
            
            {isImporting && (
              <div className="mt-4 text-center text-[10px] font-black text-indigo-500 animate-pulse uppercase tracking-widest">Traitement en cours...</div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal (same as before) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl p-6 md:p-10 max-w-lg w-full animate-in zoom-in-95 duration-200 border border-white/20 my-auto">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-6 tracking-tighter uppercase">
              {editingUser ? "ÉDITER LE PROFIL" : "NOUVEAU PAIR"}
            </h3>
            <form onSubmit={handleSaveUser} className="space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
                  <input
                    className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entreprise</label>
                  <input
                    className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fonction</label>
                <input
                  className="w-full p-3 md:p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégories</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {Object.values(ProfessionalCategory).map(c => (
                    <label key={c} className="flex items-center space-x-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-100 cursor-pointer">
                      <input 
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={(formData.categories || []).includes(c)}
                        onChange={() => toggleCategory(c)}
                      />
                      <span className="truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expertise & Bio</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium italic"
                  rows={2}
                  value={formData.bio}
                  onChange={e => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="submit" className="flex-1 h-12 md:h-14 rounded-2xl font-black uppercase tracking-widest text-sm">Enregistrer</Button>
                <Button type="button" variant="outline" className="h-12 md:h-14 rounded-2xl font-black uppercase tracking-widest text-sm" onClick={() => setShowAddModal(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminState === 'PROFILES' && (
        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/30">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">LES PAIRS</h3>
              <p className="text-slate-500 font-medium text-sm md:text-base">{users.length} profils enregistrés.</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
               <Button variant="outline" size="sm" className="flex-1 md:flex-none rounded-xl font-bold flex items-center justify-center space-x-2" onClick={() => setShowImportModal(true)}>
                 <span>📥</span>
                 <span>Import Excel / CSV</span>
               </Button>
               <Button size="sm" className="flex-1 md:flex-none rounded-xl font-black uppercase tracking-widest" onClick={openAdd}>Nouveau</Button>
               <Button variant="danger" size="sm" className="flex-none rounded-xl font-bold" onClick={onResetAll}>Reset</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50">
                <tr>
                  <th onClick={() => handleSort('name')} className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-600 transition-colors">
                    Pair {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('role')} className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-600 transition-colors">
                    Fonction {sortField === 'role' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('expertise')} className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-indigo-600 transition-colors">
                    Expertise {sortField === 'expertise' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 md:px-8 py-4 md:py-6">
                      <div className="flex items-center space-x-3 md:space-x-5">
                        <img src={u.avatar} className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl shadow-md border-2 border-white group-hover:scale-110 transition-transform" />
                        <div>
                          <p className="font-black text-slate-900 text-sm md:text-lg leading-none mb-1">{u.name}</p>
                          <p className="text-[10px] md:text-xs text-slate-500 font-bold">{u.company}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-4 md:py-6">
                       <p className="text-xs md:text-sm font-bold text-slate-700">{u.role}</p>
                    </td>
                    <td className="px-6 md:px-8 py-4 md:py-6">
                      <div className="flex flex-wrap gap-1 max-w-[150px] md:max-w-xs">
                        {u.categories.map(cat => (
                          <span key={cat} className="text-[8px] md:text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100/50 uppercase tracking-widest truncate">{cat}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-4 md:py-6 text-right space-x-3">
                      <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-800 text-[10px] font-black uppercase tracking-widest">Éditer</button>
                      <button onClick={() => deleteUser(u.id)} className="text-rose-500 hover:text-rose-700 text-[10px] font-black uppercase tracking-widest">Suppr.</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminState === 'PLANNING' && (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">PILOTAGE</h3>
              <p className="text-slate-500 mt-2 text-sm md:text-lg font-medium">Matching par catégorie Saison 2.</p>
            </div>
            <Button size="lg" className="w-full md:w-auto h-16 md:h-20 px-12 text-lg md:text-xl font-black rounded-2xl md:rounded-3xl shadow-indigo-100 shadow-2xl uppercase tracking-widest" onClick={onAutoMatch}>Auto Matching</Button>
          </div>
          
          <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 md:gap-6 bg-slate-900 p-6 md:p-8 rounded-3xl md:rounded-[2rem] text-white">
            <div className="flex flex-col w-full md:flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-[0.2em] ml-1">Catégorie</label>
              <select 
                className="bg-white/10 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all" className="text-slate-900">Toutes</option>
                {Object.values(ProfessionalCategory).map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col w-full md:flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-[0.2em] ml-1">Session</label>
              <select 
                className="bg-white/10 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-black text-white outline-none focus:ring-2 focus:ring-indigo-500"
                value={filterRound}
                onChange={e => setFilterRound(e.target.value)}
              >
                <option value="all" className="text-slate-900">Tous les rounds</option>
                {[1,2,3,4,5,6,7].map(r => <option key={r} value={r} className="text-slate-900">Round {r}</option>)}
              </select>
            </div>
            <div className="w-full md:w-auto md:pt-6">
              <span className="block text-center bg-indigo-600 px-6 py-3 rounded-xl md:rounded-2xl font-black text-xs uppercase tracking-widest">
                {filteredMeetings.length} RDV
              </span>
            </div>
          </div>

          <div className="space-y-10 md:space-y-16">
            {meetingsByRound.map(([round, roundMeetings]) => (
              <div key={round} className="space-y-6">
                <div className="flex items-center space-x-4 md:space-x-6">
                  <div className="bg-slate-900 text-white w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-2xl shadow-xl">R{round}</div>
                  <h4 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">Round {round} <span className="text-slate-300 ml-1">({roundMeetings.length})</span></h4>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {roundMeetings.map(m => {
                    const u1 = users.find(u => u.id === m.participant1Id);
                    const u2 = users.find(u => u.id === m.participant2Id);
                    const isOngoing = m.status === 'ongoing';
                    const isCompleted = m.status === 'completed';
                    
                    return (
                      <div key={m.id} className="bg-white p-5 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                        <div className="absolute top-0 right-0 px-3 md:px-4 py-1.5 bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase rounded-bl-xl md:rounded-bl-2xl z-10">T{m.tableNumber}</div>
                        <div className="mb-3">
                          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 md:px-3 py-1 rounded-full line-clamp-1">{m.category}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                          <div className="text-center flex-1">
                            <img src={u1?.avatar} className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl mx-auto mb-2 border-2 border-slate-50 shadow-sm" />
                            <p className="text-[9px] md:text-[10px] font-black truncate max-w-[70px] mx-auto text-slate-900">{u1?.name || "???"}</p>
                          </div>
                          <div className="px-2">
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[8px] md:text-[10px] font-black text-slate-300 italic">VS</div>
                          </div>
                          <div className="text-center flex-1">
                            <img src={u2?.avatar} className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl mx-auto mb-2 border-2 border-slate-50 shadow-sm" />
                            <p className="text-[9px] md:text-[10px] font-black truncate max-w-[70px] mx-auto text-slate-900">{u2?.name || "???"}</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-3 md:mt-4 pt-3 md:pt-4 border-t border-slate-50">
                          <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">{m.scheduledTime}</span>
                          <span className={`text-[9px] md:text-[10px] font-black uppercase px-2 md:px-3 py-1 rounded-lg ${
                            isOngoing ? 'bg-amber-100 text-amber-700 animate-pulse' : 
                            isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {isOngoing ? 'EN COURS' : isCompleted ? 'FINI' : 'ATTENTE'}
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
        <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <section>
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 mb-8 md:mb-10 text-center md:text-left">
                <div>
                  <h3 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">PALMARÈS</h3>
                  <p className="text-slate-500 text-sm md:text-lg font-medium">Analyse des Power Duos Saison 2.</p>
                </div>
                <div className="bg-emerald-500 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl md:rounded-3xl font-black shadow-lg shadow-emerald-200 uppercase tracking-widest text-[10px] md:text-sm">
                   {duos.length} Duos Validés
                </div>
             </div>
             
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
              {duos.length === 0 ? (
                <div className="col-span-2 text-center p-16 md:p-32 bg-white rounded-3xl md:rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold text-lg md:text-xl italic">
                  Aucun round n'a encore été évalué par les deux parties.
                </div>
              ) : (
                duos.map((d, i) => (
                  <div key={i} className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-indigo-500/10 border border-slate-100 relative overflow-hidden group hover:-translate-y-2 transition-all duration-300">
                     <div className="absolute top-0 left-0 w-2 md:w-3 h-full bg-emerald-500"></div>
                     <div className="flex justify-between items-center mb-6 md:mb-8">
                        <div className="flex -space-x-4 md:-space-x-6">
                           <img src={d.p1?.avatar} className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl border-4 md:border-8 border-white shadow-xl relative z-10 group-hover:rotate-6 transition-transform object-cover" />
                           <img src={d.p2?.avatar} className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl border-4 md:border-8 border-white shadow-xl relative z-0 group-hover:-rotate-6 transition-transform object-cover" />
                        </div>
                        <div className="text-right">
                           <div className="text-4xl md:text-6xl font-black text-emerald-600 leading-none">{d.avg.toFixed(1)}</div>
                           <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-2">Synergie</div>
                        </div>
                     </div>
                     <div className="mb-6 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
                        <div>
                           <p className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter">{d.p1?.name} & {d.p2?.name}</p>
                           <p className="text-[9px] md:text-xs font-black text-indigo-600 uppercase tracking-widest mt-1 md:mt-2 bg-indigo-50 px-3 md:px-4 py-1.5 rounded-full w-fit">{d.m.category}</p>
                        </div>
                        <div className="bg-emerald-50 text-emerald-700 px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase tracking-widest border border-emerald-100">TOP DUO</div>
                     </div>
                     <div className="pt-6 md:pt-8 border-t border-slate-100 bg-slate-50/50 -mx-6 md:-mx-10 px-6 md:px-10 pb-2">
                        <h5 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase mb-3 md:mb-4 tracking-widest">Feedback croisé</h5>
                        <div className="space-y-3 md:space-y-4">
                           {d.m.ratings.map((r, ri) => (
                              <div key={ri} className="flex items-start space-x-2 md:space-x-3">
                                 <span className="text-emerald-500 mt-1 text-sm md:text-base">✓</span>
                                 <p className="text-xs md:text-sm italic text-slate-700 leading-relaxed font-medium">"{r.comment || "Échange riche entre pairs."}"</p>
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
