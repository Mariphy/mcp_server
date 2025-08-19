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

// Study plan generator tool
server.registerTool("generateStudyPlan",
  {
    title: "Study Plan Generator",
    description: "Generate a personalized study plan based on role and existing concepts",
    inputSchema: {
      role: z.enum(["frontend", "backend", "fullstack", "devops", "ml-engineer"]),
      weeksDuration: z.number().min(1).max(52),
      focusAreas: z.array(z.string()).min(1).max(5)
    }
  },
  async ({ role, weeksDuration, focusAreas }) => {
    try {
      // Read concepts first
      const conceptsPath = path.join(__dirname, 'concepts.md');
      const studyPlanPath = path.join(__dirname, 'study-plan.md');
      
      // Safely read files within src directory only
      if (!conceptsPath.startsWith(__dirname) || !studyPlanPath.startsWith(__dirname)) {
        throw new Error("Access denied: Can only access files in src directory");
      }

      const conceptsContent = await fs.readFile(conceptsPath, 'utf-8');
      
      // Generate study plan content
      const studyPlanContent = `# Study Plan for ${role.toUpperCase()} Developer
Generated on: ${new Date().toISOString().split('T')[0]}
Duration: ${weeksDuration} weeks

## Focus Areas
${focusAreas.map(area => `- ${area}`).join('\n')}

## Weekly Breakdown
${generateWeeklyPlan(conceptsContent, role, weeksDuration, focusAreas)}

## Resources
- Concepts from concepts.md
- Industry best practices
- Hands-on projects
`;

      // Write to study plan file
      await fs.writeFile(studyPlanPath, studyPlanContent, 'utf-8');

      return {
        content: [{ 
          type: "text", 
          text: `Study plan generated successfully! Check study-plan.md for details.
Preview:
${studyPlanContent.slice(0, 500)}...` 
        }]
      };
    } catch (error) {
      console.error('Error in study plan generation:', error);
      return {
        content: [{ 
          type: "text", 
          text: "Error generating study plan" 
        }]
      };
    }
  }
);

// Helper function to generate weekly plan
function generateWeeklyPlan(concepts: string, role: string, weeks: number, focusAreas: string[]): string {
  const lines = concepts.split('\n');
  const relevantConcepts = lines
    .filter(line => line.startsWith('##') && 
      focusAreas.some(area => line.toLowerCase().includes(area.toLowerCase())));

  let plan = '';
  for (let week = 1; week <= weeks; week++) {
    const conceptIndex = (week - 1) % relevantConcepts.length;
    plan += `\nWeek ${week}:\n`;
    plan += `- Focus: ${relevantConcepts[conceptIndex]?.replace('##', '').trim() || 'Review and Practice'}\n`;
    plan += `- Practice exercises\n- Project work\n`;
  }
  return plan;
}

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