import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/server.js';
import { AnalyzerEngine } from '../../src/core/analyzer-engine.js';

describe('Phase 5: MCP Server Integration', () => {
  let tempDir: string;
  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devlens-integration-'));
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'mcp-demo' }));
    fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export const hello = () => "world";');
  });
  afterAll(() => { fs.rmSync(tempDir, { recursive: true, force: true }); });

  it('should create server and run engine tools', async () => {
    const server = createMcpServer(tempDir);
    expect(server).toBeDefined();
    const engine = new AnalyzerEngine(tempDir);
    expect(engine.findSymbol('hello', true).length).toBe(1);
  });
});
