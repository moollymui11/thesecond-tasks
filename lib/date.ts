// วันที่ทั้งหมดในระบบใช้รูปแบบ YYYY-MM-DD ตามเวลาไทย (UTC+7)

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function todayBkk(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

export function nowTimeBkk(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(11, 16);
}

function toUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dayIndexOf(dateStr: string): number {
  return new Date(toUtc(dateStr)).getUTCDay();
}

export function thaiDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${DAY_NAMES[dayIndexOf(dateStr)]} ${d} ${MONTHS[m - 1]}`;
}

/** แปลงชื่อวันภาษาไทย (เต็มหรือย่อ) เป็นเลข 0–6, ไม่ใช่ชื่อวันคืน null */
export function normDay(raw: string): number | null {
  const t = (raw || '').trim();
  if (!t) return null;
  if (t === 'อา' || t.startsWith('อาทิตย์')) return 0;
  if (t === 'จ' || t.startsWith('จัน')) return 1;
  if (t === 'อ' || t.startsWith('อัง')) return 2;
  if (t === 'พ' || t.startsWith('พุธ')) return 3;
  if (t === 'พฤ' || t.startsWith('พฤหัส')) return 4;
  if (t === 'ศ' || t.startsWith('ศุก')) return 5;
  if (t === 'ส' || t.startsWith('เสา')) return 6;
  return null;
}

/** รับ YYYY-MM-DD หรือ d/m/yyyy (ค.ศ. หรือ พ.ศ.) คืน YYYY-MM-DD หรือ null */
export function parseDate(raw: string): string | null {
  const t = (raw || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y > 2400) y -= 543;
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/** สัปดาห์ที่ 1–4 ในรอบ นับจากวันเริ่มรอบ */
export function rotationWeek(dateStr: string, startStr: string): number {
  const diffDays = Math.round((toUtc(dateStr) - toUtc(startStr)) / 86400_000);
  const w = Math.floor(diffDays / 7);
  return (((w % 4) + 4) % 4) + 1;
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '');
}
