export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export type ChatMode = 'operations' | 'scheduling' | 'diagnosis';

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export interface SensorDataPoint {
  time: string;
  vibration: number; // mm/s
  temperature: number; // Celsius
}

// App State context to share data between components
export interface AppContextState {
  // New state for file analysis
  isDataLoaded: boolean;
  fileName: string | null;
  sensorData: SensorDataPoint[];
}

// New Interface for Chat History Sessions
export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode; // Added mode to session
  messages: ChatMessage[];
  lastModified: number; // timestamp for sorting
}