import { NextResponse } from 'next/server';

const COS_PHOTO_BASE_URL = 'https://jonas-1387333607.cos.ap-shanghai.myqcloud.com';
const MAX_PHOTO_COUNT = 60;

async function photoExists(index: number) {
  const url = `${COS_PHOTO_BASE_URL}/photo${index}.png`;

  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return { url, exists: response.ok };
  } catch {
    return { url, exists: false };
  }
}

export async function GET() {
  const checks = await Promise.all(
    Array.from({ length: MAX_PHOTO_COUNT }, (_, index) => photoExists(index + 1))
  );

  const urls: string[] = [];

  for (const check of checks) {
    if (!check.exists) break;
    urls.push(check.url);
  }

  return NextResponse.json(
    { urls },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
