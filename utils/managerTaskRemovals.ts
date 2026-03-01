export type ManagerTaskRemovalLite = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_removed: boolean;
};

const removalKey = (userId: string, reportDate: string, taskId: string) => `${userId}:${reportDate}:${taskId}`;

export const buildTaskRemovalSet = (rows: ManagerTaskRemovalLite[]) => {
  const removed = new Set<string>();
  rows.forEach((row) => {
    const key = removalKey(row.user_id, row.report_date, row.task_id);
    if (row.is_removed) removed.add(key);
    else removed.delete(key);
  });
  return removed;
};

export const isTaskRemoved = (removedSet: Set<string>, userId: string, reportDate: string, taskId: string) => (
  removedSet.has(removalKey(userId, reportDate, taskId))
);
