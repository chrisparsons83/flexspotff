import { requireDesignMocks } from './design.server';
import { afterEach, describe, expect, it } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

const setNodeEnv = (value: typeof process.env.NODE_ENV) => {
  process.env.NODE_ENV = value;
};

describe('requireDesignMocks', () => {
  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  it('hides the mocks outside development', () => {
    setNodeEnv('production');
    expect(requireDesignMocks).toThrow(Response);
  });

  it('shows them in development', () => {
    setNodeEnv('development');
    expect(requireDesignMocks()).toBeNull();
  });
});
