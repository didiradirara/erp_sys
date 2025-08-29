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
const API_PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_EXPIRES_IN = '2h'; // 토큰 유효기간
const VITE_ORIGIN = process.env.VITE_ORIGIN || 'http://localhost:5173';
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
  status TEXT NOT NULL
)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee','manager','hr','admin')),
  passwordHash TEXT NOT NULL
)`).run();
// 기본 계정 시드 (존재 시 건너뜀)
function seedUser(username, name, role, password) {
    const exists = db.prepare('SELECT 1 FROM users WHERE username=?').get(username);
    if (!exists) {
        const id = cryptoRandomId();
        const hash = bcryptjs_1.default.hashSync(password, 10);
        db.prepare('INSERT INTO users (id, username, name, role, passwordHash) VALUES (?,?,?,?,?)')
            .run(id, username, name, role, hash);
        console.log(`seeded user: ${username}/${role}`);
    }
}
seedUser('admin', '관리자', 'admin', 'admin123!');
seedUser('manager', '홍팀장', 'manager', 'manager123!');
seedUser('hr', '김인사', 'hr', 'hr123!');
seedUser('employee', '이사원', 'employee', 'emp123!');
const LeaveTypeEnum = zod_1.z.enum(['연차', '반차', '병가', '경조사']);
const StatusEnum = zod_1.z.enum(['Pending', 'Approved', 'Rejected', 'Canceled']);
const RoleEnum = zod_1.z.enum(['employee', 'manager', 'hr', 'admin']);
const createRequestSchema = zod_1.z.object({
    dateRequested: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    empId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    dept: zod_1.z.string().min(1),
    position: zod_1.z.string().min(1),
    leaveType: LeaveTypeEnum,
    startDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: zod_1.z.string().optional().default(''),
    status: StatusEnum.default('Pending'),
});
const updateStatusSchema = zod_1.z.object({ status: StatusEnum });
const loginSchema = zod_1.z.object({ username: zod_1.z.string().min(1), password: zod_1.z.string().min(1) });
// ---------------- Utils ----------------
function cryptoRandomId() {
    try {
        return crypto.randomUUID();
    }
    catch { /* no-op */ }
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
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
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: VITE_ORIGIN, credentials: false }));
app.use(express_1.default.json());
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
app.post('/api/auth/login', (req, res) => {
    const p = loginSchema.safeParse(req.body);
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
app.get('/api/auth/me', authRequired, (req, res) => {
    if (DEBUG_AUTH)
        console.log('[DEBUG_AUTH] /api/auth/me user=', req.user);
    return res.json({ ok: true, data: req.user });
});
// ---- Leave Requests APIs ----
app.get('/api/requests', authRequired, (req, res) => {
    const rows = db.prepare('SELECT * FROM requests ORDER BY dateRequested DESC').all();
    return res.json({ ok: true, data: rows });
});
app.post('/api/requests', authRequired, ensureRole(['employee', 'admin']), (req, res) => {
    const p = createRequestSchema.safeParse(req.body);
    if (!p.success) {
        const flat = p.error.flatten();
        return res.status(400).json({ ok: false, error: 'Validation error', formErrors: flat.formErrors, fieldErrors: flat.fieldErrors });
    }
    const r = p.data;
    const requestId = cryptoRandomId();
    db.prepare(`INSERT INTO requests
    (requestId,dateRequested,empId,name,dept,position,leaveType,startDate,endDate,note,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(requestId, r.dateRequested, r.empId, r.name, r.dept, r.position, r.leaveType, r.startDate, r.endDate, r.note ?? '', r.status);
    const rec = db.prepare('SELECT * FROM requests WHERE requestId=?').get(requestId);
    return res.status(201).json({ ok: true, data: rec });
});
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
app.get('/api/requests/recent', authRequired, ensureRole(['manager', 'hr', 'admin']), (req, res) => {
    const now = new Date();
    const cut = new Date(now);
    cut.setMonth(cut.getMonth() - 1);
    const cutStr = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`;
    const rows = db.prepare('SELECT * FROM requests WHERE dateRequested >= ? ORDER BY dateRequested DESC').all(cutStr);
    return res.json({ ok: true, data: rows });
});
// ---- Self test endpoint (간단 진단) ----
app.get('/__selftest', (req, res) => {
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
