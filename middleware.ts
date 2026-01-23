import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
  }

  const res = NextResponse.next();
  Object.entries(corsHeaders(req.headers.get('origin'))).forEach(([k, v]) =>
    res.headers.set(k, v)
  );
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
