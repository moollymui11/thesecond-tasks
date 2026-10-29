import crypto from 'crypto';

// คุกกี้จำเครื่องไว้ 180 วัน: พนักงานล็อกอินไลน์ครั้งเดียว ไม่ต้องล็อกอินซ้ำ
export const SESSION_COOKIE = 'ts_session';
export const SESSION_DAYS = 180;

function key(): string {
  const k = process.env.SESSION_SECRET || process.env.LINE_CHANNEL_SECRET;
  if (!k) throw new Error('ยังไม่ได้ตั้งค่า LINE_CHANNEL_SECRET');
  return k;
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (data: string) => crypto.createHmac('sha256', key()).update(data).digest('base64url');

export function makeSession(userId: string): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const data = b64(JSON.stringify({ u: userId, e: exp }));
  return `${data}.${sign(data)}`;
}

export function readSession(value: string | undefined): string | null {
  if (!value) return null;
  const [data, sig] = value.split('.');
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!u || typeof e !== 'number' || e < Date.now()) return null;
    return String(u);
  } catch {
    return null;
  }
}

export function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
