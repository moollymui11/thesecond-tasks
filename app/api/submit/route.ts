import { authenticate, fail, isAdmin, respond, unauthorized } from '@/lib/auth';
import { gas, getSheetData } from '@/lib/gas';
import { parseStaff, planDay } from '@/lib/tasks';
import { nowTimeBkk, todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { idToken, taskId, photo, note } = await req.json().catch(() => ({}));
    const auth = await authenticate(req, idToken);
    if (!auth) return unauthorized();
    const userId = auth.user.userId;

    const date = todayBkk();
    const data = await getSheetData(date);
    const me = parseStaff(data.staff).find((s) => s.userId === userId)?.name;
    const admin = isAdmin(userId);
    if (!me && !admin) return fail('ยังไม่ได้ลงทะเบียนชื่อ', 403);

    const task = planDay(data, date).tasks.find((t) => t.id === taskId);
    if (!task) return fail('ไม่พบงานนี้ในวันนี้', 404);
    if (!task.shared && !task.people.includes(me) && !admin) return fail('งานนี้ไม่ใช่หน้าที่ของคุณวันนี้', 403);
    if (task.photo && !photo) return fail('งานนี้ต้องแนบรูป', 400);
    if (photo && photo.length > 4_000_000) return fail('รูปใหญ่เกินไป', 413);

    const time = nowTimeBkk();
    const saved = await gas<{ photoUrl: string; fileId: string }>('submit', {
      date,
      time,
      taskId: task.id,
      taskName: task.name,
      staffName: me || 'แอดมิน',
      userId,
      photo: photo || '',
      note: (note || '').slice(0, 300),
    });

    return respond(auth, { ok: true, ...saved, by: me || 'แอดมิน', time });
  } catch (e) {
    return fail(e);
  }
}
