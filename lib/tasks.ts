import { SheetData } from './gas';
import { dayIndexOf, normDay, parseDate, rotationWeek, thaiDateLabel } from './date';

// คอลัมน์แท็บ "รายการงาน": รหัส | ประเภท | สัปดาห์ | วัน/วันที่ | ผู้รับผิดชอบ | งาน | ต้องแนบรูป | ใช้งาน | หมายเหตุ
export type Task = {
  id: string;
  type: string;
  week: string;
  day: string;
  assignee: string;
  name: string;
  photo: boolean;
  active: boolean;
  note: string;
};

// คอลัมน์แท็บ "พนักงาน": ชื่อ | ประเภท | วันหยุดประจำ | วัน/เวลาเข้างาน | LINE userId | สถานะ
export type Staff = {
  name: string;
  kind: string;
  daysOff: number[];
  hours: string;
  userId: string;
  active: boolean;
};

// คอลัมน์แท็บ "บันทึกส่งงาน": วันที่ | รหัสงาน | งาน | ผู้ส่ง | เวลา | ลิงก์รูป | fileId | หมายเหตุ | userId
export type Log = {
  date: string;
  taskId: string;
  taskName: string;
  by: string;
  time: string;
  photoUrl: string;
  fileId: string;
  note: string;
};

export type DayTask = Task & {
  people: string[];
  shared: boolean;
  done: Log | null;
};

export type DayPlan = {
  date: string;
  label: string;
  week: number;
  working: Staff[];
  off: Staff[];
  tasks: DayTask[];
};

const DEFAULT_START = '2026-11-02';
const SHARED_WORDS = ['ทุกคน', 'คนเปิดร้าน', 'คนปิดร้าน', 'ใครก็ได้'];

const s = (v: unknown) => (v == null ? '' : String(v).trim());

export function parseTasks(rows: string[][]): Task[] {
  return rows
    .filter((r) => s(r[1]) && s(r[5]))
    .map((r, i) => ({
      id: s(r[0]) || `ROW${i + 2}`,
      type: s(r[1]),
      week: s(r[2]),
      day: s(r[3]),
      assignee: s(r[4]),
      name: s(r[5]),
      photo: !/❌|ไม่/.test(s(r[6])),
      active: s(r[7]) !== 'ปิด',
      note: s(r[8]),
    }));
}

export function parseStaff(rows: string[][]): Staff[] {
  return rows
    .filter((r) => s(r[0]))
    .map((r) => ({
      name: s(r[0]),
      kind: s(r[1]),
      daysOff: s(r[2])
        .split(/[,\s/]+/)
        .map(normDay)
        .filter((d): d is number => d !== null),
      hours: s(r[3]),
      userId: s(r[4]),
      active: !/ไม่ใช้งาน|ลาออก|ปิด/.test(s(r[5])),
    }));
}

export function parseLogs(rows: string[][]): Log[] {
  return rows
    .filter((r) => s(r[0]) && s(r[1]))
    .map((r) => ({
      date: parseDate(s(r[0])) || s(r[0]),
      taskId: s(r[1]),
      taskName: s(r[2]),
      by: s(r[3]),
      time: s(r[4]),
      photoUrl: s(r[5]),
      fileId: s(r[6]),
      note: s(r[7]),
    }));
}

export function startDateOf(settings: string[][]): string {
  const row = settings.find((r) => s(r[0]).includes('วันเริ่มรอบ'));
  return (row && parseDate(s(row[1]))) || DEFAULT_START;
}

export function splitPeople(assignee: string): string[] {
  return assignee
    .split(/\s*(?:,|\+|และ|&)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function weekMatches(weekField: string, week: number): boolean {
  if (!weekField || weekField === 'ทั้งหมด' || weekField === 'ทุกสัปดาห์') return true;
  return weekField
    .split(/[,\s]+/)
    .map(Number)
    .includes(week);
}

function taskOnDate(t: Task, date: string, dayIdx: number, week: number): boolean {
  if (!t.active) return false;
  if (t.type === 'ทุกวัน') return true;
  if (t.type === 'รายสัปดาห์') return weekMatches(t.week, week) && normDay(t.day) === dayIdx;
  if (t.type === 'ครั้งเดียว') return parseDate(t.day) === date;
  return false;
}

export function planDay(data: SheetData, date: string): DayPlan {
  const tasks = parseTasks(data.tasks);
  const staff = parseStaff(data.staff).filter((p) => p.active);
  const logs = parseLogs(data.logs).filter((l) => l.date === date);
  const dayIdx = dayIndexOf(date);
  const week = rotationWeek(date, startDateOf(data.settings));

  const working = staff.filter((p) => !p.daysOff.includes(dayIdx));
  const off = staff.filter((p) => p.daysOff.includes(dayIdx));

  const dayTasks: DayTask[] = tasks
    .filter((t) => taskOnDate(t, date, dayIdx, week))
    .map((t) => {
      const shared = !t.assignee || SHARED_WORDS.some((w) => t.assignee.includes(w));
      const doneLogs = logs.filter((l) => l.taskId === t.id);
      return {
        ...t,
        shared,
        people: shared ? [] : splitPeople(t.assignee),
        done: doneLogs.length ? doneLogs[doneLogs.length - 1] : null,
      };
    });

  return { date, label: thaiDateLabel(date), week, working, off, tasks: dayTasks };
}

export function tasksFor(plan: DayPlan, name: string): DayTask[] {
  return plan.tasks.filter((t) => t.shared || t.people.includes(name));
}
