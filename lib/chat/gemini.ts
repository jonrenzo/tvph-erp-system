import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Content,
  type Part,
  type FunctionDeclarationSchema,
} from "@google/generative-ai";
import { tools, type ToolName, type Tool } from "./tools";
import { executeTool } from "./execute-tool";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

const SYSTEM_PROMPT = `You are the TelcoVantage Philippines ERP Assistant. 
You help the procurement and finance teams manage vendors, POs, and compliance.

## Your Capabilities:
1. **Vendor Intel**: List vendors, check status, and verify accreditation.
2. **Financial Tracking**: Summarize POs and calculate pending liabilities.
3. **Compliance Hub**: Identify vendors with missing or expired 14-point documents.

## Link Formatting (MANDATORY):
You HAVE access to the 'id' field in every tool result. You MUST use it.
- **NEVER** say you don't have IDs.
- **ALWAYS** wrap vendor names in links: \`🏢 **[Name](/dashboard/vendors/ID)**\`
- Use the ACTUAL UUID from the tool (e.g., /dashboard/vendors/550e8400-e29b...)

## Your Response Template:
🏢 **[VENDOR NAME](/dashboard/vendors/ID)**
Status: **STATUS**
---
`;

// Convert a single tool parameter to Gemini schema format
function convertParameterToSchema(param: ToolParameter): Record<string, unknown> {
  const base: Record<string, unknown> = { description: param.description };
  if (param.enum && param.enum.length > 0) {
    base.type = SchemaType.STRING;
    base.format = "enum";
    base.enum = param.enum;
  } else if (param.type === "boolean") {
    base.type = SchemaType.BOOLEAN;
  } else if (param.type === "number") {
    base.type = SchemaType.NUMBER;
  } else {
    base.type = SchemaType.STRING;
  }
  return base;
}

// Convert our tool definitions to Gemini format
function getGeminiFunctionDeclarations(): FunctionDeclaration[] {
  return tools.map((tool: Tool) => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    Object.entries(tool.parameters).forEach(([key, param]) => {
      properties[key] = convertParameterToSchema(param);
      if (!param.optional) required.push(key);
    });

    const declaration: FunctionDeclaration = {
      name: tool.name,
      description: tool.description,
    };

    if (Object.keys(properties).length > 0) {
      declaration.parameters = {
        type: SchemaType.OBJECT,
        properties,
        required,
      } as FunctionDeclarationSchema;
    }

    return declaration;
  });
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface GeminiResponse {
  response: string;
  toolCalls?: any[];
}

export async function chat(messages: ChatMessage[], userMessage: string): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: getGeminiFunctionDeclarations() }],
  });

  const history: Content[] = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chatSession = model.startChat({ history });

  let result = await chatSession.sendMessage(userMessage);
  let response = result.response;

  const toolCalls: any[] = [];

  // Handle function calls in a loop (Sequential execution)
  while (response.functionCalls() && response.functionCalls()!.length > 0) {
    const functionCalls = response.functionCalls()!;
    const functionResponses: Part[] = [];

    for (const call of functionCalls) {
      const toolName = call.name as ToolName;
      const args = (call.args || {}) as Record<string, unknown>;

      const toolResult = await executeTool(toolName, args);
      console.log(`TOOL RESULT [${toolName}]:`, JSON.stringify(toolResult, null, 2));

      toolCalls.push({ name: toolName, args, result: toolResult });

      functionResponses.push({
        functionResponse: { name: toolName, response: { result: toolResult } },
      });
    }

    result = await chatSession.sendMessage(functionResponses);
    response = result.response;
  }

  return {
    response: response.text(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
