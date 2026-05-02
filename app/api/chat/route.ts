import { NextRequest, NextResponse } from "next/server";
import { chat, generateMessageId, type ChatMessage } from "@/lib/chat/gemini";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow enough time for tool calls

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: "AI not configured. Missing API Key." },
        { status: 500 }
      );
    }

    // Call the "Brain"
    const result = await chat(history || [], message);

    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: "assistant",
      content: result.response,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      message: assistantMessage,
      toolCalls: result.toolCalls,
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
