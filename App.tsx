
import React, { useState, useMemo, useEffect } from 'react';
import { AppMode, User, Meeting, Rating, ProfessionalCategory, UserSubState, AdminSubState } from './types';
import { MOCK_USERS, TIME_SLOTS } from './constants';
import { Button } from './components/Button';
import { Registration } from './components/Registration';
import { MeetingRoom } from './components/MeetingRoom';
import { Scoring } from './components/Scoring';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminAuth } from './components/AdminAuth';

const STORAGE_KEY_USERS = 'speed_matching_users_v2';
const STORAGE_KEY_MEETINGS = 'speed_matching_meetings_v2';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('PORTAL_SELECT');
  const [userState, setUserState] = useState<UserSubState>('REGISTRATION');
  const [adminState, setAdminState] = useState<AdminSubState>('PROFILES');
  
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Persistent State
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USERS);
    return saved ? JSON.parse(saved) : MOCK_USERS;
  });
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MEETINGS);
    return saved ? JSON.parse(saved) : [];
  });

  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
  }, [meetings]);

  // --- Actions ---

  const handleRegister = (newUser: User) => {
    setUsers(prev => {
      const exists = prev.find(u => u.name.toLowerCase() === newUser.name.toLowerCase());
      if (exists) {
        setCurrentUser(exists);
        return prev;
      }
      return [newUser, ...prev];
    });
    setCurrentUser(newUser);
    setUserState('SCHEDULE');
    setAppMode('USER_PORTAL');
  };

  const autoMatch = () => {
    const newMeetings: Meeting[] = [];
    let globalTableCounter = 1;
    const userRoundSchedules: Record<string, Set<number>> = {};
    users.forEach(u => userRoundSchedules[u.id] = new Set());

    // 1. Generate all possible unique pairs within same categories
    const possiblePairs: { u1: User, u2: User, category: ProfessionalCategory }[] = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const commonCategories = users[i].categories.filter(c => users[j].categories.includes(c));
        if (commonCategories.length > 0) {
          // Add pair with their first common category
          possiblePairs.push({ u1: users[i], u2: users[j], category: commonCategories[0] });
        }
      }
    }

    // Shuffle pairs for randomness
    possiblePairs.sort(() => Math.random() - 0.5);

    // 2. Assign pairs to rounds 1 to 7
    for (const pair of possiblePairs) {
      for (let round = 1; round <= 7; round++) {
        // Check if both users are free in this round
        if (!userRoundSchedules[pair.u1.id].has(round) && !userRoundSchedules[pair.u2.id].has(round)) {
          // Check if they already reached 7 rounds (redundant due to round loop but safe)
          if (userRoundSchedules[pair.u1.id].size < 7 && userRoundSchedules[pair.u2.id].size < 7) {
            newMeetings.push({
              id: `m-${pair.u1.id}-${pair.u2.id}-${round}-${Date.now()}`,
              participant1Id: pair.u1.id,
              participant2Id: pair.u2.id,
              tableNumber: globalTableCounter++,
              scheduledTime: TIME_SLOTS[round - 1] || "À venir",
              round: round,
              category: pair.category,
              status: 'scheduled',
              ratings: []
            });
            userRoundSchedules[pair.u1.id].add(round);
            userRoundSchedules[pair.u2.id].add(round);
            break; // Pair assigned to this round, move to next pair
          }
        }
      }
    }

    setMeetings(newMeetings);
    alert(`${newMeetings.length} rendez-vous générés sur 7 rounds.`);
  };

  const startMeeting = (id: string) => {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'ongoing', actualStartTime: Date.now() } : m));
    setActiveMeetingId(id);
    setUserState('ACTIVE_MEETING');
  };

  const finishMeeting = () => {
    setMeetings(prev => prev.map(m => m.id === activeMeetingId ? { ...m, status: 'completed' } : m));
    setUserState('SCORING');
  };

  const submitRating = (r: Rating) => {
    const updatedMeetings = meetings.map(m => {
      if (m.id === r.meetingId) {
        return { ...m, ratings: [...m.ratings, r] };
      }
      return m;
    });
    setMeetings(updatedMeetings);
    
    setUsers(prev => prev.map(u => {
      if (u.id === r.toId) {
        const userRatings = updatedMeetings.flatMap(m => m.ratings).filter(rat => rat.toId === u.id);
        const sum = userRatings.reduce((acc, curr) => acc + curr.score, 0);
        return { ...u, avgScore: sum / userRatings.length };
      }
      return u;
    }));

    setUserState('SCHEDULE');
    setActiveMeetingId(null);
  };

  const userMeetings = useMemo(() => {
    if (!currentUser) return [];
    return meetings.filter(m => m.participant1Id === currentUser.id || m.participant2Id === currentUser.id);
  }, [meetings, currentUser]);

  const getOtherParticipant = (m: Meeting) => {
    const otherId = m.participant1Id === currentUser?.id ? m.participant2Id : m.participant1Id;
    return users.find(u => u.id === otherId);
  };

  const resetAll = () => {
    if (confirm("Voulez-vous vraiment réinitialiser toutes les données (Utilisateurs et Matchs) ?")) {
      setUsers(MOCK_USERS);
      setMeetings([]);
      localStorage.clear();
      window.location.reload();
    }
  };

  // --- UI ---

  if (appMode === 'ADMIN_PORTAL' && !isAdminAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAdminAuthenticated(true)} onCancel={() => setAppMode('PORTAL_SELECT')} />;
  }

  if (appMode === 'PORTAL_SELECT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 selection:bg-indigo-500 selection:text-white">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-all cursor-pointer group shadow-2xl" onClick={() => setAppMode('USER_PORTAL')}>
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-indigo-500/20 shadow-2xl">
              <span className="text-5xl">👋</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Pair</h2>
            <p className="text-indigo-200/70 text-lg leading-relaxed">Inscrivez-vous, accédez à vos 7 rounds et évaluez vos échanges entre pairs.</p>
            <Button className="mt-10 w-full h-16 text-xl rounded-2xl" variant="primary">Accéder au Portail</Button>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-all cursor-pointer group shadow-2xl" onClick={() => setAppMode('ADMIN_PORTAL')}>
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-emerald-500/20 shadow-2xl">
              <span className="text-5xl">⚙️</span>
            </div>
            <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Admin</h2>
            <p className="text-emerald-200/70 text-lg leading-relaxed">Pilotage des rounds, gestion des profils et analyse des Power Duos.</p>
            <Button className="mt-10 w-full h-16 text-xl rounded-2xl" variant="secondary">Espace Admin</Button>
          </div>
        </div>
        <div className="absolute bottom-10 text-slate-500 font-bold tracking-widest text-xs uppercase opacity-50">
          Peer2Peer Networking • Saison 2
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-4 cursor-pointer group" onClick={() => setAppMode('PORTAL_SELECT')}>
          <div className="bg-indigo-600 w-10 h-10 rounded-xl text-white font-black flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-200">P2P</div>
          <span className="font-black text-2xl text-slate-900 tracking-tighter italic uppercase">Saison 2</span>
        </div>
        
        <div className="flex items-center space-x-6">
          {appMode === 'ADMIN_PORTAL' ? (
            <div className="bg-slate-100 p-1.5 rounded-2xl flex space-x-1">
              <Button variant={adminState === 'PROFILES' ? 'primary' : 'outline'} size="sm" className="rounded-xl border-none shadow-none px-5" onClick={() => setAdminState('PROFILES')}>Pairs</Button>
              <Button variant={adminState === 'PLANNING' ? 'primary' : 'outline'} size="sm" className="rounded-xl border-none shadow-none px-5" onClick={() => setAdminState('PLANNING')}>Rounds</Button>
              <Button variant={adminState === 'RESULTS' ? 'primary' : 'outline'} size="sm" className="rounded-xl border-none shadow-none px-5" onClick={() => setAdminState('RESULTS')}>Palmarès</Button>
            </div>
          ) : (
            currentUser && (
               <div className="flex items-center space-x-4 bg-indigo-50/50 px-4 py-2 rounded-2xl border border-indigo-100/50">
                 <div className="text-right">
                   <p className="text-sm font-black text-slate-900 leading-none">{currentUser.name}</p>
                   <p className="text-[10px] text-indigo-600 font-black uppercase mt-1 tracking-wider line-clamp-1 max-w-[150px]">{currentUser.categories.join(', ')}</p>
                 </div>
                 <img src={currentUser.avatar} className="w-10 h-10 rounded-xl border-2 border-white shadow-md" />
               </div>
            )
          )}
          <div className="h-8 w-px bg-slate-200 mx-2"></div>
          <Button variant="outline" size="sm" className="rounded-xl font-bold border-slate-200" onClick={() => {
            setAppMode('PORTAL_SELECT');
            setIsAdminAuthenticated(false);
          }}>Déconnexion</Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        {appMode === 'USER_PORTAL' && (
          <>
            {userState === 'REGISTRATION' && <Registration onRegister={handleRegister} />}
            {userState === 'SCHEDULE' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tight">Mon Programme</h2>
                    <p className="text-slate-500 text-lg mt-2 font-medium">Vos 7 sessions stratégiques de 8 minutes.</p>
                  </div>
                  <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center space-x-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-700 font-black text-sm uppercase tracking-widest">Session Active</span>
                  </div>
                </div>

                {userMeetings.length === 0 ? (
                  <div className="bg-white p-20 rounded-[3rem] text-center shadow-2xl shadow-indigo-500/5 border border-slate-100 flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-6">⏳</div>
                    <h3 className="text-2xl font-black text-slate-800">En attente de l'Admin de Session</h3>
                    <p className="text-slate-400 mt-3 max-w-md mx-auto text-lg">L'administration prépare actuellement les tables pour vos rounds de matching. Restez connecté !</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {userMeetings.sort((a,b) => a.round - b.round).map(m => {
                      const other = getOtherParticipant(m);
                      const isCompleted = m.status === 'completed';
                      return (
                        <div key={m.id} className={`group relative bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between ${isCompleted ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                          <div className="flex justify-between items-start mb-8">
                            <div className="flex flex-col gap-2">
                              <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit">Round {m.round}</span>
                              <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100">Table {m.tableNumber}</span>
                            </div>
                            <span className="text-slate-900 font-black text-lg bg-slate-50 px-4 py-2 rounded-2xl">{m.scheduledTime}</span>
                          </div>
                          
                          <div className="flex items-center space-x-5 mb-8">
                            <img src={other?.avatar} className="w-20 h-20 rounded-3xl shadow-lg border-4 border-white object-cover" />
                            <div>
                              <p className="text-2xl font-black text-slate-900 leading-tight">{other?.name}</p>
                              <p className="text-indigo-600 text-sm font-bold mt-1 uppercase tracking-tight line-clamp-1">{other?.role}</p>
                              <p className="text-slate-400 text-xs font-medium truncate max-w-[150px]">{other?.company}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {m.status === 'scheduled' && (
                              <Button className="w-full h-14 rounded-2xl text-lg font-black shadow-indigo-100 shadow-xl" onClick={() => startMeeting(m.id)}>LANCER L'ÉCHANGE</Button>
                            )}
                            {m.status === 'ongoing' && (
                              <Button className="w-full h-14 rounded-2xl text-lg font-black bg-amber-500 hover:bg-amber-600 shadow-amber-100 shadow-xl" onClick={() => startMeeting(m.id)}>REPRENDRE</Button>
                            )}
                            {isCompleted && (
                              <div className="bg-emerald-500 text-white text-center py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-200">Échange Terminé ✓</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {userState === 'ACTIVE_MEETING' && activeMeetingId && (
              <MeetingRoom 
                meeting={meetings.find(m => m.id === activeMeetingId)!} 
                participant={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!}
                onFinish={finishMeeting} 
              />
            )}
            {userState === 'SCORING' && activeMeetingId && (
              <Scoring 
                meetingId={activeMeetingId}
                meetingUser={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!} 
                onSubmit={submitRating} 
              />
            )}
          </>
        )}

        {appMode === 'ADMIN_PORTAL' && (
          <AdminDashboard 
            users={users}
            meetings={meetings}
            adminState={adminState}
            onUpdateUsers={setUsers}
            onAutoMatch={autoMatch}
            onManualMatch={(m) => setMeetings([...meetings, m])}
            onResetAll={resetAll}
          />
        )}
      </main>
      
      <footer className="py-8 px-8 border-t border-slate-100 bg-white text-center">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Expérience Networking Saison 2 • © 2026 Admin Version</p>
      </footer>
    </div>
  );
};

export default App;
