
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';
import { User, Meeting } from '../types';

/**
 * CONFIGURATION FIREBASE
 * Si l'application bug au démarrage, vérifiez que votre Realtime Database est bien 
 * configurée en mode 'test' (lecture/écriture publiques) ou avec les règles appropriées.
 */
const firebaseConfig = {
  apiKey: "AIzaSyD__YfaQ0UmR5A9dx1fxIENkvXV082u6h8",
  authDomain: "p2p-adira-3ecdd.firebaseapp.com",
  databaseURL: "https://p2p-adira-default-rtdb.firebaseio.com",
  projectId: "p2p-adira-3ecdd",
  storageBucket: "p2p-adira-3ecdd.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Initialisation unique
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

export const dbService = {
  subscribeToUsers: (callback: (users: User[]) => void) => {
    const usersRef = ref(db, 'users');
    return onValue(usersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const userList = Object.keys(data).map(key => ({
            ...data[key],
            id: key,
            // Sécurité : assurer que les tableaux existent
            categories: data[key].categories || []
          }));
          callback(userList);
        } else {
          callback([]);
        }
      } catch (err) {
        console.error("Erreur Sync Users:", err);
      }
    });
  },

  subscribeToMeetings: (callback: (meetings: Meeting[]) => void) => {
    const meetingsRef = ref(db, 'meetings');
    return onValue(meetingsRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data) {
          const meetingList = Object.keys(data).map(key => ({
            ...data[key],
            id: key,
            ratings: data[key].ratings || []
          }));
          callback(meetingList);
        } else {
          callback([]);
        }
      } catch (err) {
        console.error("Erreur Sync Meetings:", err);
      }
    });
  },

  saveUser: async (user: User) => {
    await set(ref(db, `users/${user.id}`), user);
  },

  deleteUser: async (id: string) => {
    await remove(ref(db, `users/${id}`));
  },

  // Mise à jour groupée pour éviter les lags UI
  syncAllUsers: async (users: User[]) => {
    const updates: any = {};
    // On peut soit écraser 'users', soit faire un update par clé
    // Ici on écrase pour être raccord avec la liste locale de l'admin
    await set(ref(db, 'users'), users.reduce((acc: any, u) => {
      acc[u.id] = u;
      return acc;
    }, {}));
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    await update(ref(db, `users/${id}`), updates);
  },

  saveMeetings: async (meetings: Meeting[]) => {
    await remove(ref(db, 'meetings'));
    const updates: any = {};
    meetings.forEach(m => {
      updates[`meetings/${m.id}`] = m;
    });
    await update(ref(db, '/'), updates);
  },

  updateMeeting: async (id: string, updates: Partial<Meeting>) => {
    await update(ref(db, `meetings/${id}`), updates);
  },

  resetAll: async () => {
    await set(ref(db, 'users'), null);
    await set(ref(db, 'meetings'), null);
  }
};
