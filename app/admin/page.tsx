'use client';

import { useEffect, useState } from 'react';
import { Today, cleanName, thumb, useApi, useLiff } from '@/lib/client';

type Filter = 'all' | 'pending' | 'done';

function shift(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function AdminPage() {
  const liff = useLiff();
  const api = useApi(liff.idToken);
  const [date, setDate] = useState<string>('');
  const [data, setData] = useState<Today | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!liff.idToken) return;
    setLoading(true);
    setError(null);
    api<Today>('/api/today', date ? { date } : {})
      .then((d) => {
        setData(d);
        if (!date) setDate(d.date);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [liff.idToken, api, date]);

  if (!liff.ready || (!data && !error && !liff.error)) {
    return (
      <div className="center">
        <div>
          <div className="spinner" />
          กำลังโหลด…
        </div>
      </div>
    );
  }

  if (liff.error || (error && !data)) {
    return (
      <main className="wrap">
        <div className="brand">The Second · แอดมิน</div>
        <div className="error">{liff.error || error}</div>
      </main>
    );
  }

  if (data && !data.isAdmin) {
    return (
      <main className="wrap">
        <div className="brand">The Second · แอดมิน</div>
        <div className="error">หน้านี้สำหรับแอดมินเท่านั้น</div>
        <p>
          <a className="link" href="/">
            ← กลับไปหน้างานของฉัน
          </a>
        </p>
      </main>
    );
  }

  const tasks = data!.tasks;
  const done = tasks.filter((t) => t.done);
  const pending = tasks.filter((t) => !t.done);
  const shown = filter === 'done' ? done : filter === 'pending' ? pending : [...pending, ...done];

  return (
    <main className="wrap">
      <div className="brand">The Second · แอดมิน</div>
      <h1 className="date">{data!.label}</h1>
      <div className="sub">
        สัปดาห์ที่ {data!.week} · เข้างาน: {data!.working.join(', ') || '-'}
        {data!.off.length > 0 && ` · หยุด: ${data!.off.join(', ')}`}
      </div>

      <div className="datenav">
        <button className="btn btn-soft" onClick={() => setDate(shift(date, -1))} aria-label="วันก่อนหน้า">
          ‹
        </button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button className="btn btn-soft" onClick={() => setDate(shift(date, 1))} aria-label="วันถัดไป">
          ›
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{tasks.length}</b>
          <span>งานทั้งหมด</span>
        </div>
        <div className="stat">
          <b style={{ color: 'var(--ok)' }}>{done.length}</b>
          <span>ส่งแล้ว</span>
        </div>
        <div className="stat">
          <b style={{ color: pending.length ? 'var(--wine)' : undefined }}>{pending.length}</b>
          <span>ยังไม่ส่ง</span>
        </div>
      </div>

      <div className="filters">
        {(
          [
            ['all', 'ทั้งหมด'],
            ['pending', 'ยังไม่ส่ง'],
            ['done', 'ส่งแล้ว'],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <button key={k} className={`filter${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
        {loading && <span className="sub">กำลังโหลด…</span>}
      </div>

      {error && <div className="error">{error}</div>}

      <section className="section" style={{ marginTop: 14 }}>
        {shown.map((t) => (
          <div key={t.id} className={`card${t.done ? ' done' : ''}`}>
            <div className="card-title">
              <span className="check">{t.done ? '✓' : ''}</span>
              <span>{cleanName(t.name)}</span>
            </div>
            <div className="chips">
              <span className="chip">{t.shared ? t.assignee || 'ทุกคน' : t.people.join(', ')}</span>
              {t.photo && <span className="chip photo">📷</span>}
              {t.note && /ตารางสรุป/.test(t.note) && <span className="chip warn">ต้องเช็กตาราง</span>}
            </div>
            {t.done ? (
              <>
                <div className="note">
                  ส่งโดย {t.done.by} · {t.done.time} น.{t.done.note ? ` · “${t.done.note}”` : ''}
                </div>
                {t.done.fileId && (
                  <div className="admin-photo">
                    <img src={thumb(t.done.fileId)} alt="" loading="lazy" onClick={() => window.open(t.done!.photoUrl, '_blank')} />
                  </div>
                )}
              </>
            ) : (
              <div className="note" style={{ color: 'var(--wine)' }}>
                ยังไม่ส่ง
              </div>
            )}
          </div>
        ))}
        {!shown.length && <div className="banner">ไม่มีรายการ</div>}
      </section>

      <p style={{ marginTop: 24 }}>
        <a className="link" href="/">
          ← หน้างานของฉัน
        </a>
      </p>
    </main>
  );
}
