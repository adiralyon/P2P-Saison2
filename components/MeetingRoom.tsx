
import React, { useState, useEffect } from 'react';
import { User, Meeting } from '../types';
import { MEETING_DURATION_SECONDS } from '../constants';
import { Button } from './Button';
import { getIcebreakers } from '../services/geminiService';

interface MeetingRoomProps {
  meeting: Meeting;
  participant: User;
  // Fix: Added currentUser to props to allow the icebreaker service to analyze both participants
  currentUser: User;
  onFinish: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ meeting, participant, currentUser, onFinish }) => {
  const [timeLeft, setTimeLeft] = useState(MEETING_DURATION_SECONDS);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [loadingIcebreakers, setLoadingIcebreakers] = useState(true);

  useEffect(() => {
    const fetchIB = async () => {
      // Fix: Pass both currentUser and the meeting participant to get relevant icebreakers
      const ib = await getIcebreakers(currentUser, participant); 
      setIcebreakers(ib);
      setLoadingIcebreakers(false);
    };
    fetchIB();
  }, [participant, currentUser]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onFinish();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onFinish]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((MEETING_DURATION_SECONDS - timeLeft) / MEETING_DURATION_SECONDS) * 100;

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in duration-300">
      <div className="bg-slate-900 rounded-t-2xl md:rounded-t-3xl p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl">
        <div className="text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-bold flex items-center justify-center md:justify-start">
            <span className="w-2 md:w-3 h-2 md:h-3 bg-red-500 rounded-full animate-pulse mr-3"></span>
            En direct
          </h2>
          <p className="text-slate-400 text-[10px] md:text-sm mt-1 uppercase tracking-widest font-bold">Table n°{meeting.tableNumber} • Round {meeting.round}</p>
        </div>
        <div className="text-4xl md:text-5xl font-mono font-black text-indigo-400">{formatTime(timeLeft)}</div>
      </div>
      
      <div className="w-full bg-slate-800 h-2 md:h-3">
        <div 
          className="bg-indigo-500 h-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-b-2xl md:rounded-b-3xl shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 border-x border-b border-slate-100">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left space-y-4 md:space-y-0 md:space-x-6">
            <img src={participant.avatar} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl border-4 border-slate-50 shadow-lg object-cover" alt="" />
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900">{participant.name}</h3>
              <p className="text-indigo-600 font-bold text-base md:text-lg">{participant.role}</p>
              <p className="text-slate-400 font-medium text-sm">{participant.company}</p>
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Expertise</h4>
            <p className="text-slate-700 leading-relaxed font-medium italic text-sm md:text-base">"{participant.bio}"</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {participant.categories.map(cat => (
              <span key={cat} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100">
                {cat}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6 md:p-8 rounded-2xl md:rounded-3xl relative overflow-hidden shadow-sm">
            <h4 className="text-amber-900 font-black mb-4 md:mb-6 flex items-center text-base md:text-lg">
              <span className="mr-3">🪄</span> Icebreakers IA
            </h4>
            {loadingIcebreakers ? (
              <div className="space-y-4">
                <div className="h-3 bg-amber-200/50 animate-pulse rounded w-3/4"></div>
                <div className="h-3 bg-amber-200/50 animate-pulse rounded w-full"></div>
                <div className="h-3 bg-amber-200/50 animate-pulse rounded w-5/6"></div>
              </div>
            ) : (
              <ul className="space-y-4 md:space-y-6">
                {icebreakers.map((q, i) => (
                  <li key={i} className="text-amber-900 text-xs md:text-sm italic font-bold border-l-4 border-amber-300 pl-4 leading-relaxed">
                    "{q}"
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <Button variant="danger" className="w-full h-14 md:h-16 text-lg font-bold shadow-lg rounded-2xl" onClick={onFinish}>
            Mettre fin à l'échange
          </Button>
        </div>
      </div>
    </div>
  );
};
