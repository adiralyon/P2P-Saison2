
import React, { useState } from 'react';
import { User, Rating } from '../types';
import { Button } from './Button';

interface ScoringProps {
  meetingId: string;
  meetingUser: User;
  onSubmit: (rating: Rating) => void;
}

export const Scoring: React.FC<ScoringProps> = ({ meetingId, meetingUser, onSubmit }) => {
  const [score, setScore] = useState<number>(0);
  const [comment, setComment] = useState('');

  const handleRating = (value: number) => setScore(value);

  return (
    <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl text-center border border-slate-100 animate-in slide-in-from-bottom duration-500">
      <div className="relative inline-block mb-6">
        <img src={meetingUser.avatar} className="w-28 h-28 rounded-full border-4 border-indigo-50 shadow-inner" alt={meetingUser.name} />
        <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-full shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
      </div>
      
      <h2 className="text-3xl font-black text-slate-900">Notez l'échange</h2>
      <p className="text-slate-500 mt-2 mb-8">Votre feedback sur <span className="font-bold text-indigo-600">{meetingUser.name}</span> est précieux.</p>
      
      <div className="flex justify-center space-x-3 mb-10">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRating(star)}
            className={`text-5xl transition-all duration-200 hover:scale-125 ${score >= star ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-200'}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="mb-8 text-left">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Observations clés</label>
        <textarea
          className="w-full rounded-2xl border-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-4 border text-slate-700 bg-slate-50 font-medium"
          rows={3}
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Ex: Vision stratégique bluffante, fit culturel immédiat..."
        ></textarea>
      </div>

      <Button
        className="w-full h-14 text-xl font-bold shadow-indigo-200 shadow-xl"
        disabled={score === 0}
        onClick={() => onSubmit({ meetingId, fromId: 'current', toId: meetingUser.id, score, comment })}
      >
        Valider le score
      </Button>
    </div>
  );
};
