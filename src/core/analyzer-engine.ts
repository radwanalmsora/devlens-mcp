import fs from 'node:fs';
import path from 'node:path';
import { PathSanitizer } from '../security/path-sanitizer.js';
import { SafeFileScanner } from '../security/scanner.js';
import { TypeScriptParserAdapter } from '../analyzers/ts-parser.js';
import { DependencyGraph } from '../analyzers/dependency-graph.js';
import {
  CodeSymbol,
  FileAnalysis,
  ImpactAnalysisResult,
  ProjectMetadata,
  RiskAssessmentResult,
} from './types.js';

export class AnalyzerEngine {
  private sanitizer: PathSanitizer;
  private scanner: SafeFileScanner;
  private parser: TypeScriptParserAdapter;
  private fileAnalyses = new Map<string, FileAnalysis>();
  private dependencyGraph: DependencyGraph | null = null;
  private isIndexed = false;

  constructor(projectRoot: string) {
    this.sanitizer = new PathSanitizer(projectRoot);
    this.scanner = new SafeFileScanner(this.sanitizer);
    this.parser = new TypeScriptParserAdapter();
  }

  public indexProject(): void {
    const files = this.scanner.scanSourceFiles();
    this.fileAnalyses.clear();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const analysis = this.parser.parseFile(file, content);
        this.fileAnalyses.set(file, analysis);
      } catch {
        // Ignore unparseable files gracefully
      }
    }

    this.dependencyGraph = new DependencyGraph(Array.from(this.fileAnalyses.values()));
    this.isIndexed = true;
  }

  private ensureIndexed(): void {
    if (!this.isIndexed) this.indexProject();
  }

  public analyzeProject(): ProjectMetadata {
    this.ensureIndexed();
    const root = this.sanitizer.getProjectRoot();
    const frameworks = new Set<string>();
    const pkgPath = path.join(root, 'package.json');
    let packageManager: ProjectMetadata['packageManager'] = 'unknown';

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['react']) frameworks.add('React');
        if (allDeps['next']) frameworks.add('Next.js');
        if (allDeps['vue']) frameworks.add('Vue');
        if (allDeps['@angular/core']) frameworks.add('Angular');
        if (allDeps['svelte']) frameworks.add('Svelte');
        if (allDeps['express']) frameworks.add('Express');
        if (allDeps['fastify']) frameworks.add('Fastify');
        if (allDeps['@nestjs/core']) frameworks.add('NestJS');
        if (allDeps['tailwindcss'] || allDeps['@tailwindcss/vite']) frameworks.add('Tailwind CSS');
        if (allDeps['vite']) frameworks.add('Vite');
        if (allDeps['vitest']) frameworks.add('Vitest');
        if (allDeps['jest']) frameworks.add('Jest');
      } catch {}
    }

    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
    else if (fs.existsSync(path.join(root, 'yarn.lock'))) packageManager = 'yarn';
    else if (fs.existsSync(path.join(root, 'bun.lockb')) || fs.existsSync(path.join(root, 'bun.lock')))
      packageManager = 'bun';
    else if (fs.existsSync(path.join(root, 'package-lock.json'))) packageManager = 'npm';

    const languages: Record<string, number> = { typescript: 0, javascript: 0 };
    for (const fa of this.fileAnalyses.values()) {
      languages[fa.language] = (languages[fa.language] || 0) + 1;
    }

    return {
      projectRoot: root,
      totalFiles: this.fileAnalyses.size,
      languages,
      frameworks: Array.from(frameworks),
      packageManager,
      hasTsConfig: fs.existsSync(path.join(root, 'tsconfig.json')),
    };
  }

  public findSymbol(name: string, exactMatch = false): CodeSymbol[] {
    this.ensureIndexed();
    const results: CodeSymbol[] = [];
    const lower = name.toLowerCase();

    for (const fa of this.fileAnalyses.values()) {
      for (const sym of fa.symbols) {
        if (exactMatch ? sym.name === name : sym.name.toLowerCase().includes(lower)) {
          results.push(sym);
        }
      }
    }
    return results;
  }

  public traceDependencies(filePath: string) {
    this.ensureIndexed();
    const safe = this.sanitizer.resolveSafePath(filePath);
    return {
      filePath: safe,
      incoming: this.dependencyGraph?.getIncoming(safe) || [],
      outgoing: this.dependencyGraph?.getOutgoing(safe) || [],
      external: this.dependencyGraph?.getExternal(safe) || [],
    };
  }

  public analyzeImpact(filePath: string): ImpactAnalysisResult {
    this.ensureIndexed();
    const safe = this.sanitizer.resolveSafePath(filePath);
    const deep = this.dependencyGraph?.getDeepDependents(safe) || { direct: [], indirect: [] };
    return {
      target: safe,
      targetType: 'file',
      directDependents: deep.direct,
      indirectDependents: deep.indirect,
      totalAffectedFiles: deep.direct.length + deep.indirect.length,
      confidence: 'confirmed',
    };
  }

  public detectDeadCode() {
    this.ensureIndexed();
    const importedSymbolsSet = new Set<string>();
    for (const fa of this.fileAnalyses.values()) {
      for (const imp of fa.imports) {
        for (const s of imp.importedSymbols) importedSymbolsSet.add(s);
      }
    }

    const unused: Array<{ filePath: string; exportName: string; line: number }> = [];
    for (const fa of this.fileAnalyses.values()) {
      const base = path.basename(fa.filePath);
      if (base.includes('.test.') || base.includes('.spec.') || base === 'index.ts' || base === 'cli.ts') continue;

      for (const exp of fa.exports) {
        if (!importedSymbolsSet.has(exp)) {
          const sym = fa.symbols.find((s) => s.name === exp);
          unused.push({ filePath: fa.filePath, exportName: exp, line: sym?.startLine || 1 });
        }
      }
    }

    return {
      potentiallyUnusedExports: unused,
      limitations:
        'Static analysis limitations: Public library exports, reflection, or external consumers cannot be detected without runtime telemetry.',
    };
  }

  public assessChangeRisk(filePath: string): RiskAssessmentResult {
    this.ensureIndexed();
    const safe = this.sanitizer.resolveSafePath(filePath);
    const analysis = this.fileAnalyses.get(safe);
    const dependents = this.dependencyGraph?.getDeepDependents(safe) || { direct: [], indirect: [] };
    const dependentsCount = dependents.direct.length + dependents.indirect.length;
    const complexityScore = analysis?.complexity || 1;

    const dir = path.dirname(safe);
    const base = path.basename(safe, path.extname(safe));
    const hasAssociatedTests = fs.existsSync(path.join(dir, `${base}.test.ts`));
    const isCoreExport = (analysis?.exports.length || 0) > 3 || safe.includes('index.');

    let riskScore = 10;
    riskScore += Math.min(dependentsCount * 12, 45);
    riskScore += Math.min(complexityScore * 2, 25);
    if (!hasAssociatedTests) riskScore += 15;
    if (isCoreExport) riskScore += 10;
    riskScore = Math.min(Math.max(riskScore, 0), 100);

    let riskLevel: RiskAssessmentResult['riskLevel'] = 'LOW';
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 30) riskLevel = 'MEDIUM';

    const recommendations: string[] = [];
    if (!hasAssociatedTests) recommendations.push('Write comprehensive unit tests before modifying this module.');
    if (dependentsCount > 5) recommendations.push(`High blast radius: ${dependentsCount} dependent files.`);
    if (complexityScore > 15) recommendations.push('High complexity: Consider refactoring into smaller modular functions.');

    return {
      target: safe,
      riskScore,
      riskLevel,
      factors: { dependentsCount, complexityScore, hasAssociatedTests, isCoreExport },
      recommendations,
    };
  }

  public getProjectContext() {
    this.ensureIndexed();
    const summary = this.analyzeProject();
    const topExports: Array<{ file: string; exports: string[] }> = [];

    for (const fa of this.fileAnalyses.values()) {
      if (fa.exports.length > 0) {
        topExports.push({ file: path.relative(summary.projectRoot, fa.filePath), exports: fa.exports });
      }
    }

    return {
      projectSummary: summary,
      topExports: topExports.slice(0, 15),
      keyModules: Array.from(this.fileAnalyses.keys()).map((f) => path.relative(summary.projectRoot, f)).slice(0, 20),
    };
  }

  public getProjectDiagnostics() {
    this.ensureIndexed();
    const root = this.sanitizer.getProjectRoot();
    const unresolved: Array<{ file: string; specifier: string }> = [];

    for (const fa of this.fileAnalyses.values()) {
      for (const imp of fa.imports) {
        if (!imp.isExternal && imp.resolvedPath === null) {
          unresolved.push({ file: path.relative(root, fa.filePath), specifier: imp.specifier });
        }
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, pathStack: string[]) => {
      visited.add(node);
      recStack.add(node);
      pathStack.push(node);

      const outgoing = this.dependencyGraph?.getOutgoing(node) || [];
      for (const neighbor of outgoing) {
        if (!visited.has(neighbor)) dfs(neighbor, [...pathStack]);
        else if (recStack.has(neighbor)) {
          const cycleStart = pathStack.indexOf(neighbor);
          if (cycleStart !== -1) cycles.push(pathStack.slice(cycleStart).map((f) => path.relative(root, f)));
        }
      }
      recStack.delete(node);
    };

    for (const file of this.fileAnalyses.keys()) {
      if (!visited.has(file)) dfs(file, []);
    }

    return { unresolvedImports: unresolved, circularDependencies: cycles };
  }
}
