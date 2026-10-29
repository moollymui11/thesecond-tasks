'use client';

import { useCallback, useEffect, useState } from 'react';
import { Today, cleanName, useApi, useLiff } from '@/lib/client';
import TaskCard from './TaskCard';

type Me = { me: string | null; isAdmin: boolean; unregistered: string[]; displayName: string };

export default function StaffPage() {
  const liff = useLiff();
  const api = useApi(liff.idToken);
  const [me, setMe] = useState<Me | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickName, setPickName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadToday = useCallback(async () => {
    setToday(await api<Today>('/api/today'));
  }, [api]);

  useEffect(() => {
    if (!liff.idToken) return;
    (async () => {
      try {
        const m = await api<Me>('/api/me');
        setMe(m);
        if (m.me || m.isAdmin) await loadToday();
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [liff.idToken, api, loadToday]);

  async function register() {
    if (!pickName) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/register', { name: pickName });
      setMe((m) => (m ? { ...m, me: pickName } : m));
      await loadToday();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submit(taskId: string, photo: string | null, note: string) {
    const r = await api<{ photoUrl: string; fileId: string; by: string; time: string }>('/api/submit', { taskId, photo, note });
    setToday((t) =>
      t && {
        ...t,
        tasks: t.tasks.map((x) =>
          x.id === taskId ? { ...x, done: { by: r.by, time: r.time, photoUrl: r.photoUrl, fileId: r.fileId, note } } : x,
        ),
      },
    );
  }

  const fatal = liff.error || error;

  if (!liff.ready || (!me && !fatal)) {
    return (
      <div className="center">
        <div>
          <div className="spinner" />
          กำลังโหลด…
        </div>
      </div>
    );
  }

  if (fatal && !today) {
    return (
      <main className="wrap">
        <div className="brand">The Second · Hatyai</div>
        <div className="error">{fatal}</div>
      </main>
    );
  }

  // ยังไม่ลงทะเบียน: ให้เลือกชื่อ
  if (me && !me.me && !me.isAdmin) {
    return (
      <main className="wrap">
        <div className="brand">The Second · Hatyai</div>
        <h1 className="date">คุณคือใคร?</h1>
        <div className="sub">เลือกชื่อของคุณครั้งเดียว ระบบจะจำบัญชีไลน์นี้ไว้</div>
        {me.unregistered.length ? (
          <div className="names">
            {me.unregistered.map((n) => (
              <button key={n} className={`name-btn${pickName === n ? ' on' : ''}`} onClick={() => setPickName(n)}>
                {n}
              </button>
            ))}
          </div>
        ) : (
          <div className="banner">ทุกชื่อลงทะเบียนครบแล้ว ถ้าชื่อคุณไม่มี ให้แจ้งผู้จัดการ</div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="actions" style={{ marginLeft: 0, marginTop: 20 }}>
          <button className="btn btn-primary" disabled={!pickName || saving} onClick={register} style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? 'กำลังบันทึก…' : pickName ? `ยืนยัน ฉันคือ ${pickName}` : 'เลือกชื่อด้านบน'}
          </button>
        </div>
      </main>
    );
  }

  if (!today) {
    return (
      <div className="center">
        <div>
          <div className="spinner" />
          กำลังโหลดงานวันนี้…
        </div>
      </div>
    );
  }

  const name = today.me;
  const mine = today.tasks.filter((t) => !t.shared && name && t.people.includes(name));
  const shared = today.tasks.filter((t) => t.shared);
  const others = today.tasks.filter((t) => !t.shared && !(name && t.people.includes(name)));
  const myAll = [...mine, ...shared];
  const doneCount = myAll.filter((t) => t.done).length;
  const isOff = name && today.off.includes(name);

  return (
    <main className="wrap">
      <div className="brand">The Second · Hatyai</div>
      <h1 className="date">{today.label}</h1>
      <div className="sub">
        {name ? `สวัสดี ${name}` : 'แอดมิน'} · สัปดาห์ที่ {today.week}
        {today.isAdmin && (
          <>
            {' · '}
            <a className="link" href="/admin">
              หน้าแอดมิน →
            </a>
          </>
        )}
      </div>

      {isOff && <div className="banner">วันนี้เป็นวันหยุดของคุณ 🏖 ถ้าเข้ามาช่วยงานก็ส่งงานได้ตามปกติ</div>}

      {myAll.length > 0 && (
        <div className="progress">
          <div className="progress-row">
            <span>งานของฉันวันนี้</span>
            <span>
              <b>{doneCount}</b> / {myAll.length} เสร็จ
            </span>
          </div>
          <div className="bar">
            <span style={{ width: `${(doneCount / myAll.length) * 100}%` }} />
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {mine.length > 0 && (
        <section className="section">
          <h2>
            👤 หน้าที่ของฉัน <small>({mine.length})</small>
          </h2>
          {mine.map((t) => (
            <TaskCard key={t.id} task={t} me={name} onSubmit={submit} />
          ))}
        </section>
      )}

      {shared.length > 0 && (
        <section className="section">
          <h2>
            👥 งานประจำวัน <small>ทุกคนที่เข้างาน</small>
          </h2>
          {shared.map((t) => (
            <TaskCard key={t.id} task={t} me={name} onSubmit={submit} />
          ))}
        </section>
      )}

      {!mine.length && !shared.length && <div className="banner">วันนี้ไม่มีงานที่ต้องทำ</div>}

      {others.length > 0 && (
        <details className="others">
          <summary>งานของคนอื่นวันนี้ ({others.length})</summary>
          <div className="card" style={{ marginTop: 10 }}>
            {others.map((t) => (
              <div className="mini" key={t.id}>
                <span>
                  {t.done ? '✅ ' : ''}
                  {cleanName(t.name)}
                </span>
                <span className="who">{t.people.join(', ')}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {today.off.length > 0 && <div className="sub" style={{ marginTop: 18 }}>🏖 วันหยุดวันนี้: {today.off.join(', ')}</div>}
    </main>
  );
}
