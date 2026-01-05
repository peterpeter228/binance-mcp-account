import assert from 'node:assert';
import test from 'node:test';

test('GET /mcp/tools returns registered tools', { skip: true }, async () => {
  // TODO: start the HTTP server in test mode and validate tools payload shape.
  // Suggested assertions:
  //  - response.status === 200
  //  - response.json().tools is an array with tool definitions
  assert.ok(true);
});

test('POST /mcp/call executes a tool', { skip: true }, async () => {
  // TODO: start the HTTP server in test mode, post a tool invocation, and confirm normalized MCP content response.
  // Suggested assertions:
  //  - response.status === 200
  //  - response.json() includes a `content` array with type/text entries
  assert.ok(true);
});
