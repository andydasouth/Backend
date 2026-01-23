import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * ✅ REQUIRED
 * Prevents 405 errors when Expo / browser probes the endpoint
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * ✅ REQUIRED
 * Handles CORS preflight for browser / Expo
 */
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

/**
 * ✅ MAIN CHAT HANDLER
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: Number(process.env.AI_MAX_TOKENS || 500),
    });

    return NextResponse.json(
      {
        reply: completion.choices[0].message.content,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
