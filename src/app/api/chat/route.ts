/**
 * /api/chat/route.ts — CareSlot Gemini Tool-Calling API Route (H10)
 *
 * Implements the server-side Gemini function-calling loop.
 *
 * Security & Reliability Boundaries:
 * - Credentials (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) stay strictly server-side.
 * - P001 patient context is resolved on server, never accepted from client or model.
 * - All arguments validated via Zod inside tools.
 * - Enforces two-stage confirmation before executing write tools.
 * - Iteration limit (MAX_TOOL_ITERATIONS = 6) prevents runaways.
 * - Returns structured output with both natural language and tool audit records.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { CARESLOT_SYSTEM_PROMPT } from "@/lib/agent-prompt";
import {
  CARESLOT_TOOLS,
  executeTool,
  type ToolExecutionRecord,
} from "@/lib/gemini-tools";

const MAX_TOOL_ITERATIONS = 6;

interface IncomingMessage {
  role: "user" | "model" | "assistant";
  content?: string;
  parts?: Array<{ text?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        {
          error:
            "Missing GEMINI_API_KEY. Please add your Gemini API key to .env.local on the server.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { messages } = body as { messages?: IncomingMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: 'messages' array is required." },
        { status: 400 }
      );
    }

    // Extract latest user message text (used for confirmation validation)
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    const latestUserText =
      lastUserMsg?.content ||
      lastUserMsg?.parts?.map((p) => p.text).filter(Boolean).join(" ") ||
      "";

    // Format chat history into Gemini Content format
    const contents: Content[] = messages.map((msg) => {
      const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
      const text =
        msg.content ||
        msg.parts?.map((p) => p.text).filter(Boolean).join(" ") ||
        "";
      return {
        role,
        parts: [{ text }],
      };
    });

    const ai = new GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    let iteration = 0;
    const executedTools: ToolExecutionRecord[] = [];
    let finalText = "";

    // ── Function-Calling Tool Loop ──────────────────────────────────────────
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: CARESLOT_SYSTEM_PROMPT,
          tools: CARESLOT_TOOLS,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate || !candidate.content?.parts) {
        finalText = "I could not generate a response. Please try asking again.";
        break;
      }

      const parts = candidate.content.parts;

      // Extract function calls from candidate parts
      const functionCalls = parts
        .filter((p) => p.functionCall != null)
        .map((p) => p.functionCall!);

      // If no tool was called, we have our final text response
      if (functionCalls.length === 0) {
        finalText = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("\n")
          .trim();
        break;
      }

      // Append model's response (including the functionCalls) to context
      contents.push({
        role: "model",
        parts,
      });

      // Execute each tool server-side
      const responseParts: Part[] = [];

      for (const call of functionCalls) {
        const toolName = call.name;
        if (!toolName) continue;
        const toolArgs = (call.args || {}) as Record<string, unknown>;

        const { result } = await executeTool(
          toolName,
          toolArgs,
          latestUserText
        );

        executedTools.push({
          name: toolName,
          args: toolArgs,
          result,
        });

        responseParts.push({
          functionResponse: {
            name: toolName,
            response: (result as Record<string, unknown>) ?? {},
          },
        });
      }

      // Append function responses as 'user' role into conversation
      contents.push({
        role: "user",
        parts: responseParts,
      });
    }

    if (!finalText && executedTools.length > 0) {
      finalText = "Action completed successfully.";
    }

    return NextResponse.json({
      message: finalText,
      toolCalls: executedTools,
      iterationCount: iteration,
    });
  } catch (error: unknown) {
    const rawMessage =
      error instanceof Error ? error.message : "Internal server error occurred";

    // Never log secret keys
    console.error("[CareSlot Chat API Error]:", rawMessage);

    let userFacingError = "Failed to process appointment request. Please try again.";

    if (
      rawMessage.includes("API_KEY_INVALID") ||
      rawMessage.includes("API key not valid")
    ) {
      userFacingError =
        "Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local (Google AI Studio keys start with 'AIzaSy' and are 39 characters long).";
    } else if (
      rawMessage.includes("RESOURCE_EXHAUSTED") ||
      rawMessage.includes("quota")
    ) {
      userFacingError =
        "Gemini API rate limit or quota exceeded. Please check your AI Studio quota or try again in a moment.";
    } else if (
      rawMessage.includes("PGRST") ||
      rawMessage.includes("database") ||
      rawMessage.includes("Supabase")
    ) {
      userFacingError =
        "Database connection error. Please verify your Supabase configuration and ensure the clinic schema is seeded.";
    }

    return NextResponse.json(
      {
        error: userFacingError,
        details: process.env.NODE_ENV === "development" ? rawMessage : undefined,
      },
      { status: 500 }
    );
  }
}
