import { WorkspaceCalendarEvent, WorkspaceTask, WorkspaceTaskList } from '../types';

/**
 * Fetch calendar events from primary calendar
 */
export async function listCalendarEvents(accessToken: string): Promise<WorkspaceCalendarEvent[]> {
  const timeMin = new Date().toISOString();
  // Fetch next 30 events
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(timeMin)}&maxResults=30`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Calendar events: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Create a new event on the primary calendar
 */
export async function createCalendarEvent(
  accessToken: string,
  event: Omit<WorkspaceCalendarEvent, 'id'>
): Promise<WorkspaceCalendarEvent> {
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Google Calendar event: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete an event from primary calendar
 */
export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete Google Calendar event: ${response.statusText}`);
  }
}

/**
 * List Google Task Lists
 */
export async function listTaskLists(accessToken: string): Promise<WorkspaceTaskList[]> {
  const url = 'https://tasks.googleapis.com/tasks/v1/users/@me/lists';
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Task Lists: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * List tasks inside a task list
 */
export async function listTasks(accessToken: string, taskListId: string): Promise<WorkspaceTask[]> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&showHidden=true`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Tasks: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Create a task inside a task list
 */
export async function createWorkspaceTask(
  accessToken: string,
  taskListId: string,
  task: { title: string; notes?: string; due?: string }
): Promise<WorkspaceTask> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Google Task: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Toggle task completion status
 */
export async function updateWorkspaceTaskStatus(
  accessToken: string,
  taskListId: string,
  taskId: string,
  completed: boolean
): Promise<WorkspaceTask> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`;
  const status = completed ? 'completed' : 'needsAction';
  
  // Tasks API is picky about status and requires PATCH. Completed tasks might need completed timestamp, but status = completed is enough.
  const body: any = { status };
  if (completed) {
    body.completed = new Date().toISOString();
  } else {
    // To uncomplete a task, we must delete the completed property or set it to null.
    body.completed = null;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to update Google Task status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a task
 */
export async function deleteWorkspaceTask(
  accessToken: string,
  taskListId: string,
  taskId: string
): Promise<void> {
  const url = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete Google Task: ${response.statusText}`);
  }
}
