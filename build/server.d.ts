#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
declare const server: McpServer;
declare function registerGlobalTools(): void;
declare const app: import("express-serve-static-core").Express;
export { app, server, registerGlobalTools };
//# sourceMappingURL=server.d.ts.map