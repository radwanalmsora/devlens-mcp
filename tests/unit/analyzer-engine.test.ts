import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AnalyzerEngine } from '../../src/core/analyzer-engine.js';

describe('Phase 4: Analyzer Engine & 8 MCP Tools', () => {
  let tempDir: string;
  let engine: AnalyzerEngine;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devlens-engine-test-'));
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'demo', dependencies: { express: '^4.18.0', react: '^18.0.0' } }));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'src', 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\nexport function unusedHelper(): void {}');
    fs.writeFileSync(path.join(tempDir, 'src', 'service.ts'), 'import { add } from "./math.js";\nexport class CalculatorService { compute(): number { return add(2, 3); } }');
    engine = new AnalyzerEngine(tempDir);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('Tool 1: analyze_project detects frameworks', () => {
    const meta = engine.analyzeProject();
    expect(meta.totalFiles).toBe(2);
    expect(meta.frameworks).toContain('Express');
    expect(meta.frameworks).toContain('React');
  });

  it('Tool 2: find_symbol locates declarations', () => {
    expect(engine.findSymbol('add', true).length).toBe(1);
    expect(engine.findSymbol('CalculatorService', true).length).toBe(1);
  });

  it('Tool 3: trace_dependencies traces file graph', () => {
    const trace = engine.traceDependencies(path.join(tempDir, 'src', 'math.ts'));
    expect(trace.incoming).toContain(path.join(tempDir, 'src', 'service.ts'));
  });

  it('Tool 4: analyze_impact calculates blast radius', () => {
    const impact = engine.analyzeImpact(path.join(tempDir, 'src', 'math.ts'));
    expect(impact.directDependents).toContain(path.join(tempDir, 'src', 'service.ts'));
  });

  it('Tool 5: detect_dead_code finds unreferenced exports', () => {
    const dead = engine.detectDeadCode();
    expect(dead.potentiallyUnusedExports.some((u) => u.exportName === 'unusedHelper')).toBe(true);
  });

  it('Tool 6: assess_change_risk computes risk signals', () => {
    const risk = engine.assessChangeRisk(path.join(tempDir, 'src', 'math.ts'));
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(risk.riskLevel);
  });

  it('Tool 7: get_project_context returns compact overview', () => {
    const ctx = engine.getProjectContext();
    expect(ctx.projectSummary.totalFiles).toBe(2);
  });

  it('Tool 8: get_project_diagnostics detects diagnostics', () => {
    const diag = engine.getProjectDiagnostics();
    expect(diag.unresolvedImports).toBeDefined();
  });
});
