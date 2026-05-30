import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { erpTools } from '@/lib/chat/tools';

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the TelcoVantage Philippines ERP Assistant.
You help the procurement and finance teams manage vendors, POs, compliance, and documents.

## Your Capabilities:
1. **Vendor Intel**: List vendors, check status, and verify accreditation.
2. **Customer CRM**: List customer accounts, statuses, registered addresses, TINs, and primary contacts.
3. **Financial Tracking**: Summarize POs and calculate pending liabilities.
4. **Compliance Hub**: Identify vendors with missing or expired documents.
5. **Document Center**: Analyze PDFs and list documents.
6. **Agentic Actions**: You can create draft POs, approve documents, and add CRM opportunities directly.
7. **Email / Document Generation**: Draft emails using \`mailto:\` links, or format text clearly so the user can copy it.

## Context Awareness:
You may be provided with the user's current page URL. Use this to infer context (e.g., if they are on a vendor page and say "approve this document", look up the vendor's documents).

## Link Formatting (MANDATORY):
- **Vendors**: 🏢 **[Name](/dashboard/vendors/ID)**
- **Customers**: 🧾 **[Name](/dashboard/crm/ID)**
- **Documents**: 📄 **[Doc Name](/dashboard/documents)**
- Use actual UUIDs or url fields from tool results.
- When listing vendors or customers, the visible vendor/customer name must be clickable markdown.
- Do not print bare vendor/customer UUIDs unless the user specifically asks for IDs.
`;

export async function POST(req: Request) {
  const { messages, contextUrl }: { messages?: UIMessage[]; contextUrl?: string } = await req.json();

  if (!Array.isArray(messages)) {
    return Response.json({ error: 'Invalid chat request: messages must be an array.' }, { status: 400 });
  }

  const systemPromptWithContext = contextUrl 
    ? `${SYSTEM_PROMPT}\n\n## Current User Context:\nThe user is currently viewing: ${contextUrl}`
    : SYSTEM_PROMPT;

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: systemPromptWithContext,
    messages: await convertToModelMessages(messages),
    tools: erpTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
