'use client';

import { useEffect, useState, useCallback } from 'react';

/*
 * การเข้าสู่ระบบ:
 * 1) ลองเรียก API ด้วยคุกกี้ที่จำไว้ (อายุ 180 วัน) — ส่วนใหญ่จบตรงนี้ ไม่ต้องล็อกอิน
 * 2) ถ้าไม่มีคุกกี้ → ใช้ LIFF ขอ ID token จากไลน์ (ในแอปไลน์ไม่ต้องกดอะไร) แล้วเซิร์ฟเวอร์ออกคุกกี้ให้
 * 3) ถ้า token หมดอายุ → ล็อกอินไลน์ใหม่ 1 ครั้ง
 */

type LiffState = { ready: boolean; idToken: string | null; error: string | null; inClient: boolean };

let liffPromise: Promise<any> | null = null;
let idTokenCache: string | null = null;
const never = <T,>() => new Promise<T>(() => {});

function initLiff(): Promise<any> {
  if (!liffPromise) {
    liffPromise = (async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID');
      const liff = (await import('@line/liff')).default;
      await liff.init({ liffId });
      return liff;
    })();
    liffPromise.catch(() => (liffPromise = null));
  }
  return liffPromise;
}

/** คืน ID token หรือ null ถ้ากำลังพาไปหน้าล็อกอินไลน์ */
async function lineToken(forceRelogin: boolean): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_DEV_MODE === '1') return 'dev';
  const liff = await initLiff();
  if (forceRelogin) {
    // กันวนล็อกอินไม่รู้จบ ถ้าตั้งค่าผิด
    let tries = 0;
    try {
      tries = Number(sessionStorage.getItem('ts_relogin') || 0);
      sessionStorage.setItem('ts_relogin', String(tries + 1));
    } catch {}
    if (tries >= 2) {
      try {
        sessionStorage.removeItem('ts_relogin');
      } catch {}
      throw new Error('เข้าสู่ระบบไม่สำเร็จ — เช็ก LINE_LOGIN_CHANNEL_ID ใน Vercel ว่าตรงกับ LIFF');
    }
    if (liff.isLoggedIn() && !liff.isInClient()) liff.logout();
  }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  const t = liff.getIDToken();
  if (!t) throw new Error('ไม่ได้รับสิทธิ์ openid — เช็ก Scope ของ LIFF app');
  return t;
}

/** คงไว้ให้หน้าเดิมใช้ได้: พร้อมใช้งานทันที การล็อกอินจัดการใน api() */
export function useLiff(): LiffState {
  const [state, setState] = useState<LiffState>({ ready: false, idToken: null, error: null, inClient: false });
  useEffect(() => {
    // ถ้าเพิ่งกลับมาจากหน้าล็อกอินไลน์ ให้ LIFF จัดการ code ใน URL ก่อน
    const p = new URLSearchParams(window.location.search);
    const back = p.has('code') || p.has('liffClientId') || p.has('liff.state');
    const go = () => setState({ ready: true, idToken: 'session', error: null, inClient: false });
    if (back && process.env.NEXT_PUBLIC_DEV_MODE !== '1') {
      initLiff()
        .then(go)
        .catch((e) => setState({ ready: true, idToken: null, error: e?.message || String(e), inClient: false }));
    } else go();
  }, []);
  return state;
}

async function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idTokenCache ? { ...body, idToken: idTokenCache } : body),
  });
}

export function useApi(_ready: string | null) {
  return useCallback(async function api<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    let res = await post(path, body);

    if (res.status === 401) {
      const hadToken = !!idTokenCache;
      const t = await lineToken(hadToken);
      if (!t) return never<T>(); // กำลังไปหน้าล็อกอินไลน์
      idTokenCache = t;
      res = await post(path, body);
      if (res.status === 401) {
        idTokenCache = null;
        const again = await lineToken(true);
        if (!again) return never<T>();
        idTokenCache = again;
        res = await post(path, body);
      }
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `เกิดข้อผิดพลาด (${res.status})`);
    // ได้คุกกี้แล้ว ไม่ต้องส่ง token ซ้ำ
    idTokenCache = null;
    try {
      sessionStorage.removeItem('ts_relogin');
    } catch {}
    return json as T;
  }, []);
}

/** ย่อรูปเป็น JPEG ด้านยาวไม่เกิน 1280px แล้วคืน base64 (ไม่มี prefix) */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('เปิดรูปไม่ได้ ลองถ่ายใหม่อีกครั้ง'));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const thumb = (fileId: string, w = 600) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w${w}`;

export type DayTask = {
  id: string;
  name: string;
  note: string;
  photo: boolean;
  shared: boolean;
  people: string[];
  assignee: string;
  done: null | { by: string; time: string; photoUrl: string; fileId: string; note: string };
};

export type Today = {
  date: string;
  label: string;
  week: number;
  me: string | null;
  isAdmin: boolean;
  off: string[];
  working: string[];
  tasks: DayTask[];
};

export const cleanName = (n: string) => n.replace(/\s*\(ช่วยกัน 2 คน\)/, '');
