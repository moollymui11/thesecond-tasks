import { NextResponse } from 'next/server';
import { fail, isAdmin, unauthorized, verifyIdToken } from '@/lib/auth';
import { getSheetData } from '@/lib/gas';
import { parseStaff, planDay } from '@/lib/tasks';
import { isValidDate, todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken, date } = await req.json();
    const user = await verifyIdToken(idToken);
    if (!user) return unauthorized();

    const day = isValidDate(date) ? date : todayBkk();
    const data = await getSheetData(day);
    const me = parseStaff(data.staff).find((s) => s.userId === user.userId)?.name || null;
    const admin = isAdmin(user.userId);
    if (!me && !admin) return fail('ยังไม่ได้ลงทะเบียนชื่อ', 403);

    const plan = planDay(data, day);
    return NextResponse.json({
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
