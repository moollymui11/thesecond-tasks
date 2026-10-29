import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_DAYS, getCookie, makeSession, readSession } from './session';

export type LineUser = { userId: string; displayName: string };
export type Auth = { user: LineUser; fresh: boolean };

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

/** ใช้ ID token ถ้าส่งมา (แล้วออกคุกกี้ใหม่) ไม่งั้นใช้คุกกี้ที่จำไว้ */
export async function authenticate(req: Request, idToken?: string): Promise<Auth | null> {
  if (idToken) {
    const user = await verifyIdToken(idToken);
    if (user) return { user, fresh: true };
  }
  const userId = readSession(getCookie(req, SESSION_COOKIE));
  return userId ? { user: { userId, displayName: '' }, fresh: false } : null;
}

/** ตอบ JSON และต่ออายุคุกกี้เมื่อเพิ่งล็อกอิน */
export function respond(auth: Auth, body: unknown, status = 200) {
  const res = NextResponse.json(body, { status });
  if (auth.fresh) {
    res.cookies.set(SESSION_COOKIE, makeSession(auth.user.userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 86400,
    });
  }
  return res;
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
