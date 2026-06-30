import React, { useMemo } from 'react';
import { Shield, CheckSquare, Calendar, Flame, Target, Sparkles, Brain, Trophy, ChevronRight, Play } from 'lucide-react';
import { Habit, TaskHeroGoal } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

interface DashboardProps {
  habits: Habit[];
  goals: TaskHeroGoal[];
  onAddXP: (amount: number) => void;
  onActiveTab: (tab: string) => void;
}

export default function Dashboard({ habits, goals, onAddXP, onActiveTab }: DashboardProps) {
  // Compute habit completion rates
  const chartData = useMemo(() => {
    // Generate data for the past 7 days
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
      
      let completed = 0;
      let total = habits.length;

      habits.forEach(h => {
        if (h.history[dateStr]) {
          completed += 1;
        }
      });

      data.push({
        name: label,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        total
      });
    }
    return data;
  }, [habits]);

  // Streak computations
  const totalStreaks = habits.reduce((sum, h) => sum + h.streak, 0);
  const highestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;

  // Compute pending goals & tasks
  const pendingGoals = goals.filter(g => g.status === 'pending');
  const totalSubtasks = goals.reduce((sum, g) => sum + g.subtasks.length, 0);
  const completedSubtasks = goals.reduce((sum, g) => sum + g.subtasks.filter(s => s.completed).length, 0);
  const taskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // Dynamic proactive coach text
  const coachMessage = useMemo(() => {
    if (habits.length === 0) {
      return {
        title: "Build Your First Ritual",
        text: "Add a daily habit like 'Review Deadlines' or 'Focus for 25m'. Setting solid habits protects your future from last-minute panic.",
        type: "tip"
      };
    }
    
    const activeStreaks = habits.filter(h => h.streak > 0).length;
    if (activeStreaks === 0) {
      return {
        title: "Overcome Inertia Today",
        text: "All your streaks are currently zero. It takes just 1 key action to get the flywheel spinning. Which habit can you check off first?",
        type: "warn"
      };
    }

    if (highestStreak >= 5) {
      return {
        title: "You are Unstoppable!",
        text: `Impressive consistency! You've maintained a ${highestStreak}-day streak. Procrastination is running scared. Keep driving!`,
        type: "success"
      };
    }

    return {
      title: "Keep the Momentum",
      text: "You are active! Completing habits daily accumulates XP and strengthens your Level. Keep syncing with Calendar so you stay ahead.",
      type: "tip"
    };
  }, [habits, highestStreak]);

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Top Banner Hero Coach */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-3 max-w-xl z-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-zinc-800 text-orange-400 rounded-full text-xs font-semibold">
            <Brain className="w-3.5 h-3.5" />
            <span>Hero Coaching Active</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Stop reacting. Start executing.
          </h2>
          <p className="text-sm text-zinc-300">
            TaskHero AI synchronizes your Google Tasks and Calendar to break down massive commitments into small daily battles. Check things off to stack XP and build unstoppable routines.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button 
              onClick={() => onActiveTab('planner')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-lg shadow-orange-950/25"
            >
              <Calendar className="w-4 h-4" />
              <span>Sync Workspace</span>
            </button>
            <button 
              onClick={() => onActiveTab('companion')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Talk to Hero AI</span>
            </button>
          </div>
        </div>

        {/* Level Emblem */}
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-800/50 backdrop-blur-md rounded-2xl border border-zinc-800 max-w-xs text-center z-10 w-full md:w-auto">
          <Trophy className="w-12 h-12 text-orange-400 mb-2" />
          <div className="text-2xl font-black text-orange-400">XP REWARDS</div>
          <p className="text-xs text-zinc-400 mt-1 max-w-[180px]">Check off tasks & habit streaks to earn levels and unlock achievements.</p>
        </div>
      </div>

      {/* Grid of quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Active Habits</span>
            <span className="text-3xl font-extrabold text-zinc-900">{habits.length}</span>
            <span className="text-xs text-zinc-500 block">Total habits trackable</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Task Success Rate</span>
            <span className="text-3xl font-extrabold text-zinc-900">{taskProgress}%</span>
            <span className="text-xs text-zinc-500 block">{completedSubtasks} of {totalSubtasks} milestones complete</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Total Daily Streaks</span>
            <span className="text-3xl font-extrabold text-zinc-900">{totalStreaks} Days</span>
            <span className="text-xs text-zinc-500 block">Longest streak: {highestStreak} days</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Recharts Analytics & Proactive tips */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics Card */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Habit Consistency Analytics</h3>
              <p className="text-xs text-zinc-500">Weekly completion percentage overview</p>
            </div>
          </div>
          <div className="h-64">
            {habits.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
                <Target className="w-8 h-8 text-zinc-300" />
                <p className="text-sm">No analytics available yet.</p>
                <p className="text-xs max-w-xs">Create daily habits in the Habit Tracker tab to start graphing consistency metrics.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: any) => [`${value}% Completion`, 'Success Rate']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="completionRate" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Coach Assistant Column */}
        <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-wider uppercase text-zinc-400">Coach Insight</span>
              <Brain className={`w-5 h-5 ${coachMessage.type === 'warn' ? 'text-amber-500' : 'text-orange-500'}`} />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-800">{coachMessage.title}</h4>
              <p className="text-xs text-zinc-600 leading-relaxed">{coachMessage.text}</p>
            </div>

            <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-orange-600 uppercase">Coach Recommendation</span>
              <p className="text-xs font-semibold text-zinc-800">Review schedule at 9:00 AM</p>
              <p className="text-[11px] text-zinc-500">Checking your primary calendar daily increases task output by up to 40%.</p>
            </div>
          </div>

          <button
            onClick={() => onActiveTab('companion')}
            className="w-full mt-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1"
          >
            <span>Ask AI Coach</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
