import { authenticate, fail, isAdmin, respond, unauthorized } from '@/lib/auth';
import { getSheetData } from '@/lib/gas';
import { parseStaff, planDay } from '@/lib/tasks';
import { isValidDate, todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, date } = await req.json().catch(() => ({}));
    const auth = await authenticate(req, idToken);
    if (!auth) return unauthorized();

    const day = isValidDate(date) ? date : todayBkk();
    const data = await getSheetData(day);
    const me = parseStaff(data.staff).find((s) => s.userId === auth.user.userId)?.name || null;
    const admin = isAdmin(auth.user.userId);
    if (!me && !admin) return respond(auth, { error: 'ยังไม่ได้ลงทะเบียนชื่อ' }, 403);

    const plan = planDay(data, day);
    return respond(auth, {
      date: plan.date,
      label: plan.label,
      week: plan.week,
      me,
      isAdmin: admin,
      off: plan.off.map((p) => p.name),
      working: plan.working.map((p) => p.name),
      tasks: plan.tasks,
    });
  } catch (e) {
    return fail(e);
  }
}
