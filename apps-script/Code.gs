/**
 * The Second Hatyai — ระบบงานพนักงาน (ส่วนหลังบ้านใน Google Sheet)
 *
 * วิธีติดตั้ง (รายละเอียดอยู่ในคู่มือ):
 * 1) เปิด Google Sheet → ส่วนขยาย (Extensions) → Apps Script → วางโค้ดนี้ทับทั้งหมด
 * 2) เปลี่ยน SECRET ด้านล่างเป็นรหัสลับของคุณเอง (ตัวอักษรยาว ๆ เดาไม่ได้)
 * 3) เลือกฟังก์ชัน setup แล้วกด Run (เรียกใช้) → อนุญาตสิทธิ์
 * 4) Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
 */

const SECRET = 'เปลี่ยนเป็นรหัสลับของคุณ';
const TZ = 'Asia/Bangkok';

const SHEET_TASKS = 'รายการงาน';
const SHEET_STAFF = 'พนักงาน';
const SHEET_SETTINGS = 'ตั้งค่า';
const SHEET_LOG = 'บันทึกส่งงาน';
const LOG_HEADERS = ['วันที่', 'รหัสงาน', 'งาน', 'ผู้ส่ง', 'เวลา', 'ลิงก์รูป', 'fileId', 'หมายเหตุ', 'LINE userId'];
const FOLDER_LABEL = 'โฟลเดอร์ Google Drive เก็บรูป';
const DEFAULT_FOLDER_NAME = 'The Second - รูปส่งงาน';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (SECRET.indexOf('เปลี่ยน') === 0) return json_({ ok: false, error: 'ยังไม่ได้เปลี่ยน SECRET ใน Apps Script' });
    if (req.secret !== SECRET) return json_({ ok: false, error: 'รหัสลับไม่ตรงกัน (APPS_SCRIPT_SECRET)' });

    switch (req.action) {
      case 'getData':
        return json_({ ok: true, data: getData_(req.date) });
      case 'register':
        return json_({ ok: true, data: register_(req.name, req.userId) });
      case 'submit':
        return json_({ ok: true, data: submit_(req) });
      default:
        return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return json_({ ok: true, message: 'The Second task API is running' });
}

/** รันครั้งแรกจากหน้า Apps Script เพื่อขอสิทธิ์ และสร้างแท็บ/โฟลเดอร์ที่ขาด */
function setup() {
  logSheet_();
  const folder = rootFolder_();
  Logger.log('พร้อมใช้งาน — โฟลเดอร์รูป: ' + folder.getUrl());
}

// ---------- actions ----------

function getData_(date) {
  const logs = rows_(logSheet_());
  return {
    tasks: rows_(sheet_(SHEET_TASKS)),
    staff: rows_(sheet_(SHEET_STAFF)),
    settings: rows_(sheet_(SHEET_SETTINGS)),
    logs: date ? logs.filter(function (r) { return r[0] === date; }) : logs,
  };
}

function register_(name, userId) {
  if (!name || !userId) throw new Error('ข้อมูลไม่ครบ');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(SHEET_STAFF);
    const values = sh.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      const rowName = String(values[i][0]).trim();
      const rowId = String(values[i][4]).trim();
      if (rowId === userId && rowName !== name) throw new Error('บัญชีไลน์นี้ลงทะเบียนเป็น ' + rowName + ' แล้ว');
      if (rowName === name) {
        if (rowId && rowId !== userId) throw new Error('ชื่อ ' + name + ' ถูกลงทะเบียนแล้ว ติดต่อผู้จัดการ');
        targetRow = i + 1;
      }
    }
    if (targetRow < 0) throw new Error('ไม่พบชื่อ ' + name + ' ในแท็บพนักงาน');
    sh.getRange(targetRow, 5).setValue(userId);
    return { name: name };
  } finally {
    lock.releaseLock();
  }
}

function submit_(req) {
  let photoUrl = '';
  let fileId = '';
  if (req.photo) {
    const dayFolder = subFolder_(rootFolder_(), req.date);
    const fileName = req.date + '_' + req.taskId + '_' + req.staffName + '_' + String(req.time).replace(':', '') + '.jpg';
    const blob = Utilities.newBlob(Utilities.base64Decode(req.photo), 'image/jpeg', fileName);
    const file = dayFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = file.getUrl();
    fileId = file.getId();
  }
  logSheet_().appendRow([
    req.date, req.taskId, req.taskName, req.staffName, req.time, photoUrl, fileId, req.note || '', req.userId,
  ]);
  return { photoUrl: photoUrl, fileId: fileId };
}

// ---------- helpers ----------

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบแท็บ "' + name + '" ใน Google Sheet');
  return sh;
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.appendRow(LOG_HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setFontWeight('bold');
  }
  // คอลัมน์วันที่/เวลาเก็บเป็นข้อความ เพื่อไม่ให้ชีตแปลงรูปแบบเอง
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange('E:E').setNumberFormat('@');
  return sh;
}

/** อ่านทั้งแท็บ (ไม่รวมหัวตาราง) แปลงวันที่เป็น yyyy-MM-dd และทุกอย่างเป็นข้อความ */
function rows_(sh) {
  const values = sh.getDataRange().getValues();
  return values.slice(1).map(function (r) {
    return r.map(function (v) {
      if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
      return String(v).trim();
    });
  });
}

function rootFolder_() {
  const sh = sheet_(SHEET_SETTINGS);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).indexOf(FOLDER_LABEL) === 0) {
      const link = String(values[i][1]).trim();
      const m = link.match(/[-\w]{25,}/);
      if (m) return DriveApp.getFolderById(m[0]);
      const folder = DriveApp.createFolder(DEFAULT_FOLDER_NAME);
      sh.getRange(i + 1, 2).setValue(folder.getUrl());
      return folder;
    }
  }
  const folder = DriveApp.createFolder(DEFAULT_FOLDER_NAME);
  sh.appendRow([FOLDER_LABEL, folder.getUrl(), 'ระบบสร้างให้อัตโนมัติ']);
  return folder;
}

function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
