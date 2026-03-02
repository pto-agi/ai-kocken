export type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    href: string;
};

export type OnboardingState = {
    steps: OnboardingStep[];
    completedCount: number;
    totalCount: number;
    allDone: boolean;
};

type OnboardingInput = {
    hasAccount: boolean;
    hasStartForm: boolean;
    hasWeeklyPlan: boolean;
    hasVisitedChat: boolean;
};

export function computeOnboardingState(input: OnboardingInput): OnboardingState {
    const steps: OnboardingStep[] = [
        {
            id: 'account',
            title: 'Skapa konto',
            description: 'Ditt konto är redo.',
            completed: input.hasAccount,
            href: '/profile',
        },
        {
            id: 'startform',
            title: 'Fyll i startformulär',
            description: 'Berätta om dina mål och förutsättningar.',
            completed: input.hasStartForm,
            href: '/startformular',
        },
        {
            id: 'weeklyplan',
            title: 'Skapa din första veckomeny',
            description: 'Generera ett kostschema med AI.',
            completed: input.hasWeeklyPlan,
            href: '/recept',
        },
        {
            id: 'chat',
            title: 'Utforska chatten',
            description: 'Ställ en fråga till din AI-coach.',
            completed: input.hasVisitedChat,
            href: '/support',
        },
    ];

    const completedCount = steps.filter((s) => s.completed).length;

    return {
        steps,
        completedCount,
        totalCount: steps.length,
        allDone: completedCount === steps.length,
    };
}
