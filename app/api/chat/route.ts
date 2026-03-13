import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type RequestBody = {
  messages: ChatMessage[];
};

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(
  status: number,
  data: unknown,
  origin: string | null
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

async function verifySupabaseToken(token: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!res.ok) return null;
  return await res.json();
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');

  try {
    // --- Authorization ---
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return jsonResponse(401, { error: 'Unauthorized' }, origin);
    }

    const token = match[1];
    const user = await verifySupabaseToken(token);
    if (!user) {
      return jsonResponse(401, { error: 'Unauthorized' }, origin);
    }

    // --- Request body ---
    const body = (await req.json()) as RequestBody;
    if (!body.messages || !Array.isArray(body.messages)) {
      return jsonResponse(400, { error: 'Invalid messages' }, origin);
    }

    // --- Anthropic setup ---
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonResponse(500, { error: 'Missing ANTHROPIC_API_KEY' }, origin);
    }

    const model = process.env.AI_MODEL || 'claude-sonnet-4-20250514';
    const maxOutputTokens = Math.max(
      1,
      Math.min(Number(process.env.AI_MAX_OUTPUT_TOKENS || 800), 8096)
    );

    const anthropic = new Anthropic({ apiKey });

    // Anthropic separates system messages from the conversation
    const systemMessage = body.messages.find(m => m.role === 'system');
    const conversationMessages = body.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // --- Anthropic Messages API ---
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxOutputTokens,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: conversationMessages,
    });

    const output =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    return jsonResponse(
      200,
      {
        output: String(output),
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
        model: response.model,
      },
      origin
    );
  } catch (err: any) {
    console.error('[api/chat] error:', err);
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
}
