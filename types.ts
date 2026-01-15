
export enum ProfessionalCategory {
  DSI = 'DSI',
  RSSI_CYBER = 'RSSI ou Expert Cyber',
  ARCHITECTE = "Architecte d'Entreprise",
  INFRA_NET = 'Responsable ou Expert Infrastructure, Systèmes & Réseaux',
  DATA_IA = 'Responsable ou Expert Data & IA',
  PMO_PO_PM = 'PMO-PO-PM',
  MARKETING_ECOMMERCE = 'Responsable Marketing digital et/ou E-commerce',
  RH_RECRUTEUR = 'RH ou recruteur',
  DIR_PRESTATAIRE = "Direction générale ou commerciale d'entreprise prestataire",
  DIR_ECOLE = "Direction d'écoles/université & Responsable enseignement",
  ACHETEUR_JURISTE = 'Acheteur ou Juriste',
  AUTRE = 'Autre'
}

export interface User {
  id: string;
  name: string; 
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  categories: ProfessionalCategory[];
  bio: string;
  avatar: string;
  avgScore: number;
  connectionCode?: string;
  matchId?: string; // ID du partenaire validé pour le palmarès final
}

export interface Rating {
  meetingId: string;
  fromId: string;
  toId: string;
  score: number; 
  comment?: string;
}

export interface Meeting {
  id: string;
  participant1Id: string;
  participant2Id: string;
  tableNumber: number;
  scheduledTime: string;
  round: number;
  category: ProfessionalCategory; 
  actualStartTime?: number;
  status: 'scheduled' | 'ongoing' | 'completed';
  ratings: Rating[];
}

export type AppMode = 'PORTAL_SELECT' | 'USER_PORTAL' | 'ADMIN_PORTAL';
export type UserSubState = 'REGISTRATION' | 'SCHEDULE' | 'ACTIVE_MEETING' | 'SCORING' | 'SYNTHESIS' | 'DATA_MANAGEMENT';
export type AdminSubState = 'PROFILES' | 'PLANNING' | 'RESULTS';
