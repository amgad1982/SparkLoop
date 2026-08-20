import { create } from 'zustand';
import { UserDto } from '../types/api';

export interface Persona {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
}

export const PRESET_PERSONAS: Persona[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'alice',
    displayName: 'Alice Wonder 🎨',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice',
    role: 'Digital Artist & Storyteller',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'bob',
    displayName: 'Bob The Bard 🎸',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=bob',
    role: 'Musician & Audio Chain Wizard',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'noor',
    displayName: 'نور العرّاف 🌟',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=noor',
    role: 'راوية قصص تفاعلية',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    username: 'tariq',
    displayName: 'طارق صانع الميمز ⚡',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=tariq',
    role: 'صانع ميمز وتحديات',
  },
];

interface AuthState {
  currentPersona: Persona;
  currentUser: UserDto | null;
  centrifugoToken: string | null;
  setPersona: (persona: Persona) => void;
  setUser: (user: UserDto) => void;
  setCentrifugoToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentPersona: PRESET_PERSONAS[0],
  currentUser: null,
  centrifugoToken: null,
  setPersona: (persona) => set({ currentPersona: persona }),
  setUser: (user) => set({ currentUser: user }),
  setCentrifugoToken: (token) => set({ centrifugoToken: token }),
}));
