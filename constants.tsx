
import { ProfessionalCategory, User } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alice Martin',
    // Fix: Added missing required firstName and lastName properties
    firstName: 'Alice',
    lastName: 'Martin',
    company: 'DataStream Solutions',
    role: 'Head of Data',
    categories: [ProfessionalCategory.DATA_IA, ProfessionalCategory.DSI],
    bio: 'Spécialiste en LLMs et gouvernance de données.',
    avatar: 'https://picsum.photos/seed/u1/200',
    avgScore: 4.8
  },
  {
    id: 'u2',
    name: 'Jean Dupont',
    // Fix: Added missing required firstName and lastName properties
    firstName: 'Jean',
    lastName: 'Dupont',
    company: 'SecurIT',
    role: 'RSSI',
    categories: [ProfessionalCategory.RSSI_CYBER],
    bio: 'Expert en Zero Trust et audit de sécurité.',
    avatar: 'https://picsum.photos/seed/u2/200',
    avgScore: 4.5
  },
  {
    id: 'u3',
    name: 'Sophie Laurent',
    // Fix: Added missing required firstName and lastName properties
    firstName: 'Sophie',
    lastName: 'Laurent',
    company: 'Global Infra',
    role: 'Directeur Infrastructures',
    categories: [ProfessionalCategory.INFRA_NET, ProfessionalCategory.ARCHITECTE],
    bio: 'Optimisation hybride Cloud et On-premise.',
    avatar: 'https://picsum.photos/seed/u3/200',
    avgScore: 4.2
  }
];

export const TIME_SLOTS = [
  "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30"
];

export const MEETING_DURATION_SECONDS = 480; // 8 minutes
