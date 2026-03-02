type ManagerCustomTaskDraftInput = {
  title: string;
  estimated_minutes: string;
  details: string;
};

type ManagerCustomTaskDraftNormalized = {
  title: string;
  estimatedMinutes: number | null;
  details: string | null;
};

export const normalizeManagerCustomTaskDraft = (
  draft: ManagerCustomTaskDraftInput
): ManagerCustomTaskDraftNormalized => {
  const title = draft.title.trim();
  const details = draft.details.trim() || null;
  const estimatedRaw = draft.estimated_minutes.trim();
  const estimatedParsed = estimatedRaw ? Number(estimatedRaw) : null;
  const estimatedMinutes = Number.isFinite(estimatedParsed) && (estimatedParsed as number) > 0
    ? Math.round(estimatedParsed as number)
    : null;

  return {
    title,
    estimatedMinutes,
    details
  };
};

