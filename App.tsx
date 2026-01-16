
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppMode, User, Meeting, Rating, ProfessionalCategory, UserSubState, AdminSubState } from './types';
import { Button } from './components/Button';
import { Registration } from './components/Registration';
import { MeetingRoom } from './components/MeetingRoom';
import { Scoring } from './components/Scoring';
import { Synthesis } from './components/Synthesis';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminAuth } from './components/AdminAuth';
import { dbService } from './services/database';

type UserEntryMode = 'register' | 'login';

const STORAGE_KEYS = {
  USER_ID: 'p2p_user_id',
  USER_CODE: 'p2p_user_code',
  ADMIN_AUTH: 'p2p_admin_authenticated'
};

const playNotificationSound = (type: 'start' | 'pause' | 'end') => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  
  const ctx = new AudioContextClass();
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  const now = ctx.currentTime;

  const playSoftBell = (freq: number, startTime: number, duration: number, volume = 0.05) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  if (type === 'start') {
    playSoftBell(523.25, now, 1.5, 0.06); 
    playSoftBell(783.99, now + 0.15, 1.2, 0.04); 
    playSoftBell(1046.50, now + 0.3, 1.0, 0.03); 
  } else if (type === 'pause') {
    playSoftBell(659.25, now, 1.2, 0.05); 
    playSoftBell(523.25, now + 0.2, 1.5, 0.04); 
  } else if (type === 'end') {
    playSoftBell(392.00, now, 2.0, 0.04); 
    playSoftBell(493.88, now + 0.05, 1.8, 0.03); 
    playSoftBell(587.33, now + 0.1, 1.6, 0.03); 
    playSoftBell(880.00, now + 0.15, 1.4, 0.02); 
  }
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('USER_PORTAL');
  const [userState, setUserState] = useState<UserSubState>('REGISTRATION');
  const [userEntryMode, setUserEntryMode] = useState<UserEntryMode>('register');
  const [adminState, setAdminState] = useState<AdminSubState>('PROFILES');
  
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState(false);
  
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);

  const prevRoundRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribeUsers = dbService.subscribeToUsers((cloudUsers) => {
      setUsers(cloudUsers || []);
      setIsLoading(false);

      const savedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const savedUserCode = localStorage.getItem(STORAGE_KEYS.USER_CODE);
      
      if (savedUserId && !currentUser && cloudUsers) {
        const found = cloudUsers.find(u => u.id === savedUserId);
        if (found && found.connectionCode === savedUserCode) {
          setCurrentUser(found);
          setUserState('SCHEDULE');
        }
      }
    });

    const unsubscribeMeetings = dbService.subscribeToMeetings((cloudMeetings) => {
      setMeetings(cloudMeetings || []);
    });

    const unsubscribeRound = dbService.subscribeToCurrentRound((round) => {
      setCurrentRound(round);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeMeetings();
      unsubscribeRound();
    };
  }, [currentUser]);

  useEffect(() => {
    if (prevRoundRef.current !== currentRound && currentRound !== null && currentUser) {
      if (currentRound > 0) playNotificationSound('start');
      else if (currentRound === 0) playNotificationSound('pause');
      else if (currentRound === -1) playNotificationSound('end');
    }
    prevRoundRef.current = currentRound;
  }, [currentRound, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  }, [users, currentUser?.id]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_CODE);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    
    setAppMode('USER_PORTAL');
    setUserState('REGISTRATION');
    setUserEntryMode('register');
    setCurrentUser(null);
    setIsAdminAuthenticated(false);
    setLoginCode('');
    setLoginError(false);
  };

  const handleLoginByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const q = loginCode.trim().toUpperCase();
    const found = users.find(u => u.connectionCode?.toUpperCase() === q);
    if (found) {
      localStorage.setItem(STORAGE_KEYS.USER_ID, found.id);
      localStorage.setItem(STORAGE_KEYS.USER_CODE, found.connectionCode || '');
      setCurrentUser(found);
      setUserState('SCHEDULE');
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 2000);
    }
  };

  const handleRegister = async (newUser: User) => {
    setIsSyncing(true);
    try {
      const exists = users.find(u => u.name.toLowerCase() === newUser.name.toLowerCase());
      if (exists) {
        localStorage.setItem(STORAGE_KEYS.USER_ID, exists.id);
        localStorage.setItem(STORAGE_KEYS.USER_CODE, exists.connectionCode || '');
        setCurrentUser(exists);
      } else {
        const code = (newUser.firstName.charAt(0) + '-' + newUser.lastName.slice(0, 3)).toUpperCase();
        const userToSave = { ...newUser, connectionCode: code };
        await dbService.saveUser(userToSave);
        localStorage.setItem(STORAGE_KEYS.USER_ID, userToSave.id);
        localStorage.setItem(STORAGE_KEYS.USER_CODE, code);
        setCurrentUser(userToSave);
      }
      setUserState('SCHEDULE');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAdminSuccess = () => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
    setIsAdminAuthenticated(true);
  };

  const runAutoMatch = async (incremental: boolean = false) => {
    setIsSyncing(true);
    try {
      const existingMeetings = incremental ? [...meetings] : [];
      const newMeetings: Meeting[] = incremental ? [...meetings] : [];
      const roundTableCounters: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
      const userRoundSchedules: Record<string, Set<number>> = {};
      
      users.forEach(u => userRoundSchedules[u.id] = new Set());

      if (incremental) {
        existingMeetings.forEach(m => {
          userRoundSchedules[m.participant1Id]?.add(m.round);
          userRoundSchedules[m.participant2Id]?.add(m.round);
          if (roundTableCounters[m.round] <= m.tableNumber) {
            roundTableCounters[m.round] = m.tableNumber + 1;
          }
        });
      }

      const possiblePairs: { u1: User, u2: User, category: ProfessionalCategory }[] = [];
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
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
              scheduledTime: "", 
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
      alert(incremental ? "Planning actualisé avec les nouveaux arrivants." : "Planning complet généré !");
    } catch (e) {
      console.error("Erreur Matching:", e);
      alert("Erreur lors de la génération du planning.");
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
        const allRatings = meetings.flatMap(m => m.id === r.meetingId ? updatedRatings : (m.ratings || [])).filter(rat => rat.toId === r.toId);
        const avg = allRatings.reduce((acc, curr) => acc + curr.score, 0) / allRatings.length;
        await dbService.updateUser(r.toId, { avgScore: avg });
      }
      setUserState('SCHEDULE');
    } finally {
      setIsSyncing(false);
    }
  };

  const userMeetings = useMemo(() => {
    if (!currentUser) return [];
    return (meetings || []).filter(m => m.participant1Id === currentUser.id || m.participant2Id === currentUser.id);
  }, [meetings, currentUser]);

  const allUserMeetingsDone = useMemo(() => {
    if (userMeetings.length === 0) return false;
    return userMeetings.every(m => m.status === 'completed');
  }, [userMeetings]);

  const getOtherParticipant = (m: Meeting) => {
    const otherId = m.participant1Id === currentUser?.id ? m.participant2Id : m.participant1Id;
    return users.find(u => u.id === otherId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black uppercase italic tracking-widest text-center">Restauration de la session...</h2>
      </div>
    );
  }

  if (appMode === 'ADMIN_PORTAL' && !isAdminAuthenticated) {
    return <AdminAuth onSuccess={handleAdminSuccess} onCancel={() => setAppMode('USER_PORTAL')} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col">
      {/* HEADER PARTICIPANT CONNECTÉ */}
      {currentUser && appMode !== 'ADMIN_PORTAL' && (
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-50 animate-in slide-in-from-top duration-500">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={handleLogout}>
            <div className="bg-indigo-600 w-10 h-10 rounded-xl text-white font-black flex items-center justify-center shadow-lg text-sm group-hover:rotate-12 transition-transform">P2P</div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xl md:text-2xl text-slate-900 tracking-tighter italic uppercase">Saison 2</span>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{isSyncing ? 'Sync...' : 'Online'}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              onClick={() => setUserState('SYNTHESIS')}
              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              ⚙️ Profil
            </button>
            <div className="flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded-2xl border border-slate-200">
               <div className="text-right hidden sm:block">
                 <p className="text-[10px] font-black text-slate-900">{currentUser.name}</p>
                 <p className="text-[7px] text-indigo-500 font-bold uppercase tracking-widest">{currentUser.company}</p>
               </div>
               <img src={currentUser.avatar} className="w-8 h-8 rounded-lg border-2 border-white shadow-sm" />
            </div>
            <Button variant="outline" size="sm" className="rounded-xl font-bold text-[10px] uppercase tracking-widest border-slate-200 h-9" onClick={handleLogout}>Sortie</Button>
          </div>
        </header>
      )}

      {/* HEADER ADMIN */}
      {appMode === 'ADMIN_PORTAL' && isAdminAuthenticated && (
        <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 w-10 h-10 rounded-xl text-white font-black flex items-center justify-center shadow-lg text-sm">P2P</div>
            <span className="font-black text-xl text-white tracking-tighter italic uppercase">ADMIN</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-slate-800 p-1 rounded-2xl flex space-x-1">
              <button className={`px-4 py-2 text-[10px] font-bold rounded-xl transition-all ${adminState === 'PROFILES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => setAdminState('PROFILES')}>Pairs</button>
              <button className={`px-4 py-2 text-[10px] font-bold rounded-xl transition-all ${adminState === 'PLANNING' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => setAdminState('PLANNING')}>Rounds</button>
              <button className={`px-4 py-2 text-[10px] font-bold rounded-xl transition-all ${adminState === 'RESULTS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => setAdminState('RESULTS')}>Bilans</button>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl font-bold text-[10px] uppercase border-slate-700 text-white h-9" onClick={handleLogout}>Quitter</Button>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 relative">
        {/* BOUTON ADMIN ROUE CRANTÉE (Seulement en page d'accueil déconnectée) */}
        {!currentUser && userState === 'REGISTRATION' && appMode === 'USER_PORTAL' && (
          <button 
            onClick={() => setAppMode('ADMIN_PORTAL')}
            className="absolute top-4 right-4 md:top-8 md:right-8 w-12 h-12 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm z-[60]"
            title="Accès Organisateur"
          >
            ⚙️
          </button>
        )}

        {appMode === 'USER_PORTAL' && (
          <>
            {userState === 'REGISTRATION' && !currentUser && (
              <div className="flex flex-col items-center py-12 md:py-20 animate-in fade-in duration-1000">
                <div className="text-center mb-16 space-y-4">
                   <div className="bg-indigo-600 w-20 h-20 rounded-[1.8rem] text-white font-black flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.3)] text-2xl mx-auto mb-8 animate-bounce">P2P</div>
                   <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">Saison 2</h1>
                   <div className="h-1.5 w-24 bg-indigo-500 mx-auto rounded-full"></div>
                   <p className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[12px] pt-4 italic">Matchez avec vos pairs !</p>
                </div>

                <div className="bg-slate-100 p-1.5 rounded-2xl flex space-x-1 mb-12 shadow-inner">
                  <button onClick={() => setUserEntryMode('register')} className={`px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${userEntryMode === 'register' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Nouveau Pair</button>
                  <button onClick={() => setUserEntryMode('login')} className={`px-8 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${userEntryMode === 'login' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Déjà inscrit</button>
                </div>
                
                {userEntryMode === 'register' ? <Registration onRegister={handleRegister} /> : (
                  <div className="max-w-md w-full bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 text-center animate-in zoom-in duration-500">
                    <h3 className="text-3xl font-black text-slate-900 mb-8 uppercase italic tracking-tighter">Votre Accès</h3>
                    <form onSubmit={handleLoginByCode} className="space-y-8">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Code d'identification</label>
                        <input type="text" required maxLength={5} placeholder="P-NOM" className={`w-full h-20 text-center text-4xl font-black tracking-[0.2em] bg-slate-50 border-4 rounded-3xl outline-none transition-all placeholder:text-slate-100 ${loginError ? 'border-rose-500 animate-shake' : 'border-slate-100 focus:border-indigo-600'}`} value={loginCode} onChange={(e) => setLoginCode(e.target.value.toUpperCase())} />
                      </div>
                      <Button type="submit" className="w-full h-18 rounded-2xl font-black uppercase text-lg shadow-xl shadow-indigo-100">Accéder au planning</Button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {userState === 'SCHEDULE' && currentUser && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                {userMeetings.length === 0 && currentRound !== -1 && (
                  <div className="max-w-3xl mx-auto py-20">
                    <div className="bg-white rounded-[3.5rem] p-12 md:p-16 shadow-2xl border border-slate-100 text-center space-y-10 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl group-hover:bg-indigo-100 transition-colors duration-700"></div>
                      <div className="relative z-10">
                        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] text-white font-black flex items-center justify-center shadow-2xl mx-auto mb-10 text-4xl animate-bounce">⏳</div>
                        <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-tight">Planning en cours <br/> de préparation</h3>
                        <p className="text-slate-500 text-lg md:text-xl font-medium mt-8 leading-relaxed max-w-xl mx-auto">L'organisateur prépare actuellement votre planning. Pendant ce temps, éditez votre profil et changez votre code de connexion que vous pourrez utiliser en cas de déconnexion ou pour retrouver toutes les informations à l'issu du speed-matching!</p>
                        <div className="pt-12 flex flex-col items-center gap-6">
                          <Button variant="primary" size="lg" className="h-20 px-12 rounded-3xl text-xl font-black uppercase tracking-widest shadow-2xl shadow-indigo-200 hover:scale-105 transition-transform" onClick={() => setUserState('SYNTHESIS')}>✏️ Éditer mon profil & code</Button>
                          <div className="flex items-center space-x-3 text-emerald-500 font-black text-[10px] uppercase tracking-[0.3em]"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div><span>Prêt pour le lancement</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentRound === 0 && (<div className="bg-amber-500 text-white p-12 rounded-[3rem] shadow-2xl text-center flex flex-col items-center"><div className="text-6xl mb-6">☕️</div><h3 className="text-4xl font-black uppercase italic tracking-tighter">Session en Pause</h3><p className="text-amber-50 font-bold uppercase tracking-widest text-[10px] mt-4">Prenez un café, les rounds reprennent dans quelques instants.</p></div>)}
                {currentRound === -1 && (
                  <div className="space-y-12">
                    <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl text-center"><div className="text-6xl mb-6">🏁</div><h3 className="text-4xl font-black uppercase italic tracking-tighter">Saison Terminée</h3><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-4">Merci pour votre participation ! Consultez vos résultats.</p></div>
                    {currentUser?.matchId && (
                      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-12 rounded-[3rem] shadow-2xl text-white text-center animate-in zoom-in duration-1000">
                        <h4 className="text-2xl font-black uppercase tracking-widest mb-8 text-indigo-200">Votre Duo de la Saison</h4>
                        <div className="flex items-center justify-center space-x-8">
                           <div className="text-center"><img src={currentUser.avatar} className="w-24 h-24 rounded-3xl border-4 border-white shadow-xl mx-auto mb-2" /><p className="font-black uppercase text-xs">Vous</p></div>
                           <div className="text-4xl font-black">+</div>
                           {users.find(u => u.id === currentUser.matchId) && (<div className="text-center"><img src={users.find(u => u.id === currentUser.matchId)?.avatar} className="w-24 h-24 rounded-3xl border-4 border-white shadow-xl mx-auto mb-2" /><p className="font-black uppercase text-xs">{users.find(u => u.id === currentUser.matchId)?.name}</p></div>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentRound !== null && currentRound > 0 && userMeetings.find(m => m.round === currentRound) && (
                  <div className="bg-indigo-600 text-white p-6 md:p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] border border-indigo-400 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="flex items-center space-x-6 relative z-10">
                      <div className="relative group"><img src={getOtherParticipant(userMeetings.find(m => m.round === currentRound)!)?.avatar} className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] border-4 border-white shadow-2xl object-cover transform rotate-[-3deg] group-hover:rotate-0 transition-transform" /><div className="absolute -bottom-2 -right-2 bg-white text-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-xl">T{userMeetings.find(m => m.round === currentRound)?.tableNumber}</div></div>
                      <div><h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter">Round {currentRound} en cours !</h3><p className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1">Rejoignez <span className="text-white underline decoration-white/30 underline-offset-4">{getOtherParticipant(userMeetings.find(m => m.round === currentRound)!)?.name}</span> ({getOtherParticipant(userMeetings.find(m => m.round === currentRound)!)?.company})</p></div>
                    </div>
                    <Button variant="secondary" className="bg-white text-indigo-600 hover:bg-slate-100 h-16 px-10 rounded-2xl font-black uppercase shadow-xl relative z-10" onClick={() => { const m = userMeetings.find(meet => meet.round === currentRound); if(m) startMeeting(m.id); }}>Démarrer la rencontre</Button>
                  </div>
                )}

                {userMeetings.length > 0 && (
                  <>
                    <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-100 pb-8 gap-6"><div className="text-center md:text-left"><h2 className="text-6xl font-black text-slate-900 tracking-tighter uppercase italic">Mon Planning</h2><p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">{currentUser?.name} • Session Live</p></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {userMeetings.sort((a,b) => a.round - b.round).map(m => {
                        const other = getOtherParticipant(m);
                        const isCompleted = m.status === 'completed';
                        const isCurrent = m.round === currentRound;
                        return (
                          <div key={m.id} className={`group relative bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 flex flex-col justify-between transition-all hover:shadow-2xl hover:-translate-y-1 ${isCompleted ? 'opacity-50 grayscale-[0.8]' : ''} ${isCurrent ? 'ring-4 ring-indigo-500 shadow-indigo-200' : ''}`}>
                            {isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">En cours</div>}
                            <div className="flex justify-between items-start mb-8"><span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Round {m.round} • Table {m.tableNumber}</span></div>
                            <div className="flex items-center space-x-6 mb-10"><div className="relative"><img src={other?.avatar} className="w-24 h-24 rounded-[2rem] shadow-xl border-4 border-white object-cover" />{isCompleted && <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white w-8 h-8 rounded-xl flex items-center justify-center text-xs shadow-lg">✓</div>}</div><div><p className="text-2xl font-black text-slate-900 leading-none mb-1 tracking-tight">{other?.name}</p><p className="text-indigo-600 text-[10px] font-black uppercase tracking-widest mt-1">{other?.role}</p><p className="text-slate-400 text-[9px] font-bold uppercase mt-1 tracking-tight truncate max-w-[150px]">{other?.company}</p></div></div>
                            {!isCompleted && (<Button className="w-full h-14 rounded-xl text-sm font-black tracking-widest uppercase shadow-xl" onClick={() => startMeeting(m.id)}>{m.status === 'ongoing' ? 'Continuer' : 'Démarrer'}</Button>)}
                            {isCompleted && (<div className="bg-emerald-500 text-white text-center py-4 rounded-xl text-xs font-black uppercase tracking-[0.2em]">Rendez-vous Terminé ✓</div>)}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {userState === 'ACTIVE_MEETING' && activeMeetingId && currentUser && (<MeetingRoom meeting={meetings.find(m => m.id === activeMeetingId)!} participant={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!} currentUser={currentUser} onFinish={finishMeeting} />)}
            {userState === 'SCORING' && activeMeetingId && currentUser && (<Scoring meetingId={activeMeetingId} meetingUser={getOtherParticipant(meetings.find(m => m.id === activeMeetingId)!)!} currentUser={currentUser} onSubmit={submitRating} />)}
            {userState === 'SYNTHESIS' && currentUser && (<Synthesis currentUser={currentUser} meetings={meetings} users={users} onBack={() => setUserState('SCHEDULE')} />)}
            
            {userState === 'DATA_MANAGEMENT' && (
              <div className="max-w-2xl mx-auto py-20 animate-in zoom-in duration-500">
                <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 text-center space-y-8">
                  <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] text-white flex items-center justify-center mx-auto text-3xl">🛡️</div>
                  <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Gestion des données</h2>
                  <div className="text-left space-y-6 text-slate-600 font-medium leading-relaxed">
                    <p>
                      La protection de votre vie privée est notre priorité absolue. Nous appliquons une politique de confidentialité stricte "Zéro Trace Long Terme".
                    </p>
                    <div className="bg-slate-50 p-6 rounded-2xl border-l-4 border-indigo-600">
                       <p className="font-bold text-slate-900">
                         Les données sont stockées uniquement durant la session de matching et seront intégralement supprimées de la plateforme dès la fin de la soirée.
                       </p>
                    </div>
                    <p>
                      Aucun profil, historique d'échange ou note n'est conservé après l'événement. Votre avatar et vos informations d'entreprise ne sont visibles que par les pairs participant à la même session.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full h-16 rounded-2xl font-black uppercase tracking-widest border-slate-200" onClick={() => setUserState(currentUser ? 'SCHEDULE' : 'REGISTRATION')}>Fermer</Button>
                </div>
              </div>
            )}
          </>
        )}

        {appMode === 'ADMIN_PORTAL' && (
          <AdminDashboard users={users} meetings={meetings} adminState={adminState} currentRound={currentRound} onUpdateUsers={(u) => dbService.syncAllUsers(u)} onDeleteUser={(id) => dbService.deleteUser(id)} onAutoMatch={() => runAutoMatch(false)} onIncrementalMatch={() => runAutoMatch(true)} onManualMatch={(m) => dbService.updateMeeting(m.id, m)} onSetCurrentRound={(r) => dbService.setCurrentRound(r)} onResetAll={() => dbService.resetAll()} onResetPlanning={() => dbService.resetPlanning()} onResetPalmares={() => dbService.resetPalmares()} />
        )}
      </main>

      <footer className="p-12 text-center border-t border-slate-100 mt-auto bg-slate-50/50">
        <div className="max-w-xl mx-auto space-y-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Propulsé par Gemini AI • Saison 2 Experience</p>
          
          <button 
            onClick={() => setUserState('DATA_MANAGEMENT')}
            className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest hover:text-indigo-600 transition-colors block mx-auto"
          >
            Gestion des données
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
