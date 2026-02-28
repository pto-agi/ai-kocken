type ManagerNoteLite = {
  id: string;
  user_id: string;
  report_date: string;
  note: string;
  created_at?: string;
};

export const groupNotesByUserDate = (notes: ManagerNoteLite[]) => {
  const grouped: Record<string, Record<string, ManagerNoteLite[]>> = {};
  notes.forEach((note) => {
    if (!grouped[note.user_id]) grouped[note.user_id] = {};
    if (!grouped[note.user_id][note.report_date]) grouped[note.user_id][note.report_date] = [];
    grouped[note.user_id][note.report_date].push(note);
  });
  return grouped;
};
