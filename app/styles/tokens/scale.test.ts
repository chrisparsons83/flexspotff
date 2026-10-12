import {
  GRID_UNIT,
  TYPE_BASE,
  TYPE_RATIO,
  TYPE_STEPS,
  typeScale,
} from './scale';
import { describe, expect, it } from 'vitest';

describe('type scale', () => {
  const steps = TYPE_STEPS.map(name => typeScale[name]);

  it('has six sizes, with body text at the base size', () => {
    expect(steps).toHaveLength(6);
    expect(typeScale.base.size).toBe(TYPE_BASE);
  });

  it('multiplies each step by the ratio', () => {
    steps.slice(1).forEach((step, i) => {
      expect(step.size / steps[i].size).toBeCloseTo(TYPE_RATIO, 2);
    });
  });

  it('puts every line height on the grid, and never tighter than the text', () => {
    for (const { size, lineHeight } of steps) {
      expect(lineHeight % GRID_UNIT).toBe(0);
      expect(lineHeight).toBeGreaterThanOrEqual(size * 1.2);
    }
  });
});
