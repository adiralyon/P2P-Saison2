
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
  
  // Data State (Source unique de vérité : Firebase)
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  // Synchronisation temps réel avec le Cloud
  useEffect(() => {
    setIsLoading(true);
    
    const unsubscribeUsers = dbService.subscribeToUsers((cloudUsers) => {
      setUsers(cloudUsers);
      setIsLoading(false);
    });

    const unsubscribeMeetings = dbService.subscribeToMeetings((cloudMeetings) => {
      setMeetings(cloudMeetings);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMeetings();
    };
  }, []);

  // --- Actions Cloud ---

  const handleRegister = async (newUser: User) => {
    setIsSyncing(true);
    const exists = users.find(u => u.name.toLowerCase() === newUser.name.toLowerCase());
    if (exists) {
      setCurrentUser(exists);
    } else {
      await dbService.saveUser(newUser);
      setCurrentUser(newUser);
    }
    setUserState('SCHEDULE');
    setAppMode('USER_PORTAL');
    setIsSyncing(false);
  };

  const autoMatch = async () => {
    setIsSyncing(true);
    const newMeetings: Meeting[] = [];
    const roundTableCounters: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
    const userRoundSchedules: Record<string, Set<number>> = {};
    users.forEach(u => userRoundSchedules[u.id] = new Set());

    const possiblePairs: { u1: User, u2: User, category: ProfessionalCategory }[] = [];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const commonCategories = users[i].categories.filter(c => users[j].categories.includes(c));
        if (commonCategories.length > 0) {
          possiblePairs.push({ u1: users[i], u2: users[j], category: commonCategories[0] });
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
    setIsSyncing(false);
    alert(`${newMeetings.length} rendez-vous synchronisés dans le Cloud.`);
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
    const meeting = meetings.find(m => m.id === r.meetingId);
    if (!meeting) return;

    const updatedRatings = [...meeting.ratings, r];
    await dbService.updateMeeting(r.meetingId, { ratings: updatedRatings });
    
    // Mise à jour du score moyen du pair destinataire
    const userToUpdate = users.find(u => u.id === r.toId);
    if (userToUpdate) {
      const allTargetRatings = meetings
        .flatMap(m => m.id === r.meetingId ? updatedRatings : m.ratings)
        .filter(rat => rat.toId === r.toId);
      const avg = allTargetRatings.reduce((acc, curr) => acc + curr.score, 0) / allTargetRatings.length;
      await dbService.updateUser(r.toId, { avgScore: avg });
    }

    setUserState('SCHEDULE');
    setActiveMeetingId(null);
    setIsSyncing(false);
  };

  const resetAll = async () => {
    if (confirm("Voulez-vous vraiment effacer TOUTES les données du Cloud ?")) {
      await dbService.resetAll();
      window.location.reload();
    }
  };

  const userMeetings = useMemo(() => {
    if (!currentUser) return [];
    return meetings.filter(m => m.participant1Id === currentUser.id || m.participant2Id === currentUser.id);
  }, [meetings, currentUser]);

  const getOtherParticipant = (m: Meeting) => {
    const otherId = m.participant1Id === currentUser?.id ? m.participant2Id : m.participant1Id;
    return users.find(u => u.id === otherId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black tracking-tighter uppercase italic">Chargement du Cloud...</h2>
        <p className="text-slate-400 mt-2 font-bold text-xs uppercase tracking-widest">Saison 2 • Realtime Engine</p>
      </div>
    );
  }

  if (appMode === 'ADMIN_PORTAL' && !isAdminAuthenticated) {
    return <AdminAuth onSuccess={() => setIsAdminAuthenticated(true)} onCancel={() => setAppMode('PORTAL_SELECT')} />;
  }

  if (appMode === 'PORTAL_SELECT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 md:p-6 selection:bg-indigo-500 selection:text-white overflow-y-auto">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 my-auto">
          <div className="bg-white/5 backdrop-blur-xl p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-all cursor-pointer group shadow-2xl" onClick={() => setAppMode('USER_PORTAL')}>
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 group-hover:scale-110 transition-transform shadow-indigo-500/20 shadow-2xl text-3xl md:text-5xl">
              👋
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-2 md:mb-4 tracking-tight">Portail Pair</h2>
            <p className="text-indigo-200/70 text-sm md:text-lg leading-relaxed px-4">Inscrivez-vous et accédez à votre planning en temps réel.</p>
            <Button className="mt-6 md:mt-10 w-full h-14 md:h-16 text-lg md:text-xl rounded-xl md:rounded-2xl" variant="primary">Participer</Button>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl p-6 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-white/10 text-center hover:bg-white/10 transition-all cursor-pointer group shadow-2xl" onClick={() => setAppMode('ADMIN_PORTAL')}>
            <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 group-hover:scale-110 transition-transform shadow-emerald-500/20 shadow-2xl text-3xl md:text-5xl">
              ⚙️
            </div>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-2 md:mb-4 tracking-tight">Espace Admin</h2>
            <p className="text-emerald-200/70 text-sm md:text-lg leading-relaxed px-4">Pilotez les sessions et voyez les inscrits arriver en direct.</p>
            <Button className="mt-6 md:mt-10 w-full h-14 md:h-16 text-lg md:text-xl rounded-xl md:rounded-2xl" variant="secondary">Gérer la session</Button>
          </div>
        </div>
        <div className="hidden md:block absolute bottom-10 text-slate-500 font-bold tracking-widest text-xs uppercase opacity-50">
          Cloud Synchronized • Saison 2
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3 md:py-5 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-50 gap-3">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setAppMode('PORTAL_SELECT')}>
          <div className="bg-indigo-600 w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl text-white font-black flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-indigo-200 text-xs md:text-sm">P2P</div>
          <div className="flex flex-col">
            <span className="font-black text-lg md:text-2xl text-slate-900 tracking-tighter italic uppercase leading-none">Saison 2</span>
            <div className="flex items-center space-x-1 mt-0.5">
               <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
               <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Live Sync</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-center sm:justify-end space-x-2 md:space-x-4 w-full sm:w-auto">
          {appMode === 'ADMIN_PORTAL' ? (
            <div className="bg-slate-100 p-1 rounded-xl md:rounded-2xl flex space-x-1 flex-1 sm:flex-none">
              <button className={`px-3 md:px-5 py-1.5 md:py-2 text-[9px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all ${adminState === 'PROFILES' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('PROFILES')}>Pairs</button>
              <button className={`px-3 md:px-5 py-1.5 md:py-2 text-[9px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all ${adminState === 'PLANNING' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('PLANNING')}>Rounds</button>
              <button className={`px-3 md:px-5 py-1.5 md:py-2 text-[9px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all ${adminState === 'RESULTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`} onClick={() => setAdminState('RESULTS')}>Bilans</button>
            </div>
          ) : (
            currentUser && (
               <div className="flex items-center space-x-3 bg-indigo-50/50 px-3 py-1.5 rounded-xl md:rounded-2xl border border-indigo-100/50">
                 <div className="text-right hidden sm:block">
                   <p className="text-xs font-black text-slate-900 leading-none">{currentUser.name}</p>
                   <p className="text-[9px] text-indigo-600 font-black uppercase mt-1 tracking-wider line-clamp-1 max-w-[120px]">{currentUser.categories[0]}</p>
                 </div>
                 <img src={currentUser.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border-2 border-white shadow-md" />
               </div>
            )
          )}
          <Button variant="outline" size="sm" className="rounded-lg md:rounded-xl font-bold border-slate-200 text-[9px] md:text-sm" onClick={() => {
            setAppMode('PORTAL_SELECT');
            setIsAdminAuthenticated(false);
          }}>Sortie</Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {appMode === 'USER_PORTAL' && (
          <>
            {userState === 'REGISTRATION' && <Registration onRegister={handleRegister} />}
            {userState === 'SCHEDULE' && (
              <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-3 text-center sm:text-left">
                  <div>
                    <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Mon Planning</h2>
                    <p className="text-slate-500 text-sm md:text-lg mt-1 font-medium">Synchronisé en temps réel.</p>
                  </div>
                  <div className="bg-emerald-50 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border border-emerald-100 flex items-center space-x-2 md:space-x-3">
                    <div className="w-2 md:w-3 h-2 md:h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-emerald-700 font-black text-[10px] md:text-sm uppercase tracking-widest">Connecté au Cloud</span>
                  </div>
                </div>

                {userMeetings.length === 0 ? (
                  <div className="bg-white p-12 md:p-20 rounded-3xl md:rounded-[3rem] text-center shadow-2xl shadow-indigo-500/5 border border-slate-100 flex flex-col items-center">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-50 rounded-full flex items-center justify-center text-3xl md:text-5xl mb-6">⏳</div>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">En attente de l'Admin</h3>
                    <p className="text-slate-400 mt-3 max-w-sm mx-auto text-sm md:text-lg leading-relaxed">Le planning global va apparaître ici dès qu'il sera généré par l'administrateur.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {userMeetings.sort((a,b) => a.round - b.round).map(m => {
                      const other = getOtherParticipant(m);
                      const isCompleted = m.status === 'completed';
                      return (
                        <div key={m.id} className={`group relative bg-white rounded-2xl md:rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between ${isCompleted ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                          <div className="flex justify-between items-start mb-6 md:mb-8">
                            <div className="flex flex-col gap-1 md:gap-2">
                              <span className="bg-slate-900 text-white px-3 md:px-4 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest w-fit">Round {m.round}</span>
                              <span className="bg-indigo-50 text-indigo-700 px-3 md:px-4 py-1 rounded-full text-[9px] md:text-xs font-black uppercase tracking-widest border border-indigo-100">Table {m.tableNumber}</span>
                            </div>
                            <span className="text-slate-900 font-black text-sm md:text-lg bg-slate-50 px-3 md:px-4 py-1 md:py-2 rounded-xl md:rounded-2xl">{m.scheduledTime}</span>
                          </div>
                          
                          <div className="flex items-center space-x-4 md:space-x-5 mb-6 md:mb-8">
                            <img src={other?.avatar} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl shadow-lg border-2 md:border-4 border-white object-cover" />
                            <div>
                              <p className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{other?.name}</p>
                              <p className="text-indigo-600 text-xs md:text-sm font-bold mt-1 uppercase tracking-tight line-clamp-1">{other?.role}</p>
                              <p className="text-slate-400 text-[10px] md:text-xs font-medium truncate max-w-[120px] md:max-w-[150px]">{other?.company}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {m.status === 'scheduled' && (
                              <Button className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl text-base md:text-lg font-black shadow-xl" onClick={() => startMeeting(m.id)}>LANCER</Button>
                            )}
                            {m.status === 'ongoing' && (
                              <Button className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl text-base md:text-lg font-black bg-amber-500 hover:bg-amber-600 shadow-xl" onClick={() => startMeeting(m.id)}>REPRENDRE</Button>
                            )}
                            {isCompleted && (
                              <div className="bg-emerald-500 text-white text-center py-3 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-200">Terminé ✓</div>
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
            onUpdateUsers={(u) => u.forEach(dbService.saveUser)}
            onAutoMatch={autoMatch}
            onManualMatch={(m) => dbService.updateMeeting(m.id, m)}
            onResetAll={resetAll}
          />
        )}
      </main>
      
      <footer className="py-6 md:py-8 px-4 md:px-8 border-t border-slate-100 bg-white text-center">
        <p className="text-slate-400 text-[8px] md:text-xs font-bold uppercase tracking-[0.2em]">Expérience Saison 2 • Synchronisation Cloud Active</p>
      </footer>
    </div>
  );
};

export default App;
