import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      console.error('Debug: Starting plan generation with:', {
        role,
        weeksDuration,
        focusAreas,
        __dirname
      });

      // Read concepts first
      const projectRoot = path.join(__dirname, '..');
      const conceptsPath = path.join(projectRoot, 'src', 'concepts.md');
      const studyPlanPath = path.join(projectRoot, 'src', 'study-plan.md');
      
      console.error('Debug: File paths:', {
        conceptsPath,
        studyPlanPath
      });
      
      // Safely read files within src directory only
      const srcDir = path.join(projectRoot, 'src');
      if (!conceptsPath.startsWith(srcDir) || !studyPlanPath.startsWith(srcDir)) {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error in study plan generation:', error);
      return {
        content: [{ 
          type: "text", 
          text: `Error generating study plan: ${errorMessage}\nPlease check the server logs for more details.` 
        }]
      };
    }
  }
);

// Helper function to generate weekly plan
function generateWeeklyPlan(concepts: string, role: string, weeks: number, focusAreas: string[]): string {
  const lines = concepts.split('\n');
  // Look for lines starting with "KA" and filter by focus areas
  const relevantConcepts = lines
    .filter(line => line.match(/^KA\s*\d+\s*-/) && 
      focusAreas.some(area => line.toLowerCase().includes(area.toLowerCase())));

  if (relevantConcepts.length === 0) {
    const availableTopics = lines
      .filter(line => line.match(/^KA\s*\d+\s*-/))
      .map(line => {
        const parts = line.split(':');
        return parts[0]?.trim() ?? line.trim();
      })
      .join(', ');

    throw new Error(`No concepts found matching focus areas: ${focusAreas.join(', ')}. 
Available topics: ${availableTopics}`);
  }

  let plan = '';
  for (let week = 1; week <= weeks; week++) {
    const conceptIndex = (week - 1) % relevantConcepts.length;
    const concept = relevantConcepts[conceptIndex] || '';
    const parts = concept.split(':');
    const conceptTitle = parts[0]?.replace(/^KA\s*\d+\s*-\s*/, '').trim() ?? 'Review and Practice';
    
    plan += `\nWeek ${week}:\n`;
    plan += `- Focus: ${conceptTitle}\n`;
    plan += `- Study the concept in depth\n`;
    plan += `- Complete practice exercises\n`;
    plan += `- Work on ${role}-specific implementation\n`;
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

// Study plan resource
server.registerResource(
  "study-plan",
  "study-plan://src",
  {
    title: "Software Engineering Study Plan",
    description: "Personalized study plan for software engineering roles",
    mimeType: "text/markdown"
  },
  async (uri) => {
    try {
      const studyPlanPath = path.join(__dirname, 'study-plan.md');
      const content = await fs.readFile(studyPlanPath, 'utf-8');
      return {
        contents: [{
          uri: uri.href,
          text: content
        }]
      };
    } catch (error) {
      console.error('Error reading study-plan.md:', error);
      return {
        contents: [{
          uri: uri.href,
          text: '# Software Engineering Study Plan\n\nNo study plan available yet.'
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