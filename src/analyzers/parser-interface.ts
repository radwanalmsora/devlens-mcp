import { FileAnalysis } from '../core/types.js';

export interface LanguageParserAdapter {
  readonly language: 'typescript' | 'javascript' | 'python' | 'cpp' | 'java';
  readonly supportedExtensions: string[];
  parseFile(filePath: string, content: string): FileAnalysis;
}
