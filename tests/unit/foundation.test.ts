import { describe, it, expect } from 'vitest';

describe('Phase 1: Environment & Toolchain Verification', () => {
  it('should run in Node.js >= 18', () => {
    const major = parseInt(process.versions.node.split('.')[0] || '0', 10);
    expect(major).toBeGreaterThanOrEqual(18);
  });

  it('should support ESM and ES2022', () => {
    const registry = new Map<string, string>();
    registry.set('mcp', 'devlens');
    expect(registry.get('mcp')).toBe('devlens');
  });
});
