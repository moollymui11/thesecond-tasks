import { NextResponse } from 'next/server';
import { cronAllowed } from '@/lib/cron';
import { push, text, morningMessage } from '@/lib/line';
import { getSheetData } from '@/lib/gas';
import { planDay } from '@/lib/tasks';
import { todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

// ส่งรายการงานเข้ากลุ่มทุกเช้า (ใช้โควตา = จำนวนสมาชิกในกลุ่ม)
export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const groupId = process.env.LINE_GROUP_ID;
    if (!groupId) throw new Error('ยังไม่ได้ตั้งค่า LINE_GROUP_ID');
    const date = todayBkk();
    const plan = planDay(await getSheetData(date), date);
    await push(groupId, [text(morningMessage(plan))]);
    return NextResponse.json({ ok: true, date, tasks: plan.tasks.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
