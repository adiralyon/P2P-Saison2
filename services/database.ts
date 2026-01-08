
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, update, remove } from 'firebase/database';
import { User, Meeting } from '../types';

/**
 * CONFIGURATION FIREBASE
 * Allez sur https://console.firebase.google.com/
 * Créez un projet, ajoutez une application Web et copiez votre config ici.
 * Activez 'Realtime Database' dans la console Firebase.
 */
const firebaseConfig = {
  apiKey: "AIzaSyD__YfaQ0UmR5A9dx1fxIENkvXV082u6h8",
  authDomain: "p2p-adira-3ecdd.firebaseapp.com",
  databaseURL: "https://p2p-adira-default-rtdb.firebaseio.com/",
  projectId: "p2p-adira-3ecdd",
  storageBucket: "p2p-adira-3ecdd.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const dbService = {
  // Écouter les utilisateurs en temps réel
  subscribeToUsers: (callback: (users: User[]) => void) => {
    const usersRef = ref(db, 'users');
    return onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        callback(userList);
      } else {
        callback([]);
      }
    });
  },

  // Écouter les rencontres en temps réel
  subscribeToMeetings: (callback: (meetings: Meeting[]) => void) => {
    const meetingsRef = ref(db, 'meetings');
    return onValue(meetingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const meetingList = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        callback(meetingList);
      } else {
        callback([]);
      }
    });
  },

  // Actions d'écriture
  saveUser: async (user: User) => {
    await set(ref(db, `users/${user.id}`), user);
  },

  updateUser: async (id: string, updates: Partial<User>) => {
    await update(ref(db, `users/${id}`), updates);
  },

  saveMeetings: async (meetings: Meeting[]) => {
    const updates: any = {};
    // On nettoie d'abord les anciennes rencontres
    await remove(ref(db, 'meetings'));
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
