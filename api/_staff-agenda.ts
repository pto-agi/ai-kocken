import { JWT } from 'google-auth-library';

const TIME_ZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Europe/Stockholm';

const formatDateKey = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const getWeekRange = (dateStr: string) => {
  const base = new Date(`${dateStr}T00:00:00Z`);
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diff);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 7);
  return { start: monday, end: sunday };
};

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowOrigin = process.env.CALENDAR_CORS_ORIGIN || origin || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    ?.replace(/^\"|\"$/g, '');

  if (privateKey && !privateKey.includes('BEGIN PRIVATE KEY')) {
    privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
  }

  if (!calendarId || !clientEmail || !privateKey) {
    res.status(500).json({ error: 'Missing Google Calendar credentials' });
    return;
  }

  const date = (req.query?.date as string) || new Date().toISOString().slice(0, 10);
  const { start, end } = getWeekRange(date);

  const jwt = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly']
  });

  try {
    const token = await jwt.authorize();
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      timeZone: TIME_ZONE
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ error: 'Calendar fetch failed', details: text });
      return;
    }

    const payload = await upstream.json();
    const days: Record<string, string[]> = {};

    (payload.items || []).forEach((event: any) => {
      if (event.status === 'cancelled') return;
      const summary = event.summary || 'Utan titel';
      let dateKey = '';
      if (event.start?.date) {
        dateKey = event.start.date;
      } else if (event.start?.dateTime) {
        dateKey = formatDateKey(new Date(event.start.dateTime), TIME_ZONE);
      }
      if (!dateKey) return;
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push(summary);
    });

    res.status(200).json({
      timeZone: TIME_ZONE,
      range: { start: start.toISOString(), end: end.toISOString() },
      days
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Calendar API error', details: error?.message || String(error) });
  }
}
