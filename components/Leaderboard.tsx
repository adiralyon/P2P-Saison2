
import React, { useEffect, useState } from 'react';
import { User, ProfessionalCategory } from '../types';
import { getDuoSummary } from '../services/geminiService';

interface LeaderboardProps {
  users: User[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ users }) => {
  const [duoSynthesis, setDuoSynthesis] = useState<string>("");
  const sortedUsers = [...users].sort((a, b) => b.avgScore - a.avgScore);

  // Suggest a "Power Duo" from top 2 across categories
  const top1 = sortedUsers[0];
  const top2 = sortedUsers[1];

  useEffect(() => {
    if (top1 && top2) {
      getDuoSummary(top1, top2).then(setDuoSynthesis);
    }
  }, [top1, top2]);

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
          <span className="mr-2">🏆</span> Le Palmarès
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Rang</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Profil</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Score Moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUsers.map((user, idx) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-400">#{idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={user.avatar} className="w-10 h-10 rounded-full" alt="" />
                      <div>
                        <div className="font-bold text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.role} @ {user.company}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                      {/* Fix: use categories array */}
                      {user.categories.join(', ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-amber-500 font-bold">
                      {user.avgScore.toFixed(1)} <span className="ml-1 text-xs">★</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {top1 && top2 && (
        <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10 p-4">
            <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
          </div>
          
          <h2 className="text-2xl font-bold mb-8 text-center">🤝 Duo Haute-Performance Suggéré</h2>
          
          <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-12">
            <div className="text-center group">
              <img src={top1.avatar} className="w-24 h-24 rounded-full border-4 border-indigo-400 group-hover:scale-105 transition-transform mx-auto mb-2 shadow-lg" alt="" />
              <div className="font-bold">{top1.name}</div>
              {/* Fix: use categories array */}
              <div className="text-indigo-200 text-xs">{top1.categories.join(', ')}</div>
            </div>
            
            <div className="text-3xl font-bold text-indigo-300">+</div>
            
            <div className="text-center group">
              <img src={top2.avatar} className="w-24 h-24 rounded-full border-4 border-indigo-400 group-hover:scale-105 transition-transform mx-auto mb-2 shadow-lg" alt="" />
              <div className="font-bold">{top2.name}</div>
              {/* Fix: use categories array */}
              <div className="text-indigo-200 text-xs">{top2.categories.join(', ')}</div>
            </div>
          </div>

          <div className="mt-8 bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
            <h4 className="text-sm font-bold uppercase tracking-widest text-indigo-100 mb-2">Analyse de synergie (IA)</h4>
            <p className="text-lg italic leading-relaxed">
              {duoSynthesis || "Génération de l'analyse..."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
