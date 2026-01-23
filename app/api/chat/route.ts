import OpenAI from 'openai';

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

    // --- OpenAI setup ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonResponse(500, { error: 'Missing OPENAI_API_KEY' }, origin);
    }

    const model = process.env.AI_MODEL || 'gpt-4.1-mini';
    const maxOutputTokens = Math.max(
      1,
      Math.min(Number(process.env.AI_MAX_OUTPUT_TOKENS || 800), 2000)
    );

    const openai = new OpenAI({ apiKey });

    // --- OpenAI Responses API ---
    const response = await openai.responses.create({
      model,
      input: body.messages,
      max_output_tokens: maxOutputTokens,
    });

    const output =
      (response as any).output_text ??
      '';

    const usage = (response as any).usage || {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

    return jsonResponse(
      200,
      {
        output: String(output),
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
        model: response.model || model,
      },
      origin
    );
  } catch (err: any) {
    console.error('[api/chat] error:', err);
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
}
