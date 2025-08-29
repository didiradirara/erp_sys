import Database from "better-sqlite3";
import crypto from "crypto";

const db = new Database("leave_manager.db");

const depts = ["개발팀", "생산지원팀", "생산팀", "공무팀"];
const positions = ["사원", "대리", "과장", "차장", "부장"];
const names = ["김철수", "이영희", "박민수", "최지훈", "정은지", "한지원", "오상민", "유지현", "조민아", "강호준"];
const leaveTypes = ["연차", "반차", "병가", "경조사"] as const;
const statuses = ["Pending", "Approved", "Rejected", "Canceled"] as const;

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateWithinLastMonths(months = 3): string {
  const now = new Date();
  const past = new Date();
  past.setMonth(now.getMonth() - months);
  const t = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  const d = new Date(t);
  return d.toISOString().slice(0, 10);
}

for (let i = 0; i < 100; i++) {
  const start = randomDateWithinLastMonths();
  const end = randomDateWithinLastMonths();
  const s = start < end ? start : end;
  const e = start < end ? end : start;

  const record = {
    requestId: crypto.randomUUID(),
    dateRequested: randomDateWithinLastMonths(),
    empId: "E" + String(Math.floor(Math.random() * 1000)).padStart(4, "0"),
    name: randomChoice(names),
    dept: randomChoice(depts),
    position: randomChoice(positions),
    leaveType: randomChoice([...leaveTypes]),
    startDate: s,
    endDate: e,
    note: "테스트 데이터",
    status: randomChoice([...statuses]),
  };

  db.prepare(
    `INSERT INTO requests
      (requestId, dateRequested, empId, name, dept, position, leaveType, startDate, endDate, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.requestId,
    record.dateRequested,
    record.empId,
    record.name,
    record.dept,
    record.position,
    record.leaveType,
    record.startDate,
    record.endDate,
    record.note,
    record.status
  );
}

console.log("✅ 100 rows inserted");
