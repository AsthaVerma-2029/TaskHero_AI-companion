export interface TaskHeroGoal {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  subtasks: TaskHeroSubtask[];
  syncedToGoogle: boolean;
  status: 'pending' | 'completed';
}

export interface TaskHeroSubtask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface Habit {
  id: string;
  name: string;
  streak: number;
  history: { [date: string]: boolean }; // e.g. { '2026-06-30': true }
  category: string;
  createdAt: string;
}

export interface WorkspaceCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
}

export interface WorkspaceTaskList {
  id: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  audioUrl?: string; // If there is a TTS voice version
}
