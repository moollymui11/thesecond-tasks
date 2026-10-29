import crypto from 'crypto';
import { DayPlan } from './tasks';

const API = 'https://api.line.me/v2/bot/message';

type Msg = { type: 'text'; text: string };
export const text = (t: string): Msg => ({ type: 'text', text: t.slice(0, 4900) });

function token() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  return t;
}

async function call(path: string, body: unknown) {
  const res = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LINE ${path} ${res.status}: ${await res.text()}`);
}

/** push = นับโควตา (จำนวนผู้รับ) */
export const push = (to: string, messages: Msg[]) => call('push', { to, messages });
/** reply = ไม่นับโควตา */
export const reply = (replyToken: string, messages: Msg[]) => call('reply', { replyToken, messages });

export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function liffUrl(path = ''): string {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id ? `https://liff.line.me/${id}${path}` : '';
}

export function morningMessage(plan: DayPlan): string {
  const lines: string[] = [`📋 งานวันนี้ ${plan.label} (สัปดาห์ที่ ${plan.week})`];

  const shared = plan.tasks.filter((t) => t.shared);
  if (shared.length) {
    lines.push('', '👥 ทุกคนที่เข้างาน');
    shared.forEach((t) =>
      lines.push(`• ${t.name}${t.assignee && !t.assignee.includes('ทุกคน') ? ` (${t.assignee})` : ''}${t.photo ? ' 📷' : ''}`),
    );
  }

  const names = new Set<string>();
  plan.working.forEach((p) => names.add(p.name));
  plan.tasks.forEach((t) => t.people.forEach((p) => names.add(p)));

  for (const name of names) {
    const mine = plan.tasks.filter((t) => !t.shared && t.people.includes(name));
    if (!mine.length) continue;
    lines.push('', `👤 ${name}`);
    mine.forEach((t) => {
      const partner = t.people.filter((p) => p !== name);
      lines.push(`• ${t.name.replace(/\s*\(ช่วยกัน 2 คน\)/, '')}${partner.length ? ` (กับ ${partner.join(', ')})` : ''}${t.photo ? ' 📷' : ''}`);
    });
  }

  if (plan.off.length) lines.push('', `🏖 วันหยุด: ${plan.off.map((p) => p.name).join(', ')}`);
  lines.push('', '📷 = ต้องถ่ายรูปส่ง');
  const url = liffUrl();
  if (url) lines.push(`ส่งงาน/แนบรูป 👉 ${url}`);
  return lines.join('\n');
}

export function summaryMessage(plan: DayPlan): string {
  const total = plan.tasks.length;
  const done = plan.tasks.filter((t) => t.done);
  const pending = plan.tasks.filter((t) => !t.done);
  const lines = [`📊 สรุปงาน ${plan.label}`, `ส่งแล้ว ${done.length}/${total} งาน`];
  if (pending.length) {
    lines.push('', '❌ ยังไม่ส่ง');
    pending.forEach((t) => lines.push(`• ${t.shared ? t.assignee || 'ทุกคน' : t.people.join(', ')} — ${t.name.replace(/\s*\(ช่วยกัน 2 คน\)/, '')}`));
  } else {
    lines.push('', '✅ ครบทุกงาน');
  }
  const url = liffUrl('/admin');
  if (url) lines.push('', `ดูรูปทั้งหมด 👉 ${url}`);
  return lines.join('\n');
}
