import { NextResponse } from 'next/server';
import { fail, unauthorized, verifyIdToken } from '@/lib/auth';
import { gas } from '@/lib/gas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, name } = await req.json();
    const user = await verifyIdToken(idToken);
    if (!user) return unauthorized();
    if (!name) return fail('กรุณาเลือกชื่อ', 400);

    await gas('register', { name, userId: user.userId });
    return NextResponse.json({ ok: true, me: name });
  } catch (e) {
    return fail(e, 400);
  }
}
