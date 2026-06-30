import React, { useState, useEffect } from 'react';
import { WorkspaceCalendarEvent, WorkspaceTask, WorkspaceTaskList } from '../types';
import { 
  Calendar, CheckSquare, ListPlus, Plus, Sparkles, Trash2, 
  MapPin, Clock, CalendarRange, RotateCw, Volume2, PlusSquare, Trash, X, Loader2
} from 'lucide-react';

interface TaskPlannerProps {
  accessToken: string;
  calendarEvents: WorkspaceCalendarEvent[];
  taskLists: WorkspaceTaskList[];
  activeTaskListId: string;
  tasks: WorkspaceTask[];
  onSelectTaskList: (listId: string) => void;
  onAddTask: (title: string, notes?: string, due?: string) => Promise<void>;
  onToggleTaskStatus: (taskId: string, completed: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onAddCalendarEvent: (summary: string, description: string, startTime: string, endTime: string, location?: string) => Promise<void>;
  onDeleteCalendarEvent: (eventId: string) => Promise<void>;
  onAddXP: (amount: number) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function TaskPlanner({
  accessToken,
  calendarEvents,
  taskLists,
  activeTaskListId,
  tasks,
  onSelectTaskList,
  onAddTask,
  onToggleTaskStatus,
  onDeleteTask,
  onAddCalendarEvent,
  onDeleteCalendarEvent,
  onAddXP,
  isLoading,
  onRefresh
}: TaskPlannerProps) {
  // Modal states
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // New Event form
  const [eventSummary, setEventSummary] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStart, setEventStart] = useState('09:00');
  const [eventEnd, setEventEnd] = useState('10:00');
  const [eventLoc, setEventLoc] = useState('');

  // New Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskDue, setTaskDue] = useState('');

  // AI Breakdown states
  const [aiGoalTitle, setAiGoalTitle] = useState('');
  const [aiGoalDesc, setAiGoalDesc] = useState('');
  const [isAIPlanning, setIsAIPlanning] = useState(false);
  const [aiSubtasks, setAiSubtasks] = useState<{ title: string; dueDateOffset: number; selected: boolean }[]>([]);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventSummary || !eventDate) return;
    try {
      const startTime = `${eventDate}T${eventStart}:00Z`;
      const endTime = `${eventDate}T${eventEnd}:00Z`;
      await onAddCalendarEvent(eventSummary, eventDesc, startTime, endTime, eventLoc);
      
      // Reset & close
      setEventSummary('');
      setEventDesc('');
      setEventDate('');
      setEventLoc('');
      setShowEventModal(false);
      onAddXP(30); // Earn XP for planning
    } catch (err) {
      console.error('Failed to create calendar event:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;
    try {
      const dueFormatted = taskDue ? `${taskDue}T23:59:59Z` : undefined;
      await onAddTask(taskTitle, taskNotes, dueFormatted);
      
      // Reset & close
      setTaskTitle('');
      setTaskNotes('');
      setTaskDue('');
      setShowTaskModal(false);
      onAddXP(15); // Earn XP for task logging
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleDeleteEventClick = async (eventId: string, summary: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the calendar event "${summary}"? This will modify your Google Calendar.`);
    if (confirmed) {
      await onDeleteCalendarEvent(eventId);
    }
  };

  const handleDeleteTaskClick = async (taskId: string, title: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the task "${title}"? This will remove it from Google Tasks.`);
    if (confirmed) {
      await onDeleteTask(taskId);
    }
  };

  // Run AI breakdown of a goal
  const handleAIBreakdown = async () => {
    if (!aiGoalTitle.trim()) return;
    setIsAIPlanning(true);
    setTtsAudioUrl(null);
    try {
      const res = await fetch('/api/gemini/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiGoalTitle,
          description: aiGoalDesc,
        }),
      });
      const data = await res.json();
      if (data.subtasks) {
        setAiSubtasks(data.subtasks.map((st: any) => ({ ...st, selected: true })));
      }
    } catch (err) {
      console.error('AI planning failed:', err);
    } finally {
      setIsAIPlanning(false);
    }
  };

  // Speak the AI milestones aloud using TTS
  const handleSpeakBreakdown = async () => {
    if (aiSubtasks.length === 0) return;
    setIsSpeaking(true);
    try {
      const textToSpeak = `TaskHero breakdown for your goal: ${aiGoalTitle}. Here are the milestones: ` + 
        aiSubtasks.map((st, i) => `Milestone ${i+1}: ${st.title}, due in ${st.dueDateOffset} days.`).join(' ');

      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak }),
      });
      const data = await res.json();
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setTtsAudioUrl(url);
        
        const audio = new Audio(url);
        audio.onended = () => setIsSpeaking(false);
        audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error('TTS audio breakdown speech failed:', err);
      setIsSpeaking(false);
    }
  };

  // Bulk create AI subtasks directly into Google Tasks
  const handleImportAISubtasks = async () => {
    const selectedTasks = aiSubtasks.filter(st => st.selected);
    if (selectedTasks.length === 0) return;

    try {
      setIsAIPlanning(true);
      for (const st of selectedTasks) {
        // Calculate offset due date
        const d = new Date();
        d.setDate(d.getDate() + st.dueDateOffset);
        const dueStr = d.toISOString().split('T')[0] + 'T23:59:59Z';
        
        await onAddTask(st.title, `AI Milestones of: ${aiGoalTitle}`, dueStr);
      }
      
      // Cleanup
      setAiGoalTitle('');
      setAiGoalDesc('');
      setAiSubtasks([]);
      setShowAIModal(false);
      onAddXP(50); // Massive XP for importing smart breakdown!
    } catch (err) {
      console.error('Failed importing AI subtasks:', err);
    } finally {
      setIsAIPlanning(false);
    }
  };

  return (
    <div className="space-y-6" id="planner-command-center">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Workspace Sync Command Center</h2>
          <p className="text-xs text-zinc-500">Live integration with Google Tasks and Google Calendar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2.5 text-zinc-500 hover:text-zinc-800 border border-zinc-200 bg-white rounded-xl hover:bg-zinc-50 transition-colors"
            title="Refresh All Google Data"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAIModal(true)}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-md shadow-orange-600/10"
            id="open-ai-breakdown"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Goal Breakdown</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12 bg-zinc-50 border border-zinc-100 rounded-2xl" id="loading-spinner">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mr-2" />
          <span className="text-sm font-semibold text-zinc-600">Retrieving schedule from Google Accounts...</span>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Calendar Section */}
          <div className="bg-white border border-zinc-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-bold text-zinc-800">Google Calendar Events</h3>
              </div>
              <button
                onClick={() => setShowEventModal(true)}
                className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                id="add-calendar-event"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Event</span>
              </button>
            </div>

            {calendarEvents.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">No upcoming events found on your primary Google Calendar.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {calendarEvents.map((event) => {
                  const startStr = event.start.dateTime || event.start.date || '';
                  const startObj = startStr ? new Date(startStr) : null;
                  const formattedTime = startObj ? startObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
                  const formattedDate = startObj ? startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'All Day';

                  return (
                    <div key={event.id} className="p-3 bg-zinc-50 border border-zinc-100 hover:border-zinc-200 rounded-xl flex items-start justify-between gap-3 transition-all">
                      <div className="space-y-1">
                        <h4 className="text-xs font-extrabold text-zinc-800">{event.summary}</h4>
                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarRange className="w-3 h-3" />
                            {formattedDate} {formattedTime && `at ${formattedTime}`}
                          </span>
                          {event.location && (
                            <span className="inline-flex items-center gap-0.5 max-w-[150px] truncate">
                              <MapPin className="w-3 h-3 text-red-400" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEventClick(event.id, event.summary)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tasks Section */}
          <div className="bg-white border border-zinc-100 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 pb-3">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-zinc-800">Google Task Manager</h3>
              </div>

              {/* Task List Selector */}
              <select
                value={activeTaskListId}
                onChange={(e) => onSelectTaskList(e.target.value)}
                className="px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white font-bold text-zinc-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                {taskLists.map(tl => (
                  <option key={tl.id} value={tl.id}>{tl.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-semibold">{tasks.length} tasks in active list</span>
              <button
                onClick={() => setShowTaskModal(true)}
                className="px-3 py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                id="add-task-item"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-zinc-400 py-8 text-center">Your active Google Task list is empty!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {tasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div 
                      key={task.id} 
                      className={`p-3 border rounded-xl flex items-start justify-between gap-3 transition-all ${
                        isCompleted ? 'bg-zinc-50/55 border-zinc-100' : 'bg-white border-zinc-100 hover:border-zinc-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={(e) => onToggleTaskStatus(task.id, e.target.checked)}
                          className="mt-1 w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-zinc-300 transition-colors cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <h4 className={`text-xs font-bold leading-tight ${isCompleted ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                            {task.title}
                          </h4>
                          {task.notes && (
                            <p className="text-[10px] text-zinc-500 leading-normal">{task.notes}</p>
                          )}
                          {task.due && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
                              <Clock className="w-3 h-3" />
                              Due {new Date(task.due).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTaskClick(task.id, task.title)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 rounded-lg transition-colors"
                        title="Delete Task"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL: AI Goal Breakdown & Sync */}
      {showAIModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-zinc-100 shadow-xl space-y-4 animate-scale-up relative">
            <button 
              onClick={() => setShowAIModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-orange-600 border border-orange-100 inline-block">AI Assistant</span>
              <h3 className="text-base font-bold text-zinc-900">Conquer Procrastination with AI breakdowns</h3>
              <p className="text-xs text-zinc-500">Input a giant target goal. TaskHero AI splits it into bite-sized actionable milestones and syncs them directly into your Google Tasks.</p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="What complex goal are you planning? (e.g., Draft Q2 Business Review)"
                value={aiGoalTitle}
                onChange={(e) => setAiGoalTitle(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500"
              />
              <textarea
                placeholder="Details or specific guidelines... (Optional)"
                value={aiGoalDesc}
                onChange={(e) => setAiGoalDesc(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500 h-20 resize-none"
              />
              <button
                onClick={handleAIBreakdown}
                disabled={isAIPlanning || !aiGoalTitle.trim()}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
              >
                {isAIPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isAIPlanning ? 'TaskHero Coach is thinking...' : 'Generate Actionable Milestones'}</span>
              </button>
            </div>

            {aiSubtasks.length > 0 && (
              <div className="space-y-3 border-t border-zinc-100 pt-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">AI Planned Milestones</span>
                  <button
                    onClick={handleSpeakBreakdown}
                    className="p-1.5 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                    title="Hear Milestones Speech (TTS)"
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-bounce text-orange-600' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {aiSubtasks.map((st, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                      <input
                        type="checkbox"
                        checked={st.selected}
                        onChange={() => {
                          const updated = [...aiSubtasks];
                          updated[idx].selected = !updated[idx].selected;
                          setAiSubtasks(updated);
                        }}
                        className="mt-0.5 w-4 h-4 text-orange-600 rounded border-zinc-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-zinc-800 leading-tight">{st.title}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">Suggested: complete within {st.dueDateOffset} days</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleImportAISubtasks}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1 shadow-lg shadow-orange-600/10"
                >
                  <PlusSquare className="w-4 h-4" />
                  <span>Bulk Import Selected into Google Tasks</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Calendar Event */}
      {showEventModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateEvent} className="bg-white rounded-2xl max-w-md w-full p-6 border border-zinc-100 shadow-xl space-y-4 animate-scale-up relative">
            <button 
              type="button"
              onClick={() => setShowEventModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-zinc-900">Add Google Calendar Event</h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Event Title"
                value={eventSummary}
                onChange={(e) => setEventSummary(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                required
              />
              <input
                type="text"
                placeholder="Description"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Location"
                value={eventLoc}
                onChange={(e) => setEventLoc(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-md"
              >
                Create Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Add Google Task */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTask} className="bg-white rounded-2xl max-w-md w-full p-6 border border-zinc-100 shadow-xl space-y-4 animate-scale-up relative">
            <button 
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-zinc-900">Add Task to Current List</h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task Title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                required
              />
              <textarea
                placeholder="Notes or description of the task..."
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none h-20 resize-none"
              />
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-md"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
