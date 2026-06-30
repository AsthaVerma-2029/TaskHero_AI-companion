import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, getDocs, doc, setDoc, deleteDoc, 
  query, where, onSnapshot 
} from 'firebase/firestore';
import { 
  initAuth, googleSignIn, logout, db, auth 
} from './lib/firebase';
import { 
  listCalendarEvents, listTaskLists, listTasks, 
  createWorkspaceTask, updateWorkspaceTaskStatus, 
  deleteWorkspaceTask, createCalendarEvent, deleteCalendarEvent 
} from './lib/workspace';
import { Habit, WorkspaceCalendarEvent, WorkspaceTask, WorkspaceTaskList, TaskHeroGoal } from './types';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import TaskPlanner from './components/TaskPlanner';
import HabitsTracker from './components/HabitsTracker';
import HeroAICompanion from './components/HeroAICompanion';
import { Shield, Sparkles, LogIn, Flame, Brain, Info, Award, Calendar } from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App workspace/persistence state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<TaskHeroGoal[]>([]);

  // Google Workspace items
  const [calendarEvents, setCalendarEvents] = useState<WorkspaceCalendarEvent[]>([]);
  const [taskLists, setTaskLists] = useState<WorkspaceTaskList[]>([]);
  const [activeTaskListId, setActiveTaskListId] = useState('');
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync Habits from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      setHabits([]);
      return;
    }

    // Load XP & Level from LocalStorage or Firestore
    const savedXp = localStorage.getItem(`xp_${user.uid}`);
    const savedLevel = localStorage.getItem(`level_${user.uid}`);
    if (savedXp) setXp(parseInt(savedXp, 10));
    if (savedLevel) setLevel(parseInt(savedLevel, 10));

    // Setup real-time sync for user habits in firestore
    const habitsCol = collection(db, 'users', user.uid, 'habits');
    const unsubscribe = onSnapshot(habitsCol, (snapshot) => {
      const list: Habit[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Habit);
      });
      setHabits(list);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Google Workspace data when token is ready
  useEffect(() => {
    if (accessToken) {
      fetchGoogleWorkspaceData();
    }
  }, [accessToken]);

  // Sync active task list's tasks when selected list changes
  useEffect(() => {
    if (accessToken && activeTaskListId) {
      fetchActiveTaskListTasks();
    }
  }, [accessToken, activeTaskListId]);

  const fetchGoogleWorkspaceData = async () => {
    if (!accessToken) return;
    setIsLoadingWorkspace(true);
    try {
      // Fetch calendar
      const events = await listCalendarEvents(accessToken);
      setCalendarEvents(events);

      // Fetch task lists
      const lists = await listTaskLists(accessToken);
      setTaskLists(lists);
      
      if (lists.length > 0) {
        // Default to first list (usually Default list)
        setActiveTaskListId(lists[0].id);
      }
    } catch (err) {
      console.error('Failed fetching Google Workspace lists:', err);
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  const fetchActiveTaskListTasks = async () => {
    if (!accessToken || !activeTaskListId) return;
    try {
      const items = await listTasks(accessToken, activeTaskListId);
      setTasks(items);
    } catch (err) {
      console.error('Failed fetching Google tasks:', err);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('OAuth flow fail:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setCalendarEvents([]);
    setTaskLists([]);
    setTasks([]);
  };

  // Add Habit to Firestore
  const handleAddHabit = async (name: string, category: string) => {
    if (!user) return;
    const newHabit: Omit<Habit, 'id'> = {
      name,
      category,
      streak: 0,
      history: {},
      createdAt: new Date().toISOString()
    };
    
    const habitId = Math.random().toString(36).substring(2, 9);
    const habitDoc = doc(db, 'users', user.uid, 'habits', habitId);
    await setDoc(habitDoc, newHabit);
    addXP(20); // Earn XP for setting healthy goals
  };

  // Toggle habit complete
  const handleToggleHabit = async (habitId: string, dateStr: string) => {
    if (!user) return;
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const updatedHistory = { ...habit.history };
    let streak = habit.streak;

    if (updatedHistory[dateStr]) {
      // Uncheck
      delete updatedHistory[dateStr];
      streak = Math.max(0, streak - 1);
    } else {
      // Check complete
      updatedHistory[dateStr] = true;
      streak += 1;
      addXP(15); // Earn XP for habit completion!
    }

    const habitDoc = doc(db, 'users', user.uid, 'habits', habitId);
    await setDoc(habitDoc, { history: updatedHistory, streak }, { merge: true });
  };

  // Delete habit from Firestore
  const handleDeleteHabit = async (habitId: string) => {
    if (!user) return;
    const habitDoc = doc(db, 'users', user.uid, 'habits', habitId);
    await deleteDoc(habitDoc);
  };

  // XP accumulation engine
  const addXP = (amount: number) => {
    if (!user) return;
    setXp(prevXp => {
      const newXp = prevXp + amount;
      let currentLevel = level;
      let xpNeeded = currentLevel * 100;

      if (newXp >= xpNeeded) {
        currentLevel += 1;
        const remainder = newXp - xpNeeded;
        localStorage.setItem(`level_${user.uid}`, currentLevel.toString());
        localStorage.setItem(`xp_${user.uid}`, remainder.toString());
        setLevel(currentLevel);
        return remainder;
      } else {
        localStorage.setItem(`xp_${user.uid}`, newXp.toString());
        return newXp;
      }
    });
  };

  // Google Workspace actions proxied via workspace.ts
  const handleAddCalendarEvent = async (
    summary: string, 
    description: string, 
    startTime: string, 
    endTime: string, 
    location?: string
  ) => {
    if (!accessToken) return;
    const newEvent = await createCalendarEvent(accessToken, {
      summary,
      description,
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      location
    });
    setCalendarEvents(prev => [newEvent, ...prev]);
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    if (!accessToken) return;
    await deleteCalendarEvent(accessToken, eventId);
    setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleAddWorkspaceTask = async (title: string, notes?: string, due?: string) => {
    if (!accessToken || !activeTaskListId) return;
    const newTask = await createWorkspaceTask(accessToken, activeTaskListId, { title, notes, due });
    setTasks(prev => [newTask, ...prev]);
  };

  const handleToggleWorkspaceTaskStatus = async (taskId: string, completed: boolean) => {
    if (!accessToken || !activeTaskListId) return;
    const updated = await updateWorkspaceTaskStatus(accessToken, activeTaskListId, taskId, completed);
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    if (completed) {
      addXP(25); // XP for clearing real tasks!
    }
  };

  const handleDeleteWorkspaceTask = async (taskId: string) => {
    if (!accessToken || !activeTaskListId) return;
    await deleteWorkspaceTask(accessToken, activeTaskListId, taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  // Render Login state if unauthenticated
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" id="login-screen">
        <div className="max-w-md w-full mx-auto space-y-8 bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-36 h-36 bg-orange-600/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-orange-600 flex items-center justify-center text-white rounded-2xl mx-auto shadow-lg shadow-orange-100">
              <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-zinc-900 tracking-tight">TaskHero</h2>
            <p className="text-xs font-bold px-3 py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-full inline-block">Conquer Deadlines with AI</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              Proactive AI coach, daily streak trackers, and direct synchronization with Google Calendar & Tasks.
            </p>
          </div>

          <div className="space-y-4">
            {/* Custom Styled Material Button */}
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-zinc-200 rounded-xl shadow-sm text-sm font-bold text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all cursor-pointer disabled:bg-zinc-100"
              id="google-signin-button"
            >
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
              ) : (
                <svg className="w-5 h-5" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
              )}
              <span>{isLoggingIn ? 'Establishing Link...' : 'Sign in with Google'}</span>
            </button>
          </div>

          <div className="flex items-start gap-2 text-[10px] text-zinc-400 border-t border-zinc-100 pt-4">
            <Info className="w-3.5 h-3.5 shrink-0 text-zinc-300" />
            <span>TaskHero accesses Google Calendar & Tasks with permission from the user's account to secure live bidirectional synchronization.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans" id="taskhero-dashboard-app">
      {/* Header with XP & Level tracking */}
      <Header 
        user={user} 
        onLogout={handleLogout} 
        xp={xp} 
        level={level} 
      />

      {/* Main Layout Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0" id="navigation-sidebar">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 border-b md:border-b-0 border-zinc-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left flex items-center space-x-2.5 shrink-0 ${
                activeTab === 'dashboard' 
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-100' 
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Slayer Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left flex items-center space-x-2.5 shrink-0 ${
                activeTab === 'planner' 
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-100' 
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Workspace Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('habits')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left flex items-center space-x-2.5 shrink-0 ${
                activeTab === 'habits' 
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-100' 
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Habit Tracker</span>
            </button>

            <button
              onClick={() => setActiveTab('companion')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all text-left flex items-center space-x-2.5 shrink-0 ${
                activeTab === 'companion' 
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-100' 
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Companion</span>
            </button>
          </nav>

          {/* Proactive Encouragement Card */}
          <div className="hidden md:block bg-zinc-100 border border-zinc-200 rounded-2xl p-4 mt-6 text-center space-y-3">
            <Brain className="w-8 h-8 text-orange-600 mx-auto" />
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-orange-600 uppercase">Tip of the Day</span>
              <p className="text-xs font-bold text-zinc-800">Eat the Frog first!</p>
              <p className="text-[10px] text-zinc-500 leading-normal">Accomplishing your hardest task first thing in the morning blocks anxiety and triggers daily flow.</p>
            </div>
          </div>
        </aside>

        {/* Content Tabs Switcher */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard 
              habits={habits} 
              goals={goals} 
              onAddXP={addXP} 
              onActiveTab={setActiveTab} 
            />
          )}

          {activeTab === 'planner' && (
            <TaskPlanner
              accessToken={accessToken!}
              calendarEvents={calendarEvents}
              taskLists={taskLists}
              activeTaskListId={activeTaskListId}
              tasks={tasks}
              onSelectTaskList={setActiveTaskListId}
              onAddTask={handleAddWorkspaceTask}
              onToggleTaskStatus={handleToggleWorkspaceTaskStatus}
              onDeleteTask={handleDeleteWorkspaceTask}
              onAddCalendarEvent={handleAddCalendarEvent}
              onDeleteCalendarEvent={handleDeleteCalendarEvent}
              onAddXP={addXP}
              isLoading={isLoadingWorkspace}
              onRefresh={fetchGoogleWorkspaceData}
            />
          )}

          {activeTab === 'habits' && (
            <HabitsTracker
              habits={habits}
              onAddHabit={handleAddHabit}
              onToggleHabit={handleToggleHabit}
              onDeleteHabit={handleDeleteHabit}
            />
          )}

          {activeTab === 'companion' && (
            <HeroAICompanion 
              onAddXP={addXP} 
            />
          )}
        </main>

      </div>
    </div>
  );
}

// Loader icon
function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}
