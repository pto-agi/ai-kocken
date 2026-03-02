export type ProgressPoint = {
    date: string;
    label: string;
    kind: 'start' | 'uppfoljning';
    goal?: string | null;
    feedback?: string | null;
};

export type ProgressTimeline = {
    points: ProgressPoint[];
    totalMonths: number;
    milestones: string[];
};

type SubmissionInput = {
    created_at: string;
    kind: 'start' | 'uppfoljning';
    goal_description?: string | null;
    goal?: string | null;
    summary_feedback?: string | null;
};

function monthsBetween(a: Date, b: Date): number {
    const years = b.getFullYear() - a.getFullYear();
    const months = b.getMonth() - a.getMonth();
    return years * 12 + months;
}

export function buildProgressTimeline(submissions: SubmissionInput[]): ProgressTimeline {
    if (submissions.length === 0) {
        return { points: [], totalMonths: 0, milestones: [] };
    }

    const sorted = [...submissions].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const points: ProgressPoint[] = sorted.map((s, i) => ({
        date: s.created_at,
        label: s.kind === 'start' ? 'Startformulär' : `Uppföljning ${i}`,
        kind: s.kind,
        goal: s.kind === 'start' ? s.goal_description : s.goal,
        feedback: s.summary_feedback ?? null,
    }));

    const first = new Date(sorted[0].created_at);
    const last = new Date(sorted[sorted.length - 1].created_at);
    const totalMonths = monthsBetween(first, last);

    const milestones: string[] = [];
    const THRESHOLDS = [
        { months: 3, label: '3 månader' },
        { months: 6, label: '6 månader' },
        { months: 12, label: '1 år' },
        { months: 24, label: '2 år' },
    ];

    for (const { months, label } of THRESHOLDS) {
        if (totalMonths >= months) {
            milestones.push(label);
        }
    }

    return { points, totalMonths, milestones };
}
