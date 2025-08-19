import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as fs from 'fs/promises';
import * as path from 'path';

// Create an MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Add an addition tool
server.registerTool("add",
  {
    title: "Addition Tool",
    description: "Add two numbers",
    inputSchema: { a: z.number(), b: z.number() }
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  { 
    title: "Greeting Resource",      // Display name for UI
    description: "Dynamic greeting generator"
  },
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Concepts resource
server.registerResource(
  "concepts",
  "concepts://src",
  {
    title: "Software Engineering Concepts",
    description: "List of software engineering concepts and explanations",
    mimeType: "text/markdown"
  },
  async (uri) => {
    try {
      const conceptsPath = path.join(__dirname, 'concepts.md');
      const content = await fs.readFile(conceptsPath, 'utf-8');
      return {
        contents: [{
          uri: uri.href,
          text: content
        }]
      };
    } catch (error) {
      console.error('Error reading concepts.md:', error);
      return {
        contents: [{
          uri: uri.href,
          text: '# Software Engineering Concepts\n\nNo concepts available yet.'
        }]
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});