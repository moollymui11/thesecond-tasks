import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron';
import { push, text, summaryMessage } from '@/lib/line';
import { adminIds } from '@/lib/auth';
import { getSheetData } from '@/lib/gas';
import { planDay } from '@/lib/tasks';
import { todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

// ส่งสรุปตอนปิดร้านให้แอดมินแบบส่วนตัว (ใช้โควตา 1 ข้อความต่อแอดมิน 1 คน)
export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const admins = adminIds();
    if (!admins.length) throw new Error('ยังไม่ได้ตั้งค่า LINE_ADMIN_USER_IDS');
    // cron นี้ตั้งไว้หลังเที่ยงคืน UTC ไม่ได้ จึงใช้วันที่ไทยตอนรัน (23:00–23:59 น.)
    const date = todayBkk();
    const plan = planDay(await getSheetData(date), date);
    const msg = summaryMessage(plan);
    for (const id of admins) await push(id, [text(msg)]);
    return NextResponse.json({ ok: true, date, done: plan.tasks.filter((t) => t.done).length, total: plan.tasks.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
