/**
 * LIV8 Command Center - Google Calendar Integration
 * Syncs calendar events and provides reminders
 */

import * as db from './database.js';

// Google Calendar API base URL
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Cached events
let cachedEvents = [];
let lastFetch = null;

/**
 * Initialize calendar service
 * Note: For full OAuth, you'll need to set up Google Cloud Console credentials
 * This implementation supports both API key (public calendars) and OAuth token
 */
export function initCalendarService(config = {}) {
  const email = config.email || process.env.GOOGLE_CALENDAR_EMAIL;
  console.log(`Calendar service initialized for: ${email || 'not configured'}`);
  return { email };
}

/**
 * Fetch calendar events using OAuth token
 * The token should be obtained through OAuth flow on the frontend
 */
export async function fetchCalendarEvents(accessToken, options = {}) {
  const {
    calendarId = 'primary',
    maxResults = 50,
    timeMin = new Date().toISOString(),
    timeMax = null
  } = options;

  try {
    let url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?`;
    url += `maxResults=${maxResults}`;
    url += `&timeMin=${encodeURIComponent(timeMin)}`;
    url += `&singleEvents=true`;
    url += `&orderBy=startTime`;

    if (timeMax) {
      url += `&timeMax=${encodeURIComponent(timeMax)}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch calendar');
    }

    const data = await response.json();
    cachedEvents = data.items || [];
    lastFetch = new Date();

    // Store events in database for offline access
    storeEventsInDb(cachedEvents);

    return cachedEvents;
  } catch (error) {
    console.error('Calendar fetch error:', error.message);
    // Return cached events if available
    return cachedEvents;
  }
}

/**
 * Store calendar events in database
 */
function storeEventsInDb(events) {
  try {
    const dbInstance = db.getDb();

    // Create calendar_events table if not exists
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        summary TEXT,
        description TEXT,
        location TEXT,
        start_time TEXT,
        end_time TEXT,
        all_day INTEGER DEFAULT 0,
        status TEXT,
        html_link TEXT,
        attendees TEXT,
        reminders TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const upsertStmt = dbInstance.prepare(`
      INSERT INTO calendar_events (id, summary, description, location, start_time, end_time, all_day, status, html_link, attendees, reminders)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        summary = excluded.summary,
        description = excluded.description,
        location = excluded.location,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        all_day = excluded.all_day,
        status = excluded.status,
        html_link = excluded.html_link,
        attendees = excluded.attendees,
        reminders = excluded.reminders,
        synced_at = CURRENT_TIMESTAMP
    `);

    for (const event of events) {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      const allDay = !event.start?.dateTime ? 1 : 0;

      upsertStmt.run(
        event.id,
        event.summary || '',
        event.description || '',
        event.location || '',
        startTime,
        endTime,
        allDay,
        event.status || 'confirmed',
        event.htmlLink || '',
        JSON.stringify(event.attendees || []),
        JSON.stringify(event.reminders || {})
      );
    }

    console.log(`Stored ${events.length} calendar events`);
  } catch (e) {
    console.error('Failed to store calendar events:', e.message);
  }
}

/**
 * Get cached/stored calendar events
 */
export function getCachedEvents(options = {}) {
  const { upcoming = true, limit = 20 } = options;

  try {
    const dbInstance = db.getDb();

    let query = 'SELECT * FROM calendar_events';
    if (upcoming) {
      query += ` WHERE start_time >= datetime('now')`;
    }
    query += ' ORDER BY start_time ASC';
    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const stmt = dbInstance.prepare(query);
    const events = stmt.all();

    return events.map(e => ({
      ...e,
      attendees: JSON.parse(e.attendees || '[]'),
      reminders: JSON.parse(e.reminders || '{}')
    }));
  } catch (e) {
    return cachedEvents;
  }
}

/**
 * Get today's events
 */
export function getTodaysEvents() {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare(`
      SELECT * FROM calendar_events
      WHERE date(start_time) = date('now')
      ORDER BY start_time ASC
    `);
    return stmt.all();
  } catch (e) {
    const today = new Date().toDateString();
    return cachedEvents.filter(e => {
      const eventDate = new Date(e.start?.dateTime || e.start?.date).toDateString();
      return eventDate === today;
    });
  }
}

/**
 * Get upcoming events (next N hours)
 */
export function getUpcomingEvents(hours = 24) {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare(`
      SELECT * FROM calendar_events
      WHERE start_time >= datetime('now')
        AND start_time <= datetime('now', '+${hours} hours')
      ORDER BY start_time ASC
    `);
    return stmt.all();
  } catch (e) {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return cachedEvents.filter(e => {
      const eventDate = new Date(e.start?.dateTime || e.start?.date);
      return eventDate >= now && eventDate <= future;
    });
  }
}

/**
 * Get events needing reminders (within next 15 minutes)
 */
export function getEventsNeedingReminder(minutesBefore = 15) {
  try {
    const dbInstance = db.getDb();
    const stmt = dbInstance.prepare(`
      SELECT * FROM calendar_events
      WHERE start_time >= datetime('now')
        AND start_time <= datetime('now', '+${minutesBefore} minutes')
        AND status = 'confirmed'
      ORDER BY start_time ASC
    `);
    return stmt.all();
  } catch (e) {
    return [];
  }
}

/**
 * Format event for display
 */
export function formatEventForDisplay(event) {
  const start = new Date(event.start_time || event.start?.dateTime || event.start?.date);
  const isAllDay = event.all_day || !event.start?.dateTime;

  return {
    id: event.id,
    title: event.summary,
    description: event.description,
    location: event.location,
    start,
    time: isAllDay ? 'All Day' : start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }),
    date: start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }),
    isAllDay,
    attendees: event.attendees || [],
    link: event.html_link || event.htmlLink
  };
}

/**
 * Generate OAuth URL for calendar access
 */
export function getOAuthUrl(clientId, redirectUri) {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly'
  ];

  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&access_type=online`;
}

/**
 * Get free time blocks for today
 */
export function getFreeTimeBlocks() {
  const todayEvents = getTodaysEvents();
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0); // 6 PM

  if (now >= endOfDay) return [];

  const freeBlocks = [];
  let currentTime = now;

  const sortedEvents = todayEvents
    .filter(e => new Date(e.end_time || e.start_time) > now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  for (const event of sortedEvents) {
    const eventStart = new Date(event.start_time);

    if (eventStart > currentTime) {
      const durationMins = Math.floor((eventStart - currentTime) / (1000 * 60));
      if (durationMins >= 15) {
        freeBlocks.push({
          start: currentTime.toISOString(),
          end: eventStart.toISOString(),
          durationMinutes: durationMins
        });
      }
    }

    const eventEnd = new Date(event.end_time || event.start_time);
    if (eventEnd > currentTime) {
      currentTime = eventEnd;
    }
  }

  if (currentTime < endOfDay) {
    const durationMins = Math.floor((endOfDay - currentTime) / (1000 * 60));
    if (durationMins >= 15) {
      freeBlocks.push({
        start: currentTime.toISOString(),
        end: endOfDay.toISOString(),
        durationMinutes: durationMins
      });
    }
  }

  return freeBlocks;
}

/**
 * Get next meeting
 */
export function getNextMeeting() {
  const upcoming = getUpcomingEvents(8);
  return upcoming[0] || null;
}

/**
 * Check if user is in a meeting now
 */
export function isInMeeting() {
  const now = new Date();
  const todayEvents = getTodaysEvents();

  return todayEvents.some(event => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time || event.start_time);
    return now >= start && now <= end;
  });
}

/**
 * Get calendar summary for briefing
 */
export function getCalendarSummary() {
  const todayEvents = getTodaysEvents();
  const freeBlocks = getFreeTimeBlocks();
  const nextMeeting = getNextMeeting();
  const inMeeting = isInMeeting();

  const totalFreeMinutes = freeBlocks.reduce((sum, block) => sum + block.durationMinutes, 0);

  return {
    todayEventCount: todayEvents.length,
    todayEvents: todayEvents.slice(0, 5).map(formatEventForDisplay),
    freeTimeMinutes: totalFreeMinutes,
    freeBlocks: freeBlocks.slice(0, 3),
    nextMeeting: nextMeeting ? formatEventForDisplay(nextMeeting) : null,
    isInMeeting: inMeeting,
    suggestedFocusTime: freeBlocks.find(b => b.durationMinutes >= 60) || null
  };
}

export default {
  initCalendarService,
  fetchCalendarEvents,
  getCachedEvents,
  getTodaysEvents,
  getUpcomingEvents,
  getEventsNeedingReminder,
  formatEventForDisplay,
  getOAuthUrl,
  getFreeTimeBlocks,
  getNextMeeting,
  isInMeeting,
  getCalendarSummary
};
