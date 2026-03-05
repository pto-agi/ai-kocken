export type ManagerAutomationStep = {
  id: string;
  label: string;
};

export type ManagerAutomationFlow = {
  name: string;
  description: string;
  entryPoints: string[];
  steps: string[];
};

export type ManagerAutomation = {
  id: string;
  title: string;
  summary: string;
  project: string;
  owner: string;
  frequency: string;
  steps: ManagerAutomationStep[];
  flows: ManagerAutomationFlow[];
  notes: string[];
};

export type AutomationTask = {
  id: string;
  label: string;
  progress: number;
};

export type AutomationTaskState = Record<string, AutomationTask[]>;

export const AUTOMATION_PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

export const MANAGER_AUTOMATIONS: ManagerAutomation[] = [
  {
    id: 'renewal-pipeline',
    title: 'Förnyelsepipeline',
    summary: 'Identifierar klienter som närmar sig utgångsdatum och driver förlängning.',
    project: 'Retention / Renewal',
    owner: 'Manager',
    frequency: 'Dagligen',
    steps: [
      {
        id: 'fetch-expiry',
        label: 'Hämta aktiva klienter med utgångsdatum.'
      },
      {
        id: 'segment-risk',
        label: 'Segmentera i kritisk, varning och kommande.'
      },
      {
        id: 'trigger-outreach',
        label: 'Skicka/återkoppla med förlängningslänk.'
      }
    ],
    flows: [
      {
        name: 'Pipeline-flöde',
        description: 'Datainsamling -> segmentering -> åtgärd',
        entryPoints: ['/manager'],
        steps: ['Läs profiler', 'Räkna dagar kvar', 'Visa prioriterad lista', 'Skicka länk']
      }
    ],
    notes: [
      'Visas i kortet Förnyelsepipeline i Manager.',
      'Utgår från `coaching_expires_at` och `subscription_status`.'
    ]
  },
  {
    id: 'nps-insights',
    title: 'NPS-insikter',
    summary: 'Samlar NPS-svar, kategoriserar sentiment och lyfter senaste kommentarer.',
    project: 'Kundupplevelse',
    owner: 'Manager',
    frequency: 'Löpande',
    steps: [
      {
        id: 'collect-nps',
        label: 'Hämta senaste NPS-svar.'
      },
      {
        id: 'categorize-nps',
        label: 'Klassificera till ambassadör/passiv/kritiker.'
      },
      {
        id: 'surface-comments',
        label: 'Visa senaste kommentarer för kvalitativ uppföljning.'
      }
    ],
    flows: [
      {
        name: 'NPS-flöde',
        description: 'Insamling -> summering -> uppföljning',
        entryPoints: ['/nps', '/manager'],
        steps: ['Klient skickar svar', 'Manager summerar score', 'Kommentarer prioriteras']
      }
    ],
    notes: [
      'Ger både kvantitativt mått (NPS) och kvalitativa kommentarer.',
      'Bra underlag för förbättringar i onboarding och leverans.'
    ]
  },
  {
    id: 'referral-tracking',
    title: 'Referral-spårning',
    summary: 'Övervakar inkomna referrals och status från registrering till belöning.',
    project: 'Tillväxt / Referral',
    owner: 'Manager',
    frequency: 'Dagligen',
    steps: [
      {
        id: 'ingest-referrals',
        label: 'Läs in senaste referrals.'
      },
      {
        id: 'map-status',
        label: 'Mappa status till registrerad/köpt/belönad.'
      },
      {
        id: 'rank-referrers',
        label: 'Identifiera topptipsare.'
      }
    ],
    flows: [
      {
        name: 'Referral-flöde',
        description: 'Tips -> registrering -> konvertering -> belöning',
        entryPoints: ['/referral', '/manager'],
        steps: ['Klient delar länk', 'Lead registreras', 'Lead köper', 'Belöning tilldelas']
      }
    ],
    notes: [
      'Används för att prioritera snabb uppföljning på varma leads.',
      'Topplistan ger signal om vilka kunder som driver organisk tillväxt.'
    ]
  }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeAutomationProgress(progress: number): number {
  const rounded = Math.round(clamp(progress, 0, 100) / 25) * 25;
  return AUTOMATION_PROGRESS_STEPS.includes(rounded as 0 | 25 | 50 | 75 | 100)
    ? rounded
    : 0;
}

export function createAutomationTaskState(automations: ManagerAutomation[]): AutomationTaskState {
  return automations.reduce<AutomationTaskState>((acc, automation) => {
    acc[automation.id] = automation.steps.map((step) => ({
      id: step.id,
      label: step.label,
      progress: 0
    }));
    return acc;
  }, {});
}

export function setAutomationTaskProgress(
  state: AutomationTaskState,
  automationId: string,
  taskId: string,
  progress: number
): AutomationTaskState {
  if (!state[automationId]) {
    return state;
  }

  const nextProgress = normalizeAutomationProgress(progress);

  return {
    ...state,
    [automationId]: state[automationId].map((task) => (
      task.id === taskId
        ? { ...task, progress: nextProgress }
        : task
    ))
  };
}

export function addAutomationTask(
  state: AutomationTaskState,
  automationId: string,
  label: string,
  initialProgress = 0
): AutomationTaskState {
  const trimmed = label.trim();
  if (!trimmed || !state[automationId]) return state;

  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextTask: AutomationTask = {
    id,
    label: trimmed,
    progress: normalizeAutomationProgress(initialProgress)
  };

  return {
    ...state,
    [automationId]: [...state[automationId], nextTask]
  };
}

export function getAutomationProgress(
  automation: ManagerAutomation,
  taskState: AutomationTaskState
): { avgPercent: number; completedTasks: number; totalTasks: number } {
  const tasks = taskState[automation.id]
    || automation.steps.map((step) => ({ id: step.id, label: step.label, progress: 0 }));

  const totalTasks = tasks.length;
  if (totalTasks === 0) {
    return {
      avgPercent: 0,
      completedTasks: 0,
      totalTasks: 0
    };
  }

  const totalPercent = tasks.reduce((sum, task) => sum + normalizeAutomationProgress(task.progress), 0);
  const completedTasks = tasks.reduce((sum, task) => sum + (task.progress === 100 ? 1 : 0), 0);

  return {
    avgPercent: Math.round(totalPercent / totalTasks),
    completedTasks,
    totalTasks
  };
}
