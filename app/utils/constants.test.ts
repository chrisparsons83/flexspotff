import { rankBadgeColor } from './constants';
import { describe, expect, it } from 'vitest';

describe('rankBadgeColor', () => {
  it('gives the podium its medals', () => {
    expect(rankBadgeColor(1)).toBe('bg-gold text-gray-900');
    expect(rankBadgeColor(2)).toBe('bg-silver text-gray-900');
    expect(rankBadgeColor(3)).toBe('bg-bronze text-gray-900');
  });

  it('gives everyone else the same colour', () => {
    expect(rankBadgeColor(4)).toBe('bg-galaxy text-gray-900');
    expect(rankBadgeColor(12)).toBe('bg-galaxy text-gray-900');
    expect(rankBadgeColor(40)).toBe('bg-galaxy text-gray-900');
  });
});
