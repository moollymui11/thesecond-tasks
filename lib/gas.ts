// เรียก Google Apps Script ที่ผูกกับ Google Sheet (อ่าน/เขียนชีต + เก็บรูปลง Drive)

export type SheetData = {
  tasks: string[][];
  staff: string[][];
  settings: string[][];
  logs: string[][];
};

export async function gas<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL หรือ APPS_SCRIPT_SECRET ใน Vercel');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret, ...payload }),
    redirect: 'follow',
    cache: 'no-store',
  });
  const text = await res.text();
  let json: { ok: boolean; data?: T; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Apps Script ตอบกลับไม่ถูกต้อง (เช็กว่า deploy เป็น Web app และตั้ง Who has access = Anyone): ' + text.slice(0, 150));
  }
  if (!json.ok) throw new Error(json.error || 'Apps Script error');
  return json.data as T;
}

export function getSheetData(date: string) {
  return gas<SheetData>('getData', { date });
}
