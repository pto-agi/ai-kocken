export const applyCompletedTaskToggle = (
  ids: string[],
  taskId: string,
  isCurrentlyCompleted: boolean
) => {
  const current = new Set(ids.filter(Boolean));
  if (isCurrentlyCompleted) {
    current.delete(taskId);
  } else {
    current.add(taskId);
  }
  return Array.from(current).sort((a, b) => a.localeCompare(b));
};
