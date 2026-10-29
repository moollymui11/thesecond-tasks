'use client';

import { useRef, useState } from 'react';
import { DayTask, cleanName, compressImage, thumb } from '@/lib/client';

type Props = {
  task: DayTask;
  me: string | null;
  onSubmit: (taskId: string, photo: string | null, note: string) => Promise<void>;
};

export default function TaskCard({ task, me, onSubmit }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const partners = task.people.filter((p) => p !== me);
  const done = task.done;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr(null);
    try {
      const b64 = await compressImage(f);
      setPhoto(b64);
      setPreview(`data:image/jpeg;base64,${b64}`);
    } catch (x: any) {
      setErr(x.message);
    }
  }

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(task.id, photo, note);
      setPhoto(null);
      setPreview(null);
      setNote('');
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  const cancel = () => {
    setPhoto(null);
    setPreview(null);
    setNote('');
  };

  return (
    <div className={`card${done ? ' done' : ''}`}>
      <div className="card-title">
        <span className="check">{done ? '✓' : ''}</span>
        <span>{cleanName(task.name)}</span>
      </div>

      <div className="chips">
        {task.photo ? <span className="chip photo">📷 ต้องแนบรูป</span> : <span className="chip">ไม่ต้องใช้รูป</span>}
        {partners.length > 0 && <span className="chip">ทำกับ {partners.join(', ')}</span>}
        {task.shared && <span className="chip">{task.assignee || 'ทุกคน'}</span>}
      </div>
      {task.note && !/ตารางสรุป/.test(task.note) && <div className="note">{task.note}</div>}

      {done && !preview && (
        <div className="done-info">
          {done.fileId && (
            <img src={thumb(done.fileId, 200)} alt="" onClick={() => window.open(done.photoUrl, '_blank')} />
          )}
          <div className="meta">
            <b>ส่งแล้ว</b> โดย {done.by} · {done.time} น.
            {done.note && <div>“{done.note}”</div>}
            {task.photo && (
              <div>
                <button className="btn btn-ghost" style={{ padding: '4px 0', minHeight: 0 }} onClick={() => fileRef.current?.click()}>
                  ส่งรูปใหม่
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div className="preview">
          <img src={preview} alt="รูปที่จะส่ง" />
          <textarea rows={2} placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      {err && <div className="error" style={{ marginLeft: 32 }}>{err}</div>}

      <input ref={fileRef} className="file" type="file" accept="image/*" capture="environment" onChange={pick} />

      {preview ? (
        <div className="actions">
          <button className="btn btn-primary" onClick={send} disabled={busy}>
            {busy ? 'กำลังส่ง…' : 'ส่งงาน'}
          </button>
          <button className="btn btn-soft" onClick={() => fileRef.current?.click()} disabled={busy}>
            ถ่ายใหม่
          </button>
          <button className="btn btn-ghost" onClick={cancel} disabled={busy}>
            ยกเลิก
          </button>
        </div>
      ) : (
        !done && (
          <div className="actions">
            {task.photo ? (
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                📷 ถ่ายรูปส่งงาน
              </button>
            ) : (
              <button className="btn btn-primary" onClick={send} disabled={busy}>
                {busy ? 'กำลังบันทึก…' : '✓ ทำเสร็จแล้ว'}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
