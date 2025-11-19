export interface Deck {
  id: string;
  name: string;
  isDeleted?: boolean;
}

export type PerformanceRating = 'AGAIN' | 'GOOD' | 'EASY';

export interface StudyLog {
  id?: number; // auto-incremented primary key
  cardId: string;
  date: string; // ISO string for the date of review
  rating: PerformanceRating;
}

export interface DailyGoal {
  id: string; // e.g., 'study-10'
  type: 'STUDY' | 'QUIZ' | 'STREAK';
  description: string; // e.g., 'Review 10 cards'
  target: number;
  progress: number;
  xp: number;
  isComplete: boolean;
}

export interface UserProfile {
  id: number; // primary key, always 1 for the single user
  firstName?: string;
  lastName?: string;
  bio?: string;
  xp: number;
  level: number;
  lastStreakCheck: string; // ISO date string YYYY-MM-DD
  profileLastUpdated?: string; // ISO string for timestamp
  dailyGoals?: {
    date: string; // YYYY-MM-DD
    goals: DailyGoal[];
    allCompleteAwarded: boolean;
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  isSecret?: boolean; // For hidden achievements
}

export interface UserAchievement {
  achievementId: string;
  dateEarned: string; // ISO string
}


export interface Flashcard {
  id: string;
  deckId: string;
  front: string; // Target Language (English)
  back: string; // Native Language (Persian)
  pronunciation?: string;
  partOfSpeech?: string;
  definition?: string[];
  exampleSentenceTarget?: string[];
  notes?: string;
  isDeleted?: boolean;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string for timestamp-based sync

  // Field for audio
  audioSrc?: string; // URL of the audio file

  // Fields for Spaced Repetition System (SRS)
  repetition: number;
  easinessFactor: number;
  interval: number;
  dueDate: string; // ISO string
}

export interface Settings {
    theme: 'light' | 'dark' | 'system';
    defaultApiSource: 'free' | 'mw';
    bulkAddConcurrency?: number;
    bulkAddAiTimeout?: number;
    bulkAddDictTimeout?: number;
}

export interface StudySessionOptions {
  filter: 'all-due' | 'new' | 'review' | 'all-cards';
  limit: number;
}