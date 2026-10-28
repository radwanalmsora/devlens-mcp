/**
 * DevLens MCP Core Domain Types
 */

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'typeAlias'
  | 'variable'
  | 'enum'
  | 'method'
  | 'property';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  docComment?: string;
  signature?: string;
}

export interface DependencyReference {
  sourceFile: string;
  specifier: string;
  resolvedPath: string | null;
  isExternal: boolean;
  importedSymbols: string[];
}

export interface FileAnalysis {
  filePath: string;
  language: 'typescript' | 'javascript';
  linesOfCode: number;
  symbols: CodeSymbol[];
  imports: DependencyReference[];
  exports: string[];
  complexity: number;
}

export interface ProjectMetadata {
  projectRoot: string;
  totalFiles: number;
  languages: Record<string, number>;
  frameworks: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';
  hasTsConfig: boolean;
}

export interface ImpactAnalysisResult {
  target: string;
  targetType: 'file' | 'symbol';
  directDependents: string[];
  indirectDependents: string[];
  totalAffectedFiles: number;
  confidence: 'confirmed' | 'estimated';
}

export interface RiskAssessmentResult {
  target: string;
  riskScore: number; // 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: {
    dependentsCount: number;
    complexityScore: number;
    hasAssociatedTests: boolean;
    isCoreExport: boolean;
  };
  recommendations: string[];
}
