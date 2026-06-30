import React, { useState } from 'react';
import { Habit } from '../types';
import { Plus, Flame, Check, Trash2, Calendar, Award } from 'lucide-react';

interface HabitsTrackerProps {
  habits: Habit[];
  onAddHabit: (name: string, category: string) => void;
  onToggleHabit: (habitId: string, dateStr: string) => void;
  onDeleteHabit: (habitId: string) => void;
}

const CATEGORIES = ['Mindset', 'Productivity', 'Health', 'Learning', 'Work'];

export default function HabitsTracker({ habits, onAddHabit, onToggleHabit, onDeleteHabit }: HabitsTrackerProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isAdding, setIsAdding] = useState(false);

  // Generate date strings for the past 5 days for the check-off grid
  const recentDates = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return { dateStr, label };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddHabit(name.trim(), category);
    setName('');
    setIsAdding(false);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'mindset': return 'bg-violet-50 text-violet-600 border-violet-100';
      case 'productivity': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'health': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'learning': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    }
  };

  const handleDeleteClick = (habit: Habit) => {
    const confirmed = window.confirm(`Are you sure you want to delete the habit "${habit.name}"? All streak history will be permanently lost.`);
    if (confirmed) {
      onDeleteHabit(habit.id);
    }
  };

  return (
    <div className="space-y-6" id="habits-tracker">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Daily Habits & Goal Tracker</h2>
          <p className="text-xs text-zinc-500">Form solid consistency routines. Small daily wins yield grand long-term outcomes.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
          id="toggle-add-habit"
        >
          <Plus className="w-4 h-4" />
          <span>New Ritual</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm space-y-4 animate-fade-in" id="new-habit-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 block">Habit Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Plan my morning tasks, Drink 2L water"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors shadow-lg shadow-orange-600/10"
            >
              Add Habit
            </button>
          </div>
        </form>
      )}

      {habits.length === 0 ? (
        <div className="bg-white border border-zinc-100 p-12 text-center rounded-3xl space-y-4 shadow-sm" id="empty-habits">
          <div className="w-16 h-16 bg-orange-50 text-orange-600 flex items-center justify-center rounded-2xl mx-auto shadow-sm">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-zinc-800">No rituals logged yet</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Starting is the hardest part. Create a habit like "Check Google Calendar" or "Set 3 Daily priorities" to earn daily XP and build routine momentum!</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-orange-600/15"
          >
            Create Your First Ritual
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm" id="habits-list-container">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between text-xs font-bold text-zinc-400">
            <span>HABIT & CATEGORY</span>
            <div className="flex items-center space-x-6">
              <span className="w-16 text-center">STREAK</span>
              <span className="w-64 text-center">PAST 5 DAYS</span>
              <span className="w-10"></span>
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {habits.map((habit) => (
              <div key={habit.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                {/* Habit details */}
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-zinc-800 leading-tight">{habit.name}</h3>
                  <span className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${getCategoryColor(habit.category)}`}>
                    {habit.category}
                  </span>
                </div>

                {/* Grid check-off */}
                <div className="flex items-center justify-between md:justify-end gap-6 md:gap-8">
                  {/* Streak block */}
                  <div className="flex items-center space-x-1.5 bg-orange-50 px-2.5 py-1 rounded-xl border border-orange-100 text-orange-600 w-16 justify-center">
                    <Flame className="w-4 h-4 fill-orange-500" />
                    <span className="text-xs font-extrabold">{habit.streak}d</span>
                  </div>

                  {/* Past 5 days */}
                  <div className="flex items-center space-x-3 w-64 justify-center">
                    {recentDates.map(({ dateStr, label }) => {
                      const isCompleted = !!habit.history[dateStr];
                      return (
                        <button
                          key={dateStr}
                          onClick={() => onToggleHabit(habit.id, dateStr)}
                          className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-100'
                              : 'bg-zinc-50 text-zinc-400 border border-zinc-200 hover:border-zinc-300'
                          }`}
                          title={`Toggle ${habit.name} for ${label}`}
                        >
                          <span className="text-[8px] font-bold uppercase leading-none mb-0.5">{label.substring(0, 3)}</span>
                          <Check className={`w-3.5 h-3.5 stroke-[3] ${isCompleted ? 'opacity-100' : 'opacity-0'}`} />
                        </button>
                      );
                    })}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteClick(habit)}
                    className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-100 transition-colors w-10 h-10 flex items-center justify-center"
                    title="Delete Habit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
