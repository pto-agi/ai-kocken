export const buildAgendaCustomTaskRange = (input: {
  selectedDateKey: string;
  workweekDateKeys: string[];
}) => {
  const keys = [input.selectedDateKey, ...input.workweekDateKeys].filter(Boolean);
  const sorted = [...keys].sort();
  return {
    startKey: sorted[0],
    endKey: sorted[sorted.length - 1]
  };
};
