export type NpsCategory = 'promoter' | 'passive' | 'detractor';

export function categorizeNps(score: number): NpsCategory {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
}

export function categoryLabel(cat: NpsCategory): string {
    const labels: Record<NpsCategory, string> = {
        promoter: 'Ambassadör',
        passive: 'Passiv',
        detractor: 'Kritiker',
    };
    return labels[cat];
}

export function categoryColor(cat: NpsCategory): string {
    const colors: Record<NpsCategory, string> = {
        promoter: 'text-emerald-600',
        passive: 'text-amber-600',
        detractor: 'text-rose-600',
    };
    return colors[cat];
}

export type NpsResponse = {
    id: string;
    user_id: string;
    score: number;
    comment: string | null;
    created_at: string;
    full_name?: string | null;
    email?: string | null;
};

export type NpsSummary = {
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
    npsScore: number;
    recentComments: { score: number; comment: string; name: string; date: string }[];
};

export function computeNpsSummary(responses: NpsResponse[]): NpsSummary {
    if (responses.length === 0) {
        return { total: 0, promoters: 0, passives: 0, detractors: 0, npsScore: 0, recentComments: [] };
    }

    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    for (const r of responses) {
        const cat = categorizeNps(r.score);
        if (cat === 'promoter') promoters++;
        else if (cat === 'passive') passives++;
        else detractors++;
    }

    const npsScore = Math.round(((promoters - detractors) / responses.length) * 100);

    const recentComments = responses
        .filter((r) => r.comment && r.comment.trim().length > 0)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map((r) => ({
            score: r.score,
            comment: r.comment!,
            name: r.full_name || r.email || 'Anonym',
            date: r.created_at,
        }));

    return { total: responses.length, promoters, passives, detractors, npsScore, recentComments };
}
