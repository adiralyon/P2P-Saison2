
import React from 'react';
import { User, Meeting } from '../types';
import { Button } from './Button';

interface SynthesisProps {
  currentUser: User;
  meetings: Meeting[];
  users: User[];
  onBack: () => void;
}

export const Synthesis: React.FC<SynthesisProps> = ({ currentUser, meetings, users, onBack }) => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 pb-20">
      <div className="text-center space-y-4">
        <div className="inline-flex bg-indigo-100 p-4 rounded-3xl mb-4">
          <span className="text-4xl">📊</span>
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Ma Synthèse</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Saison 2 • Bilan de vos échanges</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {myMeetings.length === 0 ? (
          <div className="bg-white p-20 rounded-[3rem] text-center border-4 border-dashed border-slate-50">
            <p className="text-slate-300 font-black uppercase tracking-widest">Aucun rendez-vous effectué.</p>
          </div>
        ) : (
          myMeetings.map((m) => {
            const other = getOtherParticipant(m);
            const rating = getMyRating(m);
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

                <div className="w-full md:w-48 bg-slate-50 p-6 rounded-[2rem] text-center space-y-2 border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Votre Note</p>
                  <div className="text-3xl font-black text-amber-400">
                    {rating ? "★".repeat(rating.score) + "☆".repeat(5 - rating.score) : "---"}
                  </div>
                  {rating?.comment && (
                    <p className="text-[10px] font-medium italic text-slate-500 line-clamp-2">
                      "{rating.comment}"
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex justify-center pt-8">
        <Button variant="outline" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest" onClick={onBack}>
          Retour au planning
        </Button>
      </div>
    </div>
  );
};
