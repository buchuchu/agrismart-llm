export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export interface MachinerySpec {
  type: string;
  brand: string;
  model: string;
  horsepower: string;
  width: string;
  suitableFor: string;
  imageUrl?: string;
}

export interface ScheduleTask {
  id: string;
  taskName: string;
  machine: string;
  startDate: string; // ISO Date string
  durationDays: number;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface SensorDataPoint {
  time: string;
  vibration: number; // mm/s
  temperature: number; // Celsius
}

// App State context to share data between chat and right panel
export interface AppContextState {
  machinerySpec: MachinerySpec | null;
  schedule: ScheduleTask[];
  sensorData: SensorDataPoint[];
  activePanel: 'machinery' | 'schedule' | 'sensor';
}
