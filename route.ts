import { authenticate, fail, isAdmin, respond, unauthorized } from '@/lib/auth';
import { getSheetData } from '@/lib/gas';
import { parseStaff } from '@/lib/tasks';
import { todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json().catch(() => ({}));
    const auth = await authenticate(req, idToken);
    if (!auth) return unauthorized();

    const data = await getSheetData(todayBkk());
    const staff = parseStaff(data.staff).filter((s) => s.active);
    const me = staff.find((s) => s.userId === auth.user.userId);

    return respond(auth, {
      me: me?.name || null,
      displayName: auth.user.displayName,
      isAdmin: isAdmin(auth.user.userId),
      unregistered: staff.filter((s) => !s.userId).map((s) => s.name),
    });
  } catch (e) {
    return fail(e);
  }
}
