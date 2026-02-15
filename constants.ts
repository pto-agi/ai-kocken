import { ActivityLevel, Goal, Gender } from './types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  [ActivityLevel.SEDENTARY]: 'Stillasittande (liten/ingen träning)',
  [ActivityLevel.LIGHTLY_ACTIVE]: 'Lätt aktiv (träning 1-3 dagar/v)',
  [ActivityLevel.MODERATELY_ACTIVE]: 'Måttligt aktiv (träning 3-5 dagar/v)',
  [ActivityLevel.VERY_ACTIVE]: 'Mycket aktiv (hård träning 6-7 dagar/v)',
  [ActivityLevel.EXTRA_ACTIVE]: 'Extremt aktiv (fysiskt jobb/2x pass)',
};

export const GOAL_LABELS: Record<Goal, string> = {
  [Goal.LOSE_WEIGHT]: 'Gå ner i vikt (-500 kcal)',
  [Goal.MAINTAIN]: 'Behålla vikten',
  [Goal.GAIN_MUSCLE]: 'Bygga muskler (+300 kcal)',
};

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Man',
  [Gender.FEMALE]: 'Kvinna',
};