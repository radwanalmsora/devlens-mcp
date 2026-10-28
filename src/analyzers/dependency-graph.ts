import path from 'node:path';
import { FileAnalysis } from '../core/types.js';

export interface DependencyGraphNode {
  filePath: string;
  analysis: FileAnalysis;
  incomingDependencies: Set<string>;
  outgoingDependencies: Set<string>;
  externalDependencies: Set<string>;
}

export class DependencyGraph {
  private nodes = new Map<string, DependencyGraphNode>();
  private allProjectFiles = new Set<string>();

  constructor(fileAnalyses: FileAnalysis[]) {
    for (const fa of fileAnalyses) {
      this.allProjectFiles.add(fa.filePath);
      this.nodes.set(fa.filePath, {
        filePath: fa.filePath,
        analysis: fa,
        incomingDependencies: new Set<string>(),
        outgoingDependencies: new Set<string>(),
        externalDependencies: new Set<string>(),
      });
    }
    this.buildEdges();
  }

  private buildEdges(): void {
    const candidateExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    const resolveLocalPath = (fromFile: string, specifier: string): string | null => {
      const dir = path.dirname(fromFile);
      const targetBase = path.resolve(dir, specifier);

      if (this.allProjectFiles.has(targetBase)) return targetBase;

      const currentExt = path.extname(targetBase);
      const stem = currentExt ? targetBase.slice(0, -currentExt.length) : targetBase;

      for (const ext of candidateExtensions) {
        const candidate = stem + ext;
        if (this.allProjectFiles.has(candidate)) return candidate;
      }

      for (const ext of candidateExtensions) {
        const indexFile = path.join(targetBase, `index${ext}`);
        if (this.allProjectFiles.has(indexFile)) return indexFile;
      }

      return null;
    };

    for (const node of this.nodes.values()) {
      for (const imp of node.analysis.imports) {
        if (imp.isExternal) {
          node.externalDependencies.add(imp.specifier);
        } else {
          const resolved = resolveLocalPath(node.filePath, imp.specifier);
          imp.resolvedPath = resolved;
          if (resolved && this.nodes.has(resolved)) {
            node.outgoingDependencies.add(resolved);
            this.nodes.get(resolved)!.incomingDependencies.add(node.filePath);
          }
        }
      }
    }
  }

  public getNode(filePath: string): DependencyGraphNode | undefined {
    return this.nodes.get(filePath);
  }

  public getIncoming(filePath: string): string[] {
    return Array.from(this.nodes.get(filePath)?.incomingDependencies || []);
  }

  public getOutgoing(filePath: string): string[] {
    return Array.from(this.nodes.get(filePath)?.outgoingDependencies || []);
  }

  public getExternal(filePath: string): string[] {
    return Array.from(this.nodes.get(filePath)?.externalDependencies || []);
  }

  public getDeepDependents(targetFilePath: string, maxDepth = 10): {
    direct: string[];
    indirect: string[];
  } {
    const direct = this.getIncoming(targetFilePath);
    const indirectSet = new Set<string>();
    const visited = new Set<string>([targetFilePath, ...direct]);
    const queue: Array<{ file: string; depth: number }> = direct.map((f) => ({
      file: f,
      depth: 1,
    }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const incoming = this.getIncoming(current.file);
      for (const inc of incoming) {
        if (!visited.has(inc)) {
          visited.add(inc);
          indirectSet.add(inc);
          queue.push({ file: inc, depth: current.depth + 1 });
        }
      }
    }

    return { direct, indirect: Array.from(indirectSet) };
  }
}
