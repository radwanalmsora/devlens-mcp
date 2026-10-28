import ts from 'typescript';
import path from 'node:path';
import { CodeSymbol, DependencyReference, FileAnalysis, SymbolKind } from '../core/types.js';
import { LanguageParserAdapter } from './parser-interface.js';

export class TypeScriptParserAdapter implements LanguageParserAdapter {
  public readonly language = 'typescript' as const;
  public readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  public parseFile(filePath: string, content: string): FileAnalysis {
    const isTs = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const isJsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');

    const sourceFile = ts.createSourceFile(
      path.basename(filePath),
      content,
      ts.ScriptTarget.Latest,
      true,
      isJsx ? ts.ScriptKind.TSX : isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );

    const symbols: CodeSymbol[] = [];
    const imports: DependencyReference[] = [];
    const exports: string[] = [];
    let complexity = 1;

    const countLines = (str: string): number => (str ? str.split('\n').length : 0);
    const linesOfCode = countLines(content);
    const getLineNumber = (pos: number): number => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

    const hasExportModifier = (node: ts.Node): boolean => {
      if (ts.canHaveModifiers(node)) {
        const modifiers = ts.getModifiers(node);
        return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      }
      return false;
    };

    const visit = (node: ts.Node) => {
      if (
        ts.isIfStatement(node) ||
        ts.isConditionalExpression(node) ||
        ts.isCaseClause(node) ||
        ts.isForStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isCatchClause(node)
      ) {
        complexity++;
      } else if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind;
        if (
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity++;
        }
      }

      if (ts.isImportDeclaration(node)) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          const specifier = node.moduleSpecifier.text;
          const importedSymbols: string[] = [];
          if (node.importClause) {
            if (node.importClause.name) importedSymbols.push(node.importClause.name.text);
            if (node.importClause.namedBindings) {
              if (ts.isNamedImports(node.importClause.namedBindings)) {
                for (const element of node.importClause.namedBindings.elements) {
                  importedSymbols.push(element.name.text);
                }
              } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                importedSymbols.push(node.importClause.namedBindings.name.text);
              }
            }
          }
          imports.push({
            sourceFile: filePath,
            specifier,
            resolvedPath: null,
            isExternal: !specifier.startsWith('.') && !specifier.startsWith('/'),
            importedSymbols,
          });
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const specifier = (node.arguments[0] as ts.StringLiteral).text;
        imports.push({
          sourceFile: filePath,
          specifier,
          resolvedPath: null,
          isExternal: !specifier.startsWith('.') && !specifier.startsWith('/'),
          importedSymbols: [],
        });
      }

      const isExported = hasExportModifier(node);

      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        symbols.push({
          name,
          kind: 'function',
          filePath,
          startLine: getLineNumber(node.getStart(sourceFile)),
          endLine: getLineNumber(node.getEnd()),
          isExported,
        });
        if (isExported) exports.push(name);
      } else if (ts.isClassDeclaration(node) && node.name) {
        const name = node.name.text;
        symbols.push({
          name,
          kind: 'class',
          filePath,
          startLine: getLineNumber(node.getStart(sourceFile)),
          endLine: getLineNumber(node.getEnd()),
          isExported,
        });
        if (isExported) exports.push(name);

        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            symbols.push({
              name: `${name}.${member.name.text}`,
              kind: 'method',
              filePath,
              startLine: getLineNumber(member.getStart(sourceFile)),
              endLine: getLineNumber(member.getEnd()),
              isExported: false,
            });
          }
        }
      } else if (ts.isInterfaceDeclaration(node)) {
        const name = node.name.text;
        symbols.push({
          name,
          kind: 'interface',
          filePath,
          startLine: getLineNumber(node.getStart(sourceFile)),
          endLine: getLineNumber(node.getEnd()),
          isExported,
        });
        if (isExported) exports.push(name);
      } else if (ts.isTypeAliasDeclaration(node)) {
        const name = node.name.text;
        symbols.push({
          name,
          kind: 'typeAlias',
          filePath,
          startLine: getLineNumber(node.getStart(sourceFile)),
          endLine: getLineNumber(node.getEnd()),
          isExported,
        });
        if (isExported) exports.push(name);
      } else if (ts.isEnumDeclaration(node)) {
        const name = node.name.text;
        symbols.push({
          name,
          kind: 'enum',
          filePath,
          startLine: getLineNumber(node.getStart(sourceFile)),
          endLine: getLineNumber(node.getEnd()),
          isExported,
        });
        if (isExported) exports.push(name);
      } else if (ts.isVariableStatement(node)) {
        const hasExport = isExported;
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const name = decl.name.text;
            const isFn =
              decl.initializer &&
              (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));
            const kind: SymbolKind = isFn ? 'function' : 'variable';

            symbols.push({
              name,
              kind,
              filePath,
              startLine: getLineNumber(decl.getStart(sourceFile)),
              endLine: getLineNumber(decl.getEnd()),
              isExported: hasExport,
            });
            if (hasExport) exports.push(name);
          }
        }
      } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push(element.name.text);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      filePath,
      language: isTs ? 'typescript' : 'javascript',
      linesOfCode,
      symbols,
      imports,
      exports: Array.from(new Set(exports)),
      complexity,
    };
  }
}
