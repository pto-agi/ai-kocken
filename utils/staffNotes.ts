export type StaffNote = {
    id: string;
    client_id: string;
    staff_id: string;
    text: string;
    tags: string[];
    created_at: string;
    staff_name?: string | null;
};

const TAG_PATTERN = /#([a-zA-ZåäöÅÄÖ0-9_]+)/g;

export function extractTags(text: string): string[] {
    const matches = text.matchAll(TAG_PATTERN);
    const tags = new Set<string>();
    for (const match of matches) {
        tags.add(match[1].toLowerCase());
    }
    return [...tags];
}

export function formatNoteText(text: string): string {
    return text.replace(TAG_PATTERN, '<mark class="bg-amber-100 text-amber-800 px-1 rounded font-bold">#$1</mark>');
}

export function filterNotesByTag(notes: StaffNote[], tag: string): StaffNote[] {
    const normalized = tag.toLowerCase();
    return notes.filter((n) => n.tags.includes(normalized));
}

export const SUGGESTED_TAGS = ['kost', 'träning', 'ärende', 'säljlead', 'skada', 'viktig'] as const;
