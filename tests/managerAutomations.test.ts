import { describe, expect, it } from 'vitest';
import {
  addAutomationTask,
  createAutomationTaskState,
  getAutomationProgress,
  setAutomationTaskProgress,
  type ManagerAutomation
} from '../utils/managerAutomations';

const sampleAutomations: ManagerAutomation[] = [
  {
    id: 'renewals',
    title: 'Förnyelseflöde',
    summary: 'Fångar upp klienter med kommande utgångsdatum.',
    project: 'Renewal Pipeline',
    owner: 'Manager',
    frequency: 'Dagligen',
    steps: [
      { id: 'collect', label: 'Samla klienter med utgångsdatum inom 30 dagar.' },
      { id: 'segment', label: 'Segmentera kritisk, varning och kommande.' },
      { id: 'reachout', label: 'Skicka och följ upp förlängningslänkar.' }
    ],
    flows: [
      {
        name: 'Förnyelse',
        description: 'Datainsamling -> segmentering -> outreach',
        entryPoints: ['/manager'],
        steps: ['Samla data', 'Segmentera', 'Skicka länk']
      }
    ],
    notes: ['Syns i Manager > Förnyelsepipeline.']
  }
];

describe('manager automations task progress state', () => {
  it('creates default task state with 0% on all tasks', () => {
    const state = createAutomationTaskState(sampleAutomations);

    expect(state).toEqual({
      renewals: [
        { id: 'collect', label: 'Samla klienter med utgångsdatum inom 30 dagar.', progress: 0 },
        { id: 'segment', label: 'Segmentera kritisk, varning och kommande.', progress: 0 },
        { id: 'reachout', label: 'Skicka och följ upp förlängningslänkar.', progress: 0 }
      ]
    });
  });

  it('updates task progress in 25% increments without mutating previous state', () => {
    const original = createAutomationTaskState(sampleAutomations);

    const next = setAutomationTaskProgress(original, 'renewals', 'segment', 50);

    expect(next.renewals.find((task) => task.id === 'segment')?.progress).toBe(50);
    expect(next.renewals.find((task) => task.id === 'collect')?.progress).toBe(0);
    expect(original.renewals.find((task) => task.id === 'segment')?.progress).toBe(0);
  });

  it('normalizes progress to nearest valid 25-step', () => {
    const state = createAutomationTaskState(sampleAutomations);
    const next = setAutomationTaskProgress(state, 'renewals', 'collect', 61);

    expect(next.renewals.find((task) => task.id === 'collect')?.progress).toBe(50);
  });

  it('adds a new task with selected initial progress', () => {
    const state = createAutomationTaskState(sampleAutomations);
    const next = addAutomationTask(state, 'renewals', 'Kontakta riskkunder', 75);

    expect(next.renewals).toHaveLength(4);
    expect(next.renewals[3]).toMatchObject({
      label: 'Kontakta riskkunder',
      progress: 75
    });
  });

  it('computes automation progress in percent', () => {
    let state = createAutomationTaskState(sampleAutomations);
    state = setAutomationTaskProgress(state, 'renewals', 'collect', 100);
    state = setAutomationTaskProgress(state, 'renewals', 'segment', 50);
    state = setAutomationTaskProgress(state, 'renewals', 'reachout', 0);

    const progress = getAutomationProgress(sampleAutomations[0], state);

    expect(progress).toEqual({
      avgPercent: 50,
      completedTasks: 1,
      totalTasks: 3
    });
  });
});
