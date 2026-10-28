#!/usr/bin/env node
import { runStdioServer } from './server.js';
const targetDir = process.argv[2] || process.cwd();
runStdioServer(targetDir).catch((err) => {
  console.error('[DevLens MCP Fatal]', err);
  process.exit(1);
});
