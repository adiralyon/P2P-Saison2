
import React, { useState, useMemo, useEffect } from 'react';
import { AppMode, User, Meeting, Rating, ProfessionalCategory, UserSubState, AdminSubState } from './types';
import { TIME_SLOTS } from './constants';
import { Button } from './components/Button';
import { Registration } from './components/Registration';
import { MeetingRoom } from './components/MeetingRoom';
import { Scoring } from './components/Scoring';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminAuth } from './components/AdminAuth';
import { dbService } from './services/database';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('PORTAL_SELECT');
  const [userState, setUserState] = useState<UserSubState>('REGISTRATION');
  const [adminState, setAdminState] = useState<AdminSubState>('PROFILES');
  
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  useEffect(() => {
    let timeout = setTimeout(() => setIsLoading(false), 5000); 

    const unsubscribeUsers = dbService.subscribeToUsers((cloudUsers) => {
      setUsers(cloudUsers || []);
      setIsLoading(false);
      clearTimeout(timeout);
    });

    const unsubscribeMeetings = dbService.subscribeToMeetings((cloudMeetings) => {
      setMeetings(cloudMeetings || []);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMeetings();
    };
  }, []);

  const handleRegister = async (newUser: User) => {
    setIsSyncing(true);
    try {
      const exists = users.find(u => u.name.toLowerCase() === newUser.name.toLowerCase());
      if (exists) {
        setCurrentUser(exists);
      } else {
        await dbService.saveUser(newUser);
        setCurrentUser(newUser);
      }
      setUserState('SCHEDULE');
      setAppMode('USER_PORTAL');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateUsers = async (newList: User[]) => {
    setIsSyncing(true);
    try {
      await dbService.syncAllUsers(newList);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Génération de planning
   * @param incremental Si vrai, garde les matchs existants et complète avec les nouveaux inscrits
   */
  const runAutoMatch = async (incremental: boolean = false) => {
    setIsSyncing(true);
    try {
      const existingMeetings = incremental ? [...meetings] : [];
      const newMeetings: Meeting[] = incremental ? [...meetings] : [];
      
      const roundTableCounters: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
      
      // Initialiser les plannings par utilisateur
      const userRoundSchedules: Record<string, Set<number>> = {};
      users.forEach(u => userRoundSchedules[u.id] = new Set());

      // Remplir avec les matchs existants si incrémental
      if (incremental) {
        existingMeetings.forEach(m => {
          userRoundSchedules[m.participant1Id]?.add(m.round);
          userRoundSchedules[m.participant2Id]?.add(m.round);
          if (roundTableCounters[m.round] <= m.tableNumber) {
            roundTableCounters[m.round] = m.tableNumber + 1;
          }
        });
      }

      // Identifier les paires possibles qui n'ont pas encore de match
      const possiblePairs: { u1: User, u2: User, category: ProfessionalCategory }[] = [];
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          // Vérifier si ces deux là ont déjà un match ensemble
          const alreadyMatched = incremental && existingMeetings.some(m => 
            (m.participant1Id === users[i].id && m.participant2Id === users[j].id) ||
            (m.participant1Id === users[j].id && m.participant2Id === users[i].id)
          );
          
          if (!alreadyMatched) {
            const u1Cats = users[i].categories || [];
            const u2Cats = users[j].categories || [];
            const common = u1Cats.filter(c => u2Cats.includes(c));
            if (common.length > 0) {
              possiblePairs.push({ u1: users[i], u2: users[j], category: common[0] });
            }
          }
        }
      }

      possiblePairs.sort(() => Math.random() - 0.5);

      for (const pair of possiblePairs) {
        for (let round = 1; round <= 7; round++) {
          if (!userRoundSchedules[pair.u1.id].has(round) && !userRoundSchedules[pair.u2.id].has(round)) {
            newMeetings.push({
              id: `m-${pair.u1.id}-${pair.u2.id}-${round}`,
              participant1Id: pair.u1.id,
              participant2Id: pair.u2.id,
              tableNumber: roundTableCounters[round]++,
              scheduledTime: TIME_SLOTS[round - 1] || "À venir",
              round: round,
              category: pair.category,
              status: 'scheduled',
              ratings: []
            });
            userRoundSchedules[pair.u1.id].add(round);
            userRoundSchedules[pair.u2.id].add(round);
            break; 
          }
        }
      }
      await dbService.saveMeetings(newMeetings);
      alert(incremental ? "Planning actualisé avec les nouveaux inscrits." : "Nouveau planning généré.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors du matching.");
    } finally {
      setIsSyncing(false);
    }
  };

  const startMeeting = async (id: string) => {
    await dbService.updateMeeting(id, { status: 'ongoing', actualStartTime: Date.now() });
    setActiveMeetingId(id);
    setUserState('ACTIVE_MEETING');
  };

  const finishMeeting = async () => {
    if (activeMeetingId) {
      await dbService.updateMeeting(activeMeetingId, { status: 'completed' });
      setUserState('SCORING');
    }
  };

  const submitRating = async (r: Rating) => {
    setIsSyncing(true);
    try {
      const meeting = meetings.find(m => m.id === r.meetingId);
      if (!meeting) return;
      const updatedRatings = [...(meeting.ratings || []), r];
      await dbService.updateMeeting(r.meetingId, { ratings: updatedRatings });
      
      const userToUpdate = users.find(u => u.id === r.toId);
      if (userToUpdate) {
        const allRatings = meetings
          .flatMap(m => m.id === r.meetingId ? updatedRatings : (m.ratings || []))
          .filter(rat => rat.toId === r.toId);
        const avg = allRatings.reduce((acc, curr) => acc + curr.score, 0) / allRatings.length;
        await dbService.updateUser(r.toId, { avgScore: avg });
      }
      setUserState('SCHEDULE');
    } finally {
      setIsSyncing(false);
    }
  };

  const resetAll = async () => {
    if (confirm("Reset complet des données ?")) {
      await dbService.resetAll();
      window.location.reload();
    }
  };

  const userMeetings = useMemo(() => {
    if (!currentUser) return [];
    return (meetings || []).filter(m => m.participant1Id === currentUser.id || m.participant2Id === currentUser.id);
  }, [meetings, currentUser]);

  const getOtherParticipant = (m: Meeting) => {
    const otherId = m.participant1Id === currentUser?.id ? m.participant2Id : m.participant1Id;
    return users.find(u => u.id === otherId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black uppercase italic tracking-widest">Initialisation Cloud</h2>
      </div>
    );
  }

  if (appMode === 'ADMIN_PORTAL' && !isAdminAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAdminAuthenticated(true)} onCancel={() => setAppMode('PORTAL_SELECT')} />;
  }

  if (appMode === 'PORTAL_SELECT') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-6 selection:bg-indigo-500 selection:text-white overflow-y-auto">
        {/* LOGO AU DESSUS DES ACCÈS */}
        <div className="flex flex-col items-center mb-16 animate-in fade-in slide-in-from-top-10 duration-1000">
           <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] text-white font-black flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] text-3xl mb-6 hover:rotate-12 transition-transform cursor-pointer">
             P2P
           </div>
           <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase text-center leading-none">
             Saison 2
           </h1>
           <div className="h-1 w-24 bg-indigo-500 mt-6 rounded-full"></div>
           <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-4 opacity-60">Speed Matching Entre Pairs</p>
        </div>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in zoom-in duration-700 delay-300">
          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 hover:scale-[1.02] transition-all cursor-pointer group shadow-2xl flex flex-col items-center" onClick={() => setAppMode('USER_PORTAL')}>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 text-3xl group-hover:scale-110 transition-transform shadow-inner">👋</div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Portail Pair</h2>
            <p className="text-indigo-200/50 text-xs mb-8 uppercase font-bold tracking-widest">Accès Participant</p>
            <Button className="w-full h-16 rounded-2xl text-lg font-black tracking-widest uppercase" variant="primary">Se connecter</Button>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 hover:scale-[1.02] transition-all cursor-pointer group shadow-2xl flex flex-col items-center" onClick={() => setAppMode('ADMIN_PORTAL')}>
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 text-3xl group-hover:scale-110 transition-transform shadow-inner">⚙️</div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Espace Admin</h2>
            <p className="text-emerald-200/50 text-xs mb-8 uppercase font-bold tracking-widest">Pilotage Session</p>
            <Button className="w-full h-16 rounded-2xl text-lg font-black tracking-widest uppercase" variant="secondary">Gérer</Button>
          </div>
        </div>
        
        <div className="mt-20 flex items-center space-x-2 text-slate-500 font-bold text-[9px] uppercase tracking-widest opacity-40">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
           <span>Cloud Synchronized & AI Powered</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setAppMode('PORTAL_SELECT')}>
          <div className="bg-indigo-600 w-10 h-10 rounded-xl text-white font-black flex items-center justify-center shadow-lg text-sm group-hover:rotate-12 transition-transform">P2P</div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-2xl text-slate-900 tracking-tighter italic uppercase">Saison 2</span>
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'Sync...' : 'Online'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {appMode === 'ADMIN_PORTAL' ? (
            <div className="bg-slate-100 p-1 rounded-2xl flex space-x-1">
              <button className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${adminState === 'PROFILES' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('PROFILES')}>Pairs</button>
              <button className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${adminState === 'PLANNING' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('PLANNING')}>Rounds</button>
              <button className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${adminState === 'RESULTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('RESULTS')}>Bilans</button>
            </div>
          ) : (
            currentUser && (
               <div className="flex items-center space-x-3 bg-indigo-50 px-3 py-1.5 rounded-2xl border border-indigo-100">
                 <div className="text-right hidden sm:block">
                   <p className="text-xs font-black text-slate-900">{currentUser.name}</p>
                   <p className="text-[8px] text-indigo-500 font-bold uppercase tracking-widest">{currentUser.company}</p>
                 </div>
                 <img src={currentUser.avatar} className="w-10 h-10 rounded-xl border-2 border-white shadow-md" />
               </div>
            )
          )}
          <Button variant="outline" size="sm" className="rounded-xl font-bold text-[10px] uppercase tracking-widest border-slate-200" onClick={() => { setAppMode('PORTAL_SELECT'); setIsAdminAuthenticated(false); }}>Sortie</Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        {appMode === 'USER_PORTAL' && (
          <>
            {userState === 'REGISTRATION' && <Registration onRegister={handleRegister} />}
            {userState === 'SCHEDULE' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex justify-between items-end border-b border-slate-100 pb-8">
                   <div>
                    <h2 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic">Mon Planning</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Saison 2 • Live Sessions</p>
                   </div>
                   <div className="flex items-center space-x-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                     <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Connecté</span>
                   </div>
                </div>

                {userMeetings.length === 0 ? (
                  <div className="bg-white p-20 rounded-[4rem] text-center shadow-2xl shadow-indigo-500/5 border border-slate-100 flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center text-5xl mb-8">⏳</div>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight uppercase">En attente de l'Admin</h3>
                    <p className="text-slate-400 mt-4 max-w-sm mx-auto font-medium">Les rounds vont être lancés sous peu. Dès que le matching sera validé, votre planning s'affichera ici instantanément.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {userMeetings.sort((a,b) => a.round - b.round).map(m => {
                      const other = getOtherParticipant(m);
                      const isCompleted = m.status === 'completed';
                      return (
                        <div key={m.id} className={`group relative bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 ${isCompleted ? 'opacity-50 grayscale-[0.8]' : ''}`}>
                          <div className="flex justify-between items-start mb-8">
                            <div className="flex flex-col">
                               <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit mb-2">Round {m.round}</span>
                               <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit border border-indigo-100">Table {m.tableNumber}</span>
                            </div>
                            <span className="text-slate-900 font-black text-2xl tracking-tighter italic">{m.scheduledTime}</span>
                          </div>
                          <div className="flex items-center space-x-6 mb-10">
                            <img src={other?.avatar} className="w-24 h-24 rounded-3xl shadow-xl border-4 border-white object-cover group-hover:scale-105 transition-transform" />
                            <div>
                              <p className="text-3xl font-black text-slate-900 leading-none mb-1 tracking-tight">{other?.name}</p>
                              <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mt-2">{other?.role}</p>
                              <p className="text-slate-400 text-[10px] font-bold mt-1 line-clamp-1">{other?.company}</p>
                            </div>
                          </div>
                          {!isCompleted && (
                            <Button className="w-full h-16 rounded-2xl text-lg font-black tracking-widest uppercase shadow-xl shadow-indigo-100" onClick={() => startMeeting(m.id)}>
                              {m.status === 'ongoing' ? 'Continuer' : 'Démarrer'}
                            </Button>
                          )}
                          {isCompleted && (
                            <div className="bg-emerald-500 text-white text-center py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-100">Round Terminé ✓</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Fix: Pass currentUser to MeetingRoom to enable analysis of both profiles for AI icebreakers */}
            {userState === 'ACTIVE_MEETING' && activeMeetingId && currentUser && (
              <MeetingRoom 
                meeting={meetings.find(m => m.id === activeMeetingId)!} 
                participant={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!} 
                currentUser={currentUser}
                onFinish={finishMeeting} 
              />
            )}
            {/* Fix: Pass currentUser to Scoring to record the rating source correctly */}
            {userState === 'SCORING' && activeMeetingId && currentUser && (
              <Scoring 
                meetingId={activeMeetingId} 
                meetingUser={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!} 
                currentUser={currentUser}
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
            onUpdateUsers={handleUpdateUsers} 
            onAutoMatch={() => runAutoMatch(false)} 
            onIncrementalMatch={() => runAutoMatch(true)}
            onManualMatch={(m) => dbService.updateMeeting(m.id, m)} 
            onResetAll={resetAll} 
          />
        )}
      </main>

      <footer className="p-10 text-center border-t border-slate-100 mt-auto">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Propulsé par Gemini AI • Saison 2 Experience</p>
      </footer>
    </div>
  );
};

export default App;
