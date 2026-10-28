import path from 'node:path';
import fs from 'node:fs';

export class SecurityError extends Error {
  constructor(message: string, public readonly code: string = 'SECURITY_VIOLATION') {
    super(`[Security Violation] ${message}`);
    this.name = 'SecurityError';
  }
}

export class PathSanitizer {
  private readonly canonicalRoot: string;

  constructor(projectRoot: string) {
    const resolved = path.resolve(projectRoot);
    if (!fs.existsSync(resolved)) {
      throw new SecurityError(`Project root does not exist: ${resolved}`, 'INVALID_ROOT');
    }
    // Resolve any symlinks in the root to ensure canonical path comparison
    this.canonicalRoot = fs.realpathSync(resolved);
  }

  public getProjectRoot(): string {
    return this.canonicalRoot;
  }

  /**
   * Validates and resolves a file path against project root.
   * Throws SecurityError if path traversal or escaping root is detected.
   */
  public resolveSafePath(userPath: string): string {
    if (!userPath || typeof userPath !== 'string') {
      throw new SecurityError('Path must be a non-empty string', 'EMPTY_PATH');
    }

    // Resolve path relative to canonical root
    const resolvedPath = path.isAbsolute(userPath)
      ? path.resolve(userPath)
      : path.resolve(this.canonicalRoot, userPath);

    // Guard against null-byte injection
    if (resolvedPath.includes('\0')) {
      throw new SecurityError('Null bytes are prohibited in paths', 'NULL_BYTE');
    }

    // Enforce root boundary
    const relative = path.relative(this.canonicalRoot, resolvedPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new SecurityError(
        `Path traversal detected. Path '${userPath}' escapes project root.`,
        'PATH_TRAVERSAL'
      );
    }

    return resolvedPath;
  }

  /**
   * Check if a path escapes the root without throwing
   */
  public isPathWithinRoot(userPath: string): boolean {
    try {
      this.resolveSafePath(userPath);
      return true;
    } catch {
      return false;
    }
  }
}
