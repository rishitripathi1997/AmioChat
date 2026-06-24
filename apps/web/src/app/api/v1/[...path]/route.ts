import { handleRestRequest } from '@amiochat/backend';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function apiPath(segments: string[] | undefined): string {
  if (!segments?.length) return '/';
  return `/${segments.join('/')}`;
}

async function proxy(request: NextRequest, segments: string[] | undefined) {
  const url = new URL(request.url);
  const query: Record<string, string | undefined> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text();

  const origin = url.origin;
  if (!process.env.CALL_NOTIFY_URL) {
    process.env.CALL_NOTIFY_URL = 'http://127.0.0.1:3002/internal/publish';
  }
  const result = await handleRestRequest(
    {
      method: request.method,
      path: apiPath(segments),
      query,
      headers: {
        authorization: request.headers.get('authorization') ?? undefined,
        Authorization: request.headers.get('authorization') ?? undefined,
      },
      body,
    },
    { mediaBaseUrl: `${origin}/api` },
  );

  return new NextResponse(result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}
