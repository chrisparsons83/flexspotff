import { renderTokensCss } from './css';
import {
  GRID_UNIT,
  STEP_DOWN_EM,
  TYPE_BASE,
  TYPE_RATIO,
  TYPE_STEPS,
  typeScale,
} from './scale';
import { describe, expect, it } from 'vitest';

describe('type scale', () => {
  const steps = TYPE_STEPS.map(name => typeScale[name]);

  it('has seven sizes, with body text at the base size', () => {
    expect(steps).toHaveLength(7);
    expect(typeScale.base.size).toBe(TYPE_BASE);
  });

  it('multiplies each step by the ratio', () => {
    steps.slice(1).forEach((step, i) => {
      expect(step.size / steps[i].size).toBeCloseTo(TYPE_RATIO, 2);
    });
  });

  it('lands each line on the grid, with leading between 1.2 and 1.6', () => {
    for (const { size, leading } of steps) {
      const lineHeight = size * leading;
      expect(
        Math.abs(lineHeight - Math.round(lineHeight / GRID_UNIT) * GRID_UNIT),
      ).toBeLessThan(0.01);
      expect(leading).toBeGreaterThanOrEqual(1.2);
      expect(leading).toBeLessThanOrEqual(1.6);
    }
  });

  it('steps code and small text down by exactly one step', () => {
    expect(typeScale.base.size * parseFloat(STEP_DOWN_EM)).toBeCloseTo(
      typeScale.sm.size,
      1,
    );
  });

  it('writes every step to tokens.css', () => {
    const tokensCss = renderTokensCss();
    for (const name of TYPE_STEPS) {
      expect(tokensCss).toContain(`--text-${name}: `);
      expect(tokensCss).toContain(
        `--leading-${name}: ${typeScale[name].leading};`,
      );
    }
  });
});
