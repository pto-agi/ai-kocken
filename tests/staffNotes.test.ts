import { describe, expect, it } from 'vitest';
import { extractTags, formatNoteText, filterNotesByTag, type StaffNote } from '../utils/staffNotes';

describe('extractTags', () => {
    it('extracts hashtags from text', () => {
        expect(extractTags('Klienten har #kost problem och #skada i knät')).toEqual(['kost', 'skada']);
    });

    it('returns empty for no tags', () => {
        expect(extractTags('Ingen tagg här')).toEqual([]);
    });

    it('deduplicates tags', () => {
        expect(extractTags('#kost och #kost igen')).toEqual(['kost']);
    });

    it('lowercases tags', () => {
        expect(extractTags('#Träning i #TRÄNING')).toEqual(['träning']);
    });
});

describe('formatNoteText', () => {
    it('wraps tags in mark elements', () => {
        const result = formatNoteText('Se #kost');
        expect(result).toContain('<mark');
        expect(result).toContain('#kost');
    });
});

describe('filterNotesByTag', () => {
    const notes: StaffNote[] = [
        { id: '1', client_id: 'c1', staff_id: 's1', text: '#kost', tags: ['kost'], created_at: '', staff_name: 'A' },
        { id: '2', client_id: 'c1', staff_id: 's1', text: '#träning', tags: ['träning'], created_at: '', staff_name: 'A' },
    ];

    it('filters by tag', () => {
        expect(filterNotesByTag(notes, 'kost')).toHaveLength(1);
        expect(filterNotesByTag(notes, 'kost')[0].id).toBe('1');
    });

    it('returns empty for unknown tag', () => {
        expect(filterNotesByTag(notes, 'okänd')).toHaveLength(0);
    });
});
