# DevLens MCP

[![npm version](https://img.shields.io/npm/v/devlens-mcp.svg?style=flat-square)](https://www.npmjs.com/package/devlens-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.2.0-orange.svg?style=flat-square)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?style=flat-square)](https://www.typescriptlang.org/)

**DevLens MCP** is a high-performance, security-hardened [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server engineered for AI coding agents (Claude, Cursor, Cline, Windsurf). It performs zero-execution, AST-based static analysis, symbol location, dependency tracing, change impact analysis, and risk assessment on TypeScript and JavaScript codebases.

---

## 🚀 Key Features & 8 MCP Tools

1. **`analyze_project`**: High-level structural scan, entry points, module systems, and tech stack detection.
2. **`find_symbol`**: Precise location of classes, functions, interfaces, and types across the entire project.
3. **`trace_dependencies`**: Deep dependency tree analysis with import/export resolution and circular dependency detection.
4. **`analyze_impact`**: Calculates the exact blast radius and affected files before modifying a target file.
5. **`detect_dead_code`**: Identifies unreferenced symbols, orphan files, and unreachable exports.
6. **`assess_change_risk`**: Evaluates cyclomatic complexity, blast radius, and test coverage to assign risk scores (LOW/MEDIUM/HIGH/CRITICAL).
7. **`get_project_context`**: Compact, token-optimized codebase summary designed specifically for LLM context windows.
8. **`get_project_diagnostics`**: Aggregates architectural warnings, circular imports, and deep inheritance trees.

---

## 🔒 Security Architecture

- **Path Traversal Protection**: Enforces strict canonical path verification against the designated workspace root; rejects null-bytes, relative symlink escapes, and directory climbing attempts.
- **Credential & Secret Redaction**: Automatically suppresses `.env*`, `id_rsa`, `.pem`, and hidden secrets from scanning indices.
- **Zero-Execution Static AST**: Uses TypeScript compiler APIs strictly in passive inspection mode—no arbitrary code execution.

---

## 📦 Quickstart

### Running via npx
```bash
npx devlens-mcp /path/to/your/project
