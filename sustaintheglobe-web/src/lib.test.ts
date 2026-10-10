import { describe, it, expect } from 'vitest';
import { backendModeFromEnv } from './lib';

describe('backend mode', () => {
  it('defaults to firebase when unset', () => {
    expect(backendModeFromEnv({})).toBe('firebase');
  });
  it('passes through aws mode', () => {
    expect(backendModeFromEnv({ VITE_BACKEND: 'aws' })).toBe('aws');
  });
});
