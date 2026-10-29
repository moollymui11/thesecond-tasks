'use client';

import { useEffect, useState, useCallback } from 'react';

type LiffState = { ready: boolean; idToken: string | null; error: string | null; inClient: boolean };

let liffRef: any = null;

/** เริ่ม LIFF แล้วคืน ID token ไว้แนบไปกับทุก request */
export function useLiff(): LiffState {
  const [state, setState] = useState<LiffState>({ ready: false, idToken: null, error: null, inClient: false });

  useEffect(() => {
    (async () => {
      try {
        if (process.env.NEXT_PUBLIC_DEV_MODE === '1') {
          setState({ ready: true, idToken: 'dev', error: null, inClient: false });
          return;
        }
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID');
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId });
        liffRef = liff;
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        const idToken = liff.getIDToken();
        if (!idToken) throw new Error('ไม่ได้รับสิทธิ์ openid — เช็ก Scope ของ LIFF app');
        setState({ ready: true, idToken, error: null, inClient: liff.isInClient() });
      } catch (e: any) {
        setState({ ready: true, idToken: null, error: e?.message || String(e), inClient: false });
      }
    })();
  }, []);

  return state;
}

function relogin() {
  if (!liffRef) return window.location.reload();
  liffRef.logout();
  liffRef.login({ redirectUri: window.location.href });
}

export function useApi(idToken: string | null) {
  return useCallback(
    async function api<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...body }),
      });
      if (res.status === 401) {
        relogin();
        throw new Error('กำลังเข้าสู่ระบบใหม่…');
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `เกิดข้อผิดพลาด (${res.status})`);
      return json as T;
    },
    [idToken],
  );
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
