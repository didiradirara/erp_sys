"use strict";
// server.ts — Express + SQLite + JWT 인증/권한 (RBAC)
// 실행: npm run dev  (예: ts-node server.ts)
// 필요 패키지: express cors helmet morgan better-sqlite3 zod jsonwebtoken bcryptjs
// 타입: @types/jsonwebtoken @types/bcryptjs @types/express
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const multer_1 = __importDefault(require("multer"));
const app = (0, express_1.default)();
// ---------------- 파일 폴더/정적 제공 ----------------
const DOC_DIR = path_1.default.join(process.cwd(), 'doc_data');
const WORKLOG_DIR = path_1.default.join(DOC_DIR, 'worklogs'); // 근무일지 저장 폴더
//const UPLOAD_DIR = path.join(process.cwd(), 'upload_data/worklogs');
if (!fs_1.default.existsSync(DOC_DIR))
    fs_1.default.mkdirSync(DOC_DIR, { recursive: true });
if (!fs_1.default.existsSync(WORKLOG_DIR))
    fs_1.default.mkdirSync(WORKLOG_DIR, { recursive: true });
app.use('/static', express_1.default.static(DOC_DIR)); // 예: /static/worklogs/aaa.pdf
const API_PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_EXPIRES_IN = '2h'; // 토큰 유효기간
const VITE_ORIGIN = process.env.VITE_ORIGIN || 'http://localhost:5173';
// 서버 시작 시 템플릿 폴더가 없으면 생성
const TEMPLATE_DIR = path_1.default.resolve(process.cwd(), 'doc_data');
if (!fs_1.default.existsSync(TEMPLATE_DIR)) {
    fs_1.default.mkdirSync(TEMPLATE_DIR, { recursive: true });
    console.log('[init] created doc_data folder:', TEMPLATE_DIR);
}
// 연락처: 숫자/대쉬/공백/괄호 허용, 7~20자
const phoneRegex = /^[0-9\-\s()+]{7,20}$/;
const LeaveTypeEnum = zod_1.z.enum(['연차', '반차', '병가', '경조사']);
const StatusEnum = zod_1.z.enum(['Pending', 'Approved', 'Rejected', 'Canceled']);
const RoleEnum = zod_1.z.enum(['employee', 'manager', 'hr', 'admin']);
const DeptEnum = zod_1.z.enum(['개발팀', '생산지원팀', '생산팀', '공무팀']);
// 서버 입력 검증 스키마
const createRequestSchema = zod_1.z.object({
    dateRequested: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    empId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    dept: DeptEnum,
    position: zod_1.z.string().min(1),
    leaveType: LeaveTypeEnum,
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: zod_1.z.string().optional().default(''),
    handoverPerson: zod_1.z.string().min(1, '업무인수자를 입력하세요'),
    contact: zod_1.z.string().regex(phoneRegex, '연락처 형식이 올바르지 않습니다'),
    status: StatusEnum.default('Pending'),
    // 프런트의 서명 dataURL (필수)
    signatureDataUrl: zod_1.z
        .string()
        .regex(/^data:image\/(png|jpeg);base64,/, { message: '서명 데이터 URL 형식이 올바르지 않습니다.' }),
}).refine((v) => {
    return new Date(v.endDate).getTime() >= new Date(v.startDate).getTime();
}, { path: ['endDate'], message: '종료일은 시작일보다 같거나 뒤여야 합니다' });
const updateStatusSchema = zod_1.z.object({ status: StatusEnum });
const approveWithSignatureSchema = zod_1.z.object({
    signatureDataUrl: zod_1.z
        .string()
        .regex(/^data:image\/(png|jpeg);base64,/, { message: '서명 데이터 URL 형식이 올바르지 않습니다.' })
});
// ---------------- DB ----------------
const db = new better_sqlite3_1.default('leave_manager.db');
db.pragma('journal_mode = WAL');
db.prepare(`CREATE TABLE IF NOT EXISTS requests (
  requestId TEXT PRIMARY KEY,
  dateRequested TEXT NOT NULL,
  empId TEXT NOT NULL,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  position TEXT NOT NULL,
  leaveType TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  signature TEXT,            -- 신청자 서명 (dataURL)
  handoverPerson TEXT,       -- 업무인수자
  contact TEXT,              -- 연락처
  managerSignature TEXT,     -- 승인자 서명 (dataURL)
  managerSignerId TEXT,      -- 승인자 ID
  managerSignedAt TEXT       -- 승인 시각 (ISO-ish)
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee','manager','hr','admin')),
  passwordHash TEXT NOT NULL
)`).run();
/* ---------------- worklogs 테이블 스키마 ---------------- */
// "파일업로드(필수) + 서명(필수)"에 맞춘 최소 스키마
db.prepare(`
  CREATE TABLE IF NOT EXISTS worklogs (
    id TEXT PRIMARY KEY,
    uploaderId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    filePath TEXT NOT NULL,
    signature TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending','Approved','Rejected')),
    createdAt TEXT NOT NULL
  )
`).run();
// 누락 컬럼 안전 추가(기존 DB 호환)
function ensureColWorklogs(col, type) {
    const found = db.prepare(`SELECT 1 FROM pragma_table_info('worklogs') WHERE name=?`).get(col);
    if (!found) {
        db.prepare(`ALTER TABLE worklogs ADD COLUMN ${col} ${type}`).run();
        console.log(`[migrate] worklogs.${col} added`);
    }
}
ensureColWorklogs('uploaderId', 'TEXT');
ensureColWorklogs('fileName', 'TEXT');
ensureColWorklogs('filePath', 'TEXT');
ensureColWorklogs('signature', 'TEXT');
ensureColWorklogs('status', "TEXT");
ensureColWorklogs('createdAt', 'TEXT');
// ── zod 스키마: 승인 변경 ───────────────────────────────────
const WorklogStatusEnum = zod_1.z.enum(['Pending', 'Approved', 'Rejected']);
const updateWorklogStatusSchema = zod_1.z.object({ status: WorklogStatusEnum });
// --- Multer (파일 업로드) ---
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, WORKLOG_DIR),
        filename: (_req, file, cb) => {
            const safe = file.originalname.replace(/[^\w.\-가-힣_]/g, '_');
            cb(null, `${Date.now()}_${safe}`);
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
});
// const work_upload = multer({
//   storage: multer.diskStorage({
//     destination: (_req, _file, cb) => cb(null, WORKLOG_DIR),
//     filename: (_req, file, cb) => {
//     const ext = path.extname(file.originalname || '');
//     const base = path.basename(file.originalname || 'worklog', ext).replace(/\s+/g, '_');
//     cb(null, `${Date.now()}_${base}${ext}`);
//    },
//   }),
//   limits: { fileSize: 20 * 1024 * 1024 },
// });
// 기존 테이블에 누락 컬럼 있으면 추가
function ensureColumn(table, col, type) {
    // PRAGMA table_info()는 파라미터 바인딩이 되지 않으므로 안전하게 식별자 검증 후 문자열로 사용
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
        throw new Error(`Invalid table name: ${table}`);
    }
    // 현재 테이블 컬럼 목록 조회
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const exists = cols.some(c => c.name === col);
    if (!exists) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] ${table}.${col} added`);
    }
}
['handoverPerson', 'contact', 'signature', 'managerSignature', 'managerSignerId', 'managerSignedAt', 'requesterId']
    .forEach(c => ensureColumn('requests', c, 'TEXT'));
// ---------------- 기본 계정 시드 ----------------
function cryptoRandomId() {
    try {
        return (0, crypto_1.randomUUID)();
    }
    catch { /* no-op */ }
    try {
        return globalThis?.crypto?.randomUUID?.();
    }
    catch { /* no-op */ }
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function seedUser(username, name, role, password) {
    const rec = db.prepare('SELECT id, passwordHash FROM users WHERE username=?').get(username);
    const hash = bcryptjs_1.default.hashSync(password, 10);
    if (!rec) {
        const id = cryptoRandomId();
        db.prepare('INSERT INTO users (id, username, name, role, passwordHash) VALUES (?,?,?,?,?)')
            .run(id, username, name, role, hash);
        console.log(`seeded user: ${username}/${role}`);
    }
    else {
        // 기존 계정이 있지만 비밀번호가 다르면 업데이트
        const needUpdate = !bcryptjs_1.default.compareSync(password, rec.passwordHash);
        if (needUpdate) {
            db.prepare('UPDATE users SET passwordHash=?, name=?, role=? WHERE username=?')
                .run(hash, name, role, username);
            console.log(`updated user password: ${username}`);
        }
    }
}
seedUser('admin', '관리자', 'admin', 'admin123!');
seedUser('manager', '홍팀장', 'manager', 'manager123!');
seedUser('hr', '김인사', 'hr', 'hr123!');
seedUser('employee', '이사원', 'employee', 'emp123!');
// ---------------- Utils ----------------
function todayStr() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
}
function authRequired(req, res, next) {
    const h = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m)
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
        const decoded = jsonwebtoken_1.default.verify(m[1], JWT_SECRET);
        const user = db.prepare('SELECT id, name, role FROM users WHERE id=?').get(decoded.sub);
        if (!user)
            return res.status(401).json({ ok: false, error: 'Invalid token' });
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ ok: false, error: 'Invalid/expired token' });
    }
}
function ensureRole(roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        if (!roles.includes(req.user.role))
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        next();
    };
}
// ---------------- App ----------------
app.use((0, helmet_1.default)());
const corsOptions = { origin: VITE_ORIGIN, credentials: false };
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' })); // dataURL 서명 대비
app.use((0, morgan_1.default)('dev'));
// 개발 편의를 위한 간단 로거 (헤더 확인)
const DEBUG_AUTH = process.env.DEBUG_AUTH === '1';
if (DEBUG_AUTH) {
    app.use((req, _res, next) => {
        if (req.path.startsWith('/api/')) {
            console.log('[DEBUG_AUTH]', req.method, req.path, 'Authorization=', req.headers.authorization);
        }
        next();
    });
}
// ---- Auth APIs ----
app.post('/api/login', (req, res) => {
    const p = zod_1.z.object({ username: zod_1.z.string().min(1), password: zod_1.z.string().min(1) }).safeParse(req.body);
    if (!p.success) {
        const fieldErrors = p.error.flatten?.().fieldErrors || {};
        return res.status(400).json({ ok: false, error: 'Validation error', fieldErrors });
    }
    const { username, password } = p.data;
    const found = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (!found)
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const ok = bcryptjs_1.default.compareSync(password, found.passwordHash);
    if (!ok)
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const token = signToken({ sub: found.id, role: found.role });
    const user = { id: found.id, name: found.name, role: found.role };
    return res.json({ ok: true, token, user });
});
app.get('/api/me', authRequired, (req, res) => {
    if (DEBUG_AUTH)
        console.log('[DEBUG_AUTH] /api/me user=', req.user);
    return res.json({ ok: true, data: req.user });
});
// ---- Leave Requests APIs ----
app.get('/api/requests', authRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM requests ORDER BY dateRequested DESC').all();
    return res.json({ ok: true, data: rows });
});
// 내 신청 목록 (로그인 사용자 기준)
app.get('/api/requests/mine', authRequired, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM requests WHERE requesterId = ? ORDER BY dateRequested DESC')
            .all(req.user.id);
        return res.json({ ok: true, data: rows });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: 'Internal error' });
    }
});
// 신규 신청 (서명 포함 저장)
app.post('/api/requests', authRequired, ensureRole(['employee', 'admin']), (req, res) => {
    const p = createRequestSchema.safeParse(req.body);
    if (!p.success) {
        const flat = p.error.flatten();
        return res.status(400).json({ ok: false, error: 'Validation error', formErrors: flat.formErrors, fieldErrors: flat.fieldErrors });
    }
    const r = p.data;
    const requestId = cryptoRandomId();
    db.prepare(`INSERT INTO requests
    (requestId,dateRequested,empId,name,dept,position,leaveType,startDate,endDate,note,status,handoverPerson,contact,signature,requesterId)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(requestId, r.dateRequested, r.empId, r.name, r.dept, r.position, r.leaveType, r.startDate, r.endDate, r.note ?? '', r.status, r.handoverPerson, r.contact, r.signatureDataUrl, req.user.id);
    const rec = db.prepare('SELECT * FROM requests WHERE requestId=?').get(requestId);
    return res.status(201).json({ ok: true, data: rec });
});
// 상태 변경 (승인/거절)
app.put('/api/requests/:id/status', authRequired, ensureRole(['manager', 'admin']), (req, res) => {
    const p = updateStatusSchema.safeParse(req.body);
    if (!p.success)
        return res.status(400).json({ ok: false, error: 'Validation error' });
    const { id } = req.params;
    const exists = db.prepare('SELECT requestId FROM requests WHERE requestId=?').get(id);
    if (!exists)
        return res.status(404).json({ ok: false, error: 'Not found' });
    db.prepare('UPDATE requests SET status=? WHERE requestId=?').run(p.data.status, id);
    const rec = db.prepare('SELECT * FROM requests WHERE requestId=?').get(id);
    return res.json({ ok: true, data: rec });
});
// 최근 한 달
app.get('/api/requests/recent', authRequired, ensureRole(['manager', 'hr', 'admin']), (req, res) => {
    const now = new Date();
    const cut = new Date(now);
    cut.setMonth(cut.getMonth() - 1);
    const cutStr = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
    const rows = db.prepare('SELECT * FROM requests WHERE dateRequested >= ? ORDER BY dateRequested DESC').all(cutStr);
    return res.json({ ok: true, data: rows });
});
// 신청자 서명 조회 (dataURL 그대로)
app.get('/api/requests/:id/signature', authRequired, (req, res) => {
    const r = db.prepare('SELECT signature FROM requests WHERE requestId=?').get(req.params.id);
    if (!r?.signature)
        return res.status(404).send('No signature');
    res.json({ ok: true, dataUrl: r.signature });
});
// 승인 + 승인자 서명 저장
app.post('/api/requests/:id/approve', authRequired, ensureRole(['manager', 'admin']), (req, res) => {
    const { id } = req.params;
    const p = approveWithSignatureSchema.safeParse(req.body);
    if (!p.success) {
        const flat = p.error.flatten();
        return res.status(400).json({ ok: false, error: 'Validation error', formErrors: flat.formErrors, fieldErrors: flat.fieldErrors });
    }
    const exists = db.prepare('SELECT requestId, status FROM requests WHERE requestId=?').get(id);
    if (!exists)
        return res.status(404).json({ ok: false, error: 'Not found' });
    if (exists.status === 'Approved')
        return res.status(409).json({ ok: false, error: 'Already approved' });
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    db.prepare(`UPDATE requests
    SET status='Approved',
        managerSignature=?,
        managerSignerId=?,
        managerSignedAt=?
    WHERE requestId=?`)
        .run(p.data.signatureDataUrl, req.user.id, ts, id);
    const rec = db.prepare('SELECT * FROM requests WHERE requestId=?').get(id);
    return res.json({ ok: true, data: rec });
});
// ---- Self test endpoint (간단 진단) ----
app.get('/__selftest', (_req, res) => {
    const users = db.prepare('SELECT username, role FROM users ORDER BY username').all();
    return res.json({ ok: true, users, note: 'login with admin/admin123!, manager/manager123!, hr/hr123!, employee/emp123!' });
});
// 개발용 JWT 디코더 (프로덕션 사용 금지)
app.get('/__debug/jwt', (req, res) => {
    try {
        const h = String(req.headers.authorization || '');
        const m = /^Bearer\s+(.+)$/.exec(h);
        if (!m)
            return res.status(400).json({ ok: false, error: 'No Bearer token' });
        const decoded = jsonwebtoken_1.default.verify(m[1], JWT_SECRET);
        return res.json({ ok: true, decoded });
    }
    catch (e) {
        return res.status(401).json({ ok: false, error: String(e?.message || e) });
    }
});
app.listen(API_PORT, () => {
    console.log(`Leave Manager API listening on http://localhost:${API_PORT}`);
    if (DEBUG_AUTH)
        console.log('[DEBUG_AUTH] enabled');
});
// server.ts (라우트 하단 어딘가, auth 미들웨어 뒤에)
app.get('/api/templates', authRequired, ensureRole(['hr', 'admin']), (req, res) => {
    const files = fs_1.default.readdirSync(DOC_DIR)
        .filter(f => f.toLowerCase().endsWith('.xlsx'));
    return res.json({ ok: true, data: files }); // 예: ["양식A.xlsx","template-2025.xlsx"]
});
// server.ts (템플릿 다운로드 라우트)
app.get('/api/templates/:name', authRequired, ensureRole(['hr', 'admin']), (req, res) => {
    const name = req.params.name;
    const files = fs_1.default.readdirSync(DOC_DIR).filter(f => f.toLowerCase().endsWith('.xlsx'));
    if (!files.includes(name)) {
        return res.status(400).json({ ok: false, error: 'invalid template name' });
    }
    const full = path_1.default.join(DOC_DIR, name);
    // ↓ 캐시 방지
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.sendFile(full);
});
app.get('/api/worklogs', authRequired, ensureRole(['manager', 'admin']), (req, res) => {
    try {
        const rows = db.prepare(`
      SELECT w.*, u.username as uploaderUsername, u.name as uploaderName
      FROM worklogs w
      LEFT JOIN users u ON u.id = w.uploaderId
      ORDER BY w.createdAt DESC
    `).all();
        return res.json({ ok: true, data: rows });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: 'Internal error' });
    }
});
// POST /api/worklogs
app.post('/api/worklogs', authRequired, upload.single('file'), (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ ok: false, error: '파일이 필요합니다' });
        const { signatureDataUrl } = req.body;
        if (!/^data:image\/(png|jpeg);base64,/.test(signatureDataUrl || ''))
            return res.status(400).json({ ok: false, error: '서명 데이터가 필요합니다' });
        const id = cryptoRandomId(); // ✅ 진짜 고유 ID 생성
        const createdAt = new Date().toISOString();
        const filePath = `worklogs/${req.file.filename}`;
        db.prepare(`
      INSERT INTO worklogs (id, uploaderId, fileName, filePath, signature, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, // ✅ 고유 id
        req.user.id, // ✅ 업로더
        req.file.originalname || req.file.filename, filePath, signatureDataUrl, 'Pending', createdAt);
        return res.status(201).json({ ok: true, data: { id, filePath } });
    }
    catch (e) {
        console.error('[worklogs] upload error:', e);
        return res.status(500).json({ ok: false, error: 'Internal error' });
    }
});
// 상태 변경(상사/관리자)
app.put('/api/worklogs/:id/status', authRequired, ensureRole(['manager', 'admin']), (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Validation error' });
    }
    const exists = db.prepare('SELECT id FROM worklogs WHERE id=?').get(id);
    if (!exists)
        return res.status(404).json({ ok: false, error: 'Not found' });
    db.prepare('UPDATE worklogs SET status=? WHERE id=?').run(status, id);
    const row = db.prepare('SELECT * FROM worklogs WHERE id=?').get(id);
    return res.json({ ok: true, data: row });
});
