import { authenticate, fail, respond, unauthorized } from '@/lib/auth';
import { gas } from '@/lib/gas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, name } = await req.json().catch(() => ({}));
    const auth = await authenticate(req, idToken);
    if (!auth) return unauthorized();
    if (!name) return fail('กรุณาเลือกชื่อ', 400);

    await gas('register', { name, userId: auth.user.userId });
    return respond(auth, { ok: true, me: name });
  } catch (e) {
    return fail(e, 400);
  }
}
