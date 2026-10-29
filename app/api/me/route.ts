import { NextResponse } from 'next/server';
import { fail, isAdmin, unauthorized, verifyIdToken } from '@/lib/auth';
import { getSheetData } from '@/lib/gas';
import { parseStaff } from '@/lib/tasks';
import { todayBkk } from '@/lib/date';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    const user = await verifyIdToken(idToken);
    if (!user) return unauthorized();

    const data = await getSheetData(todayBkk());
    const staff = parseStaff(data.staff).filter((s) => s.active);
    const me = staff.find((s) => s.userId === user.userId);

    return NextResponse.json({
      me: me?.name || null,
      displayName: user.displayName,
      isAdmin: isAdmin(user.userId),
      unregistered: staff.filter((s) => !s.userId).map((s) => s.name),
    });
  } catch (e) {
    return fail(e);
  }
}
