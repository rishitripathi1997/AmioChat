import { getUploadedMedia, storeUploadedMedia } from '@amiochat/backend';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'key is required' }, { status: 400 });
  }

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const data = Buffer.from(await request.arrayBuffer());
  await storeUploadedMedia(key, data, contentType);

  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'key is required' }, { status: 400 });
  }

  const media = await getUploadedMedia(key);
  if (!media) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'Media not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.data), {
    headers: { 'Content-Type': media.contentType },
  });
}
