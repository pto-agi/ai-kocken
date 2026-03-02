type PromptInput = {
  language: 'sv' | 'en';
  submissionType: 'start' | 'uppfoljning';
  payload: unknown;
};

export const shouldReuseCachedSummary = (input: {
  cachedHash: string | null | undefined;
  incomingHash: string;
  forceRefresh?: boolean;
}) => Boolean(input.cachedHash && input.cachedHash === input.incomingHash && !input.forceRefresh);

export const buildSubmissionSummaryPrompts = ({ language, submissionType, payload }: PromptInput) => {
  const system = 'Du ar en senior coach-assistent. Returnera ENDAST JSON med falten: overview, client_profile, key_goals, risks_or_flags, coaching_actions, followup_focus, missing_info, confidence.';
  const user = JSON.stringify({ language, submissionType, payload }, null, 2);
  return { system, user };
};
