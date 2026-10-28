import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { AnalyzerEngine } from './core/analyzer-engine.js';
import { SecurityError } from './security/path-sanitizer.js';

export function createMcpServer(projectRoot: string): Server {
  const engine = new AnalyzerEngine(projectRoot);

  const server = new Server(
    { name: 'devlens-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'analyze_project',
          description: 'Map project structure, detect frameworks, package manager, and language distribution.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'find_symbol',
          description: 'Locate functions, classes, interfaces, types, and variables across the project.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Symbol name to search for.' },
              exactMatch: { type: 'boolean', description: 'Require exact match.' },
            },
            required: ['name'],
          },
        },
        {
          name: 'trace_dependencies',
          description: 'Trace incoming, outgoing, and external dependencies of a file.',
          inputSchema: {
            type: 'object',
            properties: { filePath: { type: 'string', description: 'Target file path.' } },
            required: ['filePath'],
          },
        },
        {
          name: 'analyze_impact',
          description: 'Identify files affected by modifying a target module (blast radius).',
          inputSchema: {
            type: 'object',
            properties: { filePath: { type: 'string', description: 'Modified file path.' } },
            required: ['filePath'],
          },
        },
        {
          name: 'detect_dead_code',
          description: 'Identify unreferenced exports within the project.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'assess_change_risk',
          description: 'Assess modification risk (LOW/MEDIUM/HIGH/CRITICAL) using complexity and dependency signals.',
          inputSchema: {
            type: 'object',
            properties: { filePath: { type: 'string', description: 'Target file path.' } },
            required: ['filePath'],
          },
        },
        {
          name: 'get_project_context',
          description: 'Return concise, token-optimized project context for AI coding agents.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_project_diagnostics',
          description: 'Report broken imports and circular dependency loops.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const a = args as Record<string, unknown>;

    try {
      switch (name) {
        case 'analyze_project':
          return { content: [{ type: 'text', text: JSON.stringify(engine.analyzeProject(), null, 2) }] };
        case 'find_symbol':
          return { content: [{ type: 'text', text: JSON.stringify(engine.findSymbol(String(a['name'] || ''), Boolean(a['exactMatch'])), null, 2) }] };
        case 'trace_dependencies':
          return { content: [{ type: 'text', text: JSON.stringify(engine.traceDependencies(String(a['filePath'] || '')), null, 2) }] };
        case 'analyze_impact':
          return { content: [{ type: 'text', text: JSON.stringify(engine.analyzeImpact(String(a['filePath'] || '')), null, 2) }] };
        case 'detect_dead_code':
          return { content: [{ type: 'text', text: JSON.stringify(engine.detectDeadCode(), null, 2) }] };
        case 'assess_change_risk':
          return { content: [{ type: 'text', text: JSON.stringify(engine.assessChangeRisk(String(a['filePath'] || '')), null, 2) }] };
        case 'get_project_context':
          return { content: [{ type: 'text', text: JSON.stringify(engine.getProjectContext(), null, 2) }] };
        case 'get_project_diagnostics':
          return { content: [{ type: 'text', text: JSON.stringify(engine.getProjectDiagnostics(), null, 2) }] };
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (err: unknown) {
      if (err instanceof SecurityError) throw new McpError(ErrorCode.InvalidParams, `[Security] ${err.message}`);
      if (err instanceof McpError) throw err;
      throw new McpError(ErrorCode.InternalError, String(err));
    }
  });

  return server;
}

export async function runStdioServer(projectRoot = process.cwd()): Promise<void> {
  const server = createMcpServer(projectRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[DevLens MCP] Running on stdio for: ${projectRoot}`);
}
