import fs from 'node:fs';
import path from 'node:path';
import ignore, { Ignore } from 'ignore';
import { PathSanitizer } from './path-sanitizer.js';

export interface ScannerOptions {
  maxFiles?: number;
  maxFileSize?: number; // In bytes (default 1MB)
  customExcludes?: string[];
}

export class SafeFileScanner {
  private readonly sanitizer: PathSanitizer;
  private readonly ig: Ignore;
  private readonly maxFiles: number;
  private readonly maxFileSize: number;

  // Default critical exclusions (never scan)
  private readonly defaultExcludes = [
    'node_modules/**',
    '.git/**',
    '.svn/**',
    '.hg/**',
    'dist/**',
    'build/**',
    'out/**',
    '.cache/**',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
    '*.log',
    // Sensitive files & secrets
    '.env*',
    '*.pem',
    '*.key',
    '*.cert',
    'id_rsa*',
    'id_ecdsa*',
    '*.p12',
    '*.pfx',
    'credentials.json',
  ];

  constructor(sanitizer: PathSanitizer, options: ScannerOptions = {}) {
    this.sanitizer = sanitizer;
    this.maxFiles = options.maxFiles ?? 2500;
    this.maxFileSize = options.maxFileSize ?? 1024 * 1024; // 1MB

    this.ig = ignore();
    this.ig.add(this.defaultExcludes);

    if (options.customExcludes && options.customExcludes.length > 0) {
      this.ig.add(options.customExcludes);
    }

    this.loadGitignore();
  }

  private loadGitignore(): void {
    const root = this.sanitizer.getProjectRoot();
    const gitignorePath = path.join(root, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        this.ig.add(content);
      } catch {
        // Silently continue if .gitignore cannot be read
      }
    }
  }

  /**
   * Scans eligible source files (JS/TS) safely
   */
  public scanSourceFiles(startDir?: string): string[] {
    const root = this.sanitizer.getProjectRoot();
    const targetDir = startDir ? this.sanitizer.resolveSafePath(startDir) : root;
    const results: string[] = [];

    const walk = (currentDir: string) => {
      if (results.length >= this.maxFiles) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= this.maxFiles) break;

        const fullPath = path.join(currentDir, entry.name);
        const relFromRoot = path.relative(root, fullPath).replace(/\\/g, '/');

        // Check ignore rules
        if (this.ig.ignores(relFromRoot) || (entry.isDirectory() && this.ig.ignores(`${relFromRoot}/`))) {
          continue;
        }

        if (entry.isDirectory()) {
          // Do not follow symlinks outside root
          try {
            const real = fs.realpathSync(fullPath);
            if (!this.sanitizer.isPathWithinRoot(real)) continue;
          } catch {
            continue;
          }
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
            // Check file size threshold to prevent memory exhaustion
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size <= this.maxFileSize) {
                results.push(fullPath);
              }
            } catch {
              // Ignore unreadable files
            }
          }
        }
      }
    };

    walk(targetDir);
    return results;
  }
}
