import { describe, expect, it } from 'vitest';
import {
  buildStaffFaqInsertPayload,
  parseStaffFaqTagsInput,
  searchStaffFaqEntries,
  STAFF_FAQ_ENTRIES,
  toStaffFaqEntries
} from '../utils/staffFaq';

describe('searchStaffFaqEntries', () => {
  it('returns all entries when query is empty', () => {
    const result = searchStaffFaqEntries('', STAFF_FAQ_ENTRIES);
    expect(result.length).toBe(STAFF_FAQ_ENTRIES.length);
  });

  it('matches by title, answer and tags', () => {
    const swishResults = searchStaffFaqEntries('swish', STAFF_FAQ_ENTRIES);
    expect(swishResults.some((entry) => entry.id === 'payment-swish')).toBe(true);

    const linkResults = searchStaffFaqEntries('todoist', STAFF_FAQ_ENTRIES);
    expect(linkResults.some((entry) => entry.id === 'quicklinks-intranet')).toBe(true);
  });

  it('sorts exact title matches above fuzzy matches', () => {
    const results = searchStaffFaqEntries('swish', [
      {
        id: 'swish-exact',
        question: 'Swish',
        answer: 'Exact match',
        category: 'Betalning',
        tags: ['swish']
      },
      {
        id: 'swish-fuzzy',
        question: 'Hur hanterar vi betalning?',
        answer: 'Använd swish vid behov',
        category: 'Betalning',
        tags: ['betalning']
      }
    ]);

    expect(results[0]?.id).toBe('swish-exact');
  });
});

describe('parseStaffFaqTagsInput', () => {
  it('splits comma separated tags and removes empties/duplicates', () => {
    expect(parseStaffFaqTagsInput('swish, faq, swish, , betalning')).toEqual(['swish', 'faq', 'betalning']);
  });
});

describe('buildStaffFaqInsertPayload', () => {
  it('normalizes and validates faq insert payload', () => {
    const payload = buildStaffFaqInsertPayload({
      question: '  Hur gör vi X? ',
      answer: '  Så här gör du ',
      howTo: ' steg 1',
      tagsInput: 'tag1, tag2, tag1',
      category: 'Policy',
      linkLabel: ' Manual ',
      linkHref: ' /intranet '
    });

    expect(payload).toEqual({
      question: 'Hur gör vi X?',
      answer: 'Så här gör du',
      how_to: 'steg 1',
      tags: ['tag1', 'tag2'],
      category: 'Policy',
      link_label: 'Manual',
      link_href: '/intranet',
      show_on_intranet: false
    });
  });
});

describe('toStaffFaqEntries', () => {
  it('maps database rows to faq entries with optional link', () => {
    const entries = toStaffFaqEntries([
      {
        id: 'row-1',
        question: 'Q',
        answer: 'A',
        how_to: 'H',
        category: 'Snabblänkar',
        tags: ['t1'],
        link_label: 'Go',
        link_href: '/intranet'
      }
    ]);

    expect(entries).toEqual([
      {
        id: 'row-1',
        question: 'Q',
        answer: 'A',
        howTo: 'H',
        category: 'Snabblänkar',
        tags: ['t1'],
        links: [{ label: 'Go', href: '/intranet', external: false }],
        showOnIntranet: false
      }
    ]);
  });
});
