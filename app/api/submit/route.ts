import { NextResponse } from 'next/server';
import { fail, isAdmin, unauthorized, verifyIdToken } from '@/lib/auth';
import { gas, getSheetData } from '@/lib/gas';
import { parseStaff, planDay } from '@/lib/tasks';
import { nowTimeBkk, todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { idToken, taskId, photo, note } = await req.json();
    const user = await verifyIdToken(idToken);
    if (!user) return unauthorized();

    const date = todayBkk();
    const data = await getSheetData(date);
    const me = parseStaff(data.staff).find((s) => s.userId === user.userId)?.name;
    const admin = isAdmin(user.userId);
    if (!me && !admin) return fail('ยังไม่ได้ลงทะเบียนชื่อ', 403);

    const task = planDay(data, date).tasks.find((t) => t.id === taskId);
    if (!task) return fail('ไม่พบงานนี้ในวันนี้', 404);
    if (!task.shared && !task.people.includes(me) && !admin) return fail('งานนี้ไม่ใช่หน้าที่ของคุณวันนี้', 403);
    if (task.photo && !photo) return fail('งานนี้ต้องแนบรูป', 400);
    if (photo && photo.length > 4_000_000) return fail('รูปใหญ่เกินไป', 413);

    const saved = await gas<{ photoUrl: string; fileId: string }>('submit', {
      date,
      time: nowTimeBkk(),
      taskId: task.id,
      taskName: task.name,
      staffName: me || 'แอดมิน',
      userId: user.userId,
      photo: photo || '',
      note: (note || '').slice(0, 300),
    });

    return NextResponse.json({ ok: true, ...saved, by: me || 'แอดมิน', time: nowTimeBkk() });
  } catch (e) {
    return fail(e);
  }
}
