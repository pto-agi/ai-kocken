type TemplateLite = { id: string };

type SummarizeWeekInput = {
  dateKeys: string[];
  templatesByDay: Record<string, TemplateLite[]>;
  completionsByUser: Record<string, Record<string, string[]>>;
};

type UserSummary = { completed: number; total: number };

type WeekSummary = {
  byUser: Record<string, UserSummary>;
  totalCompleted: number;
  totalTasks: number;
};

export const formatDateKey = (date: Date) => date.toLocaleDateString('sv-SE');

export const getWorkweekDateKeys = (date: Date) => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDateKey(d);
  });
};

export const summarizeWeek = (input: SummarizeWeekInput): WeekSummary => {
  const byUser: Record<string, UserSummary> = {};
  let totalCompleted = 0;
  let totalTasks = 0;

  input.dateKeys.forEach((dateKey) => {
    const dayTemplates = input.templatesByDay[dateKey] || [];
    totalTasks += dayTemplates.length;

    Object.entries(input.completionsByUser).forEach(([userId, perDay]) => {
      const completedIds = new Set(perDay[dateKey] || []);
      const completed = dayTemplates.filter((t) => completedIds.has(t.id)).length;

      if (!byUser[userId]) {
        byUser[userId] = { completed: 0, total: 0 };
      }

      byUser[userId].completed += completed;
      byUser[userId].total += dayTemplates.length;
      totalCompleted += completed;
    });
  });

  return { byUser, totalCompleted, totalTasks };
};
