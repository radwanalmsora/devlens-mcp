import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PathSanitizer, SecurityError } from '../../src/security/path-sanitizer.js';
import { SafeFileScanner } from '../../src/security/scanner.js';

describe('Phase 2: Security & Path Traversal Guards', () => {
  let tempDir: string;
  let sanitizer: PathSanitizer;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devlens-sec-test-'));
    sanitizer = new PathSanitizer(tempDir);

    // Create fake files
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.mkdirSync(path.join(tempDir, 'node_modules'));
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(tempDir, '.env'), 'SECRET_KEY=12345');
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep.js'), 'module.exports = {};');
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should allow valid relative and absolute paths within project root', () => {
    const valid = sanitizer.resolveSafePath('src/index.ts');
    expect(valid).toBe(path.join(tempDir, 'src', 'index.ts'));
  });

  it('should strictly reject path traversal attempts with ../', () => {
    expect(() => {
      sanitizer.resolveSafePath('../outside.ts');
    }).toThrow(SecurityError);

    expect(() => {
      sanitizer.resolveSafePath('src/../../etc/passwd');
    }).toThrow(SecurityError);
  });

  it('should reject null-byte injection', () => {
    expect(() => {
      sanitizer.resolveSafePath('src/index.ts\0.exe');
    }).toThrow(SecurityError);
  });

  it('should automatically exclude sensitive files (.env) and node_modules in scanner', () => {
    const scanner = new SafeFileScanner(sanitizer);
    const files = scanner.scanSourceFiles();
    const filenames = files.map((f) => path.basename(f));

    expect(filenames).toContain('index.ts');
    expect(filenames).not.toContain('.env');
    expect(filenames).not.toContain('dep.js');
  });
});
