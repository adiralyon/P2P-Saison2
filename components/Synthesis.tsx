
import React, { useState } from 'react';
import { User, Meeting, ProfessionalCategory, Rating } from '../types';
import { Button } from './Button';
import { dbService } from '../services/database';

interface SynthesisProps {
  currentUser: User;
  meetings: Meeting[];
  users: User[];
  onBack: () => void;
}

export const Synthesis: React.FC<SynthesisProps> = ({ currentUser, meetings, users, onBack }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    company: currentUser.company,
    role: currentUser.role,
    bio: currentUser.bio,
    categories: currentUser.categories,
    connectionCode: currentUser.connectionCode
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // État pour l'édition des notes
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [tempScore, setTempScore] = useState<number>(0);
  const [tempComment, setTempComment] = useState<string>('');

  const myMeetings = meetings
    .filter(m => m.participant1Id === currentUser.id || m.participant2Id === currentUser.id)
    .sort((a, b) => a.round - b.round);

  const getOtherParticipant = (m: Meeting) => {
    const otherId = m.participant1Id === currentUser.id ? m.participant2Id : m.participant1Id;
    return users.find(u => u.id === otherId);
  };

  const getMyRating = (m: Meeting) => {
    return m.ratings?.find(r => r.fromId === currentUser.id);
  };

  const toggleCategory = (cat: ProfessionalCategory) => {
    setEditForm(prev => {
      const current = prev.categories || [];
      const updated = current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat];
      return { ...prev, categories: updated };
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = editForm.connectionCode?.trim().toUpperCase() || '';
    
    if (code.length < 3) {
      setError('Code d\'identification : Minimum 3 caractères');
      return;
    }

    const isTaken = users.some(u => u.id !== currentUser.id && u.connectionCode?.toUpperCase() === code);
    if (isTaken) {
      setError('Ce code d\'identification est déjà utilisé par un autre pair');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser: Partial<User> = {
        ...editForm,
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        connectionCode: code
      };
      await dbService.updateUser(currentUser.id, updatedUser);
      setIsEditing(false);
      setError('');
    } catch (e) {
      setError('Erreur lors de la sauvegarde sur le serveur');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditRating = (m: Meeting, r: Rating | undefined) => {
    setEditingMeetingId(m.id);
    setTempScore(r?.score || 0);
    setTempComment(r?.comment || '');
  };

  const saveEditedRating = async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    setIsSaving(true);
    try {
      const otherParticipant = getOtherParticipant(meeting);
      if (!otherParticipant) return;

      const otherRatings = (meeting.ratings || []).filter(r => r.fromId !== currentUser.id);
      const newRating: Rating = {
        meetingId,
        fromId: currentUser.id,
        toId: otherParticipant.id,
        score: tempScore,
        comment: tempComment
      };
      
      const updatedRatings = [...otherRatings, newRating];
      await dbService.updateMeeting(meetingId, { ratings: updatedRatings });

      // Recalculer la moyenne du destinataire
      const allMeetings = meetings.map(m => m.id === meetingId ? { ...m, ratings: updatedRatings } : m);
      const allRatingsToOther = allMeetings
        .flatMap(m => m.ratings || [])
        .filter(r => r.toId === otherParticipant.id);
      
      const avg = allRatingsToOther.length > 0 
        ? allRatingsToOther.reduce((acc, curr) => acc + curr.score, 0) / allRatingsToOther.length
        : 0;

      await dbService.updateUser(otherParticipant.id, { avgScore: avg });
      setEditingMeetingId(null);
    } catch (e) {
      console.error("Erreur update rating:", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex bg-indigo-100 p-4 rounded-3xl mb-4">
          <span className="text-4xl">{isEditing ? '✏️' : '📊'}</span>
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
          {isEditing ? 'Éditer mon Profil' : 'Ma Synthèse'}
        </h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
          {isEditing ? 'Modifiez vos informations visibles par vos pairs' : 'Bilan de vos échanges & Identité'}
        </p>
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
        
        {!isEditing ? (
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <img 
              src={currentUser.avatar} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-white/10 shadow-2xl"
            />
            
            <div className="flex-1 text-center md:text-left space-y-2">
              <h3 className="text-3xl font-black italic uppercase tracking-tight">{currentUser.name}</h3>
              <p className="text-indigo-400 font-bold uppercase text-xs tracking-widest">{currentUser.role} @ {currentUser.company}</p>
              
              <div className="pt-6 flex flex-col md:flex-row items-center gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Identifiant de connexion</p>
                  <p className="text-2xl font-black tracking-widest text-indigo-400">{currentUser.connectionCode || '----'}</p>
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                >
                  ✏️ Modifier mes informations
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="relative z-10 space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Prénom</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-indigo-500"
                  value={editForm.firstName}
                  onChange={e => setEditForm({...editForm, firstName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Nom</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-indigo-500"
                  value={editForm.lastName}
                  onChange={e => setEditForm({...editForm, lastName: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Entreprise</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-indigo-500"
                  value={editForm.company}
                  onChange={e => setEditForm({...editForm, company: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Poste / Fonction</label>
                <input 
                  type="text"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-indigo-500"
                  value={editForm.role}
                  onChange={e => setEditForm({...editForm, role: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Bio / Sujets d'échange</label>
              <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-medium text-white/80 outline-none focus:border-indigo-500 italic"
                rows={2}
                value={editForm.bio}
                onChange={e => setEditForm({...editForm, bio: e.target.value})}
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Mes Expertises</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-4 bg-white/5 border border-white/10 rounded-3xl max-h-40 overflow-y-auto">
                {Object.values(ProfessionalCategory).map(cat => (
                  <label key={cat} className={`flex items-center space-x-3 p-2 rounded-xl border transition-all cursor-pointer ${editForm.categories?.includes(cat) ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <input 
                      type="checkbox"
                      className="hidden"
                      checked={editForm.categories?.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                    <span className="text-[9px] font-black uppercase truncate">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-indigo-900/30 p-6 rounded-3xl border border-indigo-500/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Code de connexion (Identifiant)</p>
                  <p className="text-[8px] text-indigo-400 italic">C'est le code que vous utilisez pour vous connecter à l'application.</p>
                </div>
                <input 
                  type="text"
                  maxLength={5}
                  className="bg-white/10 border-2 border-indigo-500 rounded-2xl p-4 text-2xl font-black uppercase text-center w-full md:w-32 tracking-widest text-indigo-300 outline-none"
                  value={editForm.connectionCode}
                  onChange={e => setEditForm({...editForm, connectionCode: e.target.value.toUpperCase()})}
                />
              </div>
            </div>

            {error && <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest text-center">{error}</p>}

            <div className="flex justify-end items-center gap-6 pt-6 border-t border-white/10">
              <button 
                type="button"
                className="text-white/40 hover:text-white font-black uppercase text-[10px] tracking-widest"
                onClick={() => { setIsEditing(false); setError(''); }}
              >
                Annuler
              </button>
              <Button type="submit" isLoading={isSaving} className="px-12 rounded-xl h-14 uppercase font-black tracking-widest">Enregistrer les modifications</Button>
            </div>
          </form>
        )}
      </div>

      {!isEditing && (
        <>
          <div className="grid grid-cols-1 gap-8">
            <h3 className="text-2xl font-black text-slate-900 uppercase italic px-4 border-l-8 border-indigo-600">Historique des Rounds</h3>
            
            {myMeetings.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-slate-50">
                <p className="text-slate-300 font-black uppercase tracking-widest">Aucun rendez-vous effectué dans votre planning.</p>
              </div>
            ) : (
              myMeetings.map((m) => {
                const other = getOtherParticipant(m);
                const rating = getMyRating(m);
                const isEditingThis = editingMeetingId === m.id;

                return (
                  <div key={m.id} className="bg-white rounded-[3rem] p-10 shadow-xl shadow-indigo-500/5 border border-slate-100 flex flex-col md:flex-row items-center gap-10 group hover:scale-[1.01] transition-transform">
                    <div className="relative">
                      <img 
                        src={other?.avatar} 
                        className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] object-cover border-4 border-white shadow-2xl rotate-[-3deg] group-hover:rotate-0 transition-transform" 
                        alt="" 
                      />
                      <div className="absolute -top-4 -right-4 bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-lg">
                        R{m.round}
                      </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-2">
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{other?.name}</h3>
                      <p className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">{other?.role} @ {other?.company}</p>
                      <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                        {other?.categories.map(c => (
                          <span key={c} className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full text-[8px] font-black uppercase border border-slate-100">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="w-full md:w-64 bg-slate-50 p-6 rounded-[2rem] text-center space-y-4 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Votre Note</p>
                      
                      {isEditingThis ? (
                        <div className="space-y-4">
                          <div className="flex justify-center space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => setTempScore(star)}
                                className={`text-2xl transition-all ${tempScore >= star ? 'text-amber-400 scale-110' : 'text-slate-200'}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>
                          <textarea 
                            className="w-full text-[10px] p-2 bg-white border rounded-xl outline-none focus:border-indigo-500"
                            rows={2}
                            value={tempComment}
                            onChange={(e) => setTempComment(e.target.value)}
                            placeholder="Commentaire..."
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 rounded-lg text-[9px] font-black" onClick={() => saveEditedRating(m.id)} isLoading={isSaving}>Sauver</Button>
                            <button className="text-[9px] font-bold text-slate-400 uppercase" onClick={() => setEditingMeetingId(null)}>Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-3xl font-black text-amber-400">
                            {rating ? "★".repeat(rating.score) + "☆".repeat(5 - rating.score) : "---"}
                          </div>
                          {rating?.comment && (
                            <p className="text-[10px] font-medium italic text-slate-500 line-clamp-2">
                              "{rating.comment}"
                            </p>
                          )}
                          <button 
                            className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                            onClick={() => startEditRating(m, rating)}
                          >
                            ✏️ Modifier ma note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-center pt-8">
            <Button variant="outline" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest border-slate-200" onClick={onBack}>
              Retour au planning
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
