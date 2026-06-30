import React from 'react';
import { Shield, LogOut, Flame, Star, Award } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  xp: number;
  level: number;
}

export default function Header({ user, onLogout, xp, level }: HeaderProps) {
  const xpNeeded = level * 100;
  const xpPercentage = Math.min(100, Math.round((xp / xpNeeded) * 100));

  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center justify-between" id="app-header">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-100">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
            TaskHero <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">AI Coach</span>
          </h1>
          <p className="text-xs text-zinc-500">Conquer Procrastination & Meet Deadlines</p>
        </div>
      </div>

      {user && (
        <div className="flex items-center space-x-6">
          {/* XP & Level Panel */}
          <div className="hidden md:flex items-center space-x-4 bg-zinc-50 border border-zinc-100 px-4 py-2 rounded-2xl">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs font-semibold text-zinc-700">Level {level} Slayer</p>
                <div className="w-24 bg-zinc-200 h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${xpPercentage}%` }} 
                  />
                </div>
              </div>
            </div>
            <div className="text-right border-l border-zinc-200 pl-4">
              <span className="text-xs text-zinc-400 block uppercase font-bold tracking-wider">XP Tracker</span>
              <span className="text-sm font-bold text-zinc-800">{xp} / {xpNeeded} XP</span>
            </div>
          </div>

          {/* Profile & Logout */}
          <div className="flex items-center space-x-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-9 h-9 rounded-full border border-zinc-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center font-bold text-sm border border-zinc-200">
                {user.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-zinc-800 leading-none">{user.displayName || 'Hero'}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-zinc-50 transition-colors"
              title="Logout"
              id="logout-button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
