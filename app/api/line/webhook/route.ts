import { NextResponse } from 'next/server';
import { reply, text, verifySignature, morningMessage, liffUrl } from '@/lib/line';
import { getSheetData } from '@/lib/gas';
import { planDay } from '@/lib/tasks';
import { todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

// ข้อความที่บอทตอบกลับ (reply) ไม่นับโควตา 300 ข้อความ/เดือน
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const body = JSON.parse(raw);
  for (const ev of body.events || []) {
    try {
      await handle(ev);
    } catch (e) {
      console.error('webhook event error', e);
    }
  }
  return NextResponse.json({ ok: true });
}

async function handle(ev: any) {
  const src = ev.source || {};

  if (ev.type === 'join' && src.groupId) {
    await reply(ev.replyToken, [
      text(
        `สวัสดีครับ 👋 บอทงานประจำวัน The Second\n\nGroup ID ของกลุ่มนี้:\n${src.groupId}\n\n` +
          `(นำไปใส่ใน Vercel ชื่อ LINE_GROUP_ID)\n\nพิมพ์ "งานวันนี้" หรือ "งานพรุ่งนี้" เพื่อดูหน้าที่ได้ตลอด`,
      ),
    ]);
    return;
  }

  if (ev.type !== 'message' || ev.message?.type !== 'text') return;
  const t = String(ev.message.text || '').trim().toLowerCase();

  if (['myid', 'id', 'ไอดี'].includes(t)) {
    const lines = [`User ID ของคุณ:\n${src.userId || '-'}`];
    if (src.groupId) lines.push(`\nGroup ID ของกลุ่มนี้:\n${src.groupId}`);
    await reply(ev.replyToken, [text(lines.join('\n'))]);
    return;
  }

  if (t === 'งานวันนี้' || t === 'งานพรุ่งนี้') {
    const date = todayBkk(t === 'งานพรุ่งนี้' ? 1 : 0);
    const plan = planDay(await getSheetData(date), date);
    let msg = morningMessage(plan);
    if (t === 'งานพรุ่งนี้') msg = msg.replace('📋 งานวันนี้', '📋 งานพรุ่งนี้');
    await reply(ev.replyToken, [text(msg)]);
    return;
  }

  if (t === 'ส่งงาน' || t === 'แอป') {
    await reply(ev.replyToken, [text(`เปิดแอปส่งงาน 👉 ${liffUrl()}`)]);
  }
}
