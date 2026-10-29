import { NextResponse } from 'next/server';

export type LineUser = { userId: string; displayName: string };

/** ตรวจ ID token จาก LIFF กับเซิร์ฟเวอร์ LINE เพื่อให้รู้แน่ว่าใครส่งมา (ปลอมไม่ได้) */
export async function verifyIdToken(idToken: string): Promise<LineUser | null> {
  if (!idToken) return null;

  if (idToken === 'dev' && process.env.NODE_ENV !== 'production' && process.env.DEV_FAKE_USER_ID) {
    return { userId: process.env.DEV_FAKE_USER_ID, displayName: 'Dev' };
  }

  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) throw new Error('ยังไม่ได้ตั้งค่า LINE_LOGIN_CHANNEL_ID');
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return { userId: j.sub, displayName: j.name || '' };
}

export function adminIds(): string[] {
  return (process.env.LINE_ADMIN_USER_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export const isAdmin = (userId: string) => adminIds().includes(userId);

export const unauthorized = () => NextResponse.json({ error: 'กรุณาเข้าสู่ระบบใหม่' }, { status: 401 });

export const fail = (e: unknown, status = 500) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });
