type TaskNoteLite = {
  task_id: string | null;
  note: string | null;
  created_at: string | null;
};

export const buildLatestTaskNoteMap = (notes: TaskNoteLite[]): Record<string, string> => {
  const sorted = [...notes].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  return sorted.reduce<Record<string, string>>((map, note) => {
    const taskId = note.task_id?.trim();
    const text = note.note?.trim();
    if (!taskId || !text) return map;
    if (map[taskId]) return map;
    map[taskId] = text;
    return map;
  }, {});
};

