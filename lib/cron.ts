/** Vercel Cron ส่ง Authorization: Bearer <CRON_SECRET> มาให้อัตโนมัติ
 *  ทดสอบเองได้ด้วย ?key=<CRON_SECRET> */
export function cronAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('key') === secret;
}
