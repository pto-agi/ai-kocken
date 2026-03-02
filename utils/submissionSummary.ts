import { createHash } from 'node:crypto';
import { z } from 'zod';

export const submissionSummarySchema = z.object({
  overview: z.string().min(1),
  client_profile: z.string().min(1),
  key_goals: z.array(z.string()),
  risks_or_flags: z.array(z.string()),
  coaching_actions: z.array(z.string()),
  followup_focus: z.array(z.string()),
  missing_info: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)])
    );
  }
  return value;
};

export const normalizeSubmissionPayload = (payload: unknown) => sortDeep(payload);

export const buildSubmissionSourceHash = (payload: unknown) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export const parseSubmissionSummaryJson = (input: unknown) => submissionSummarySchema.parse(input);
