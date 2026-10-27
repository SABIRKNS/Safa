import assert from "node:assert/strict";
import { createApi } from "../netlify/server/core.mjs";

// In-memory stand-in for Netlify Blobs
const mem = new Map();
const store = {
  get: async (k) => (mem.has(k) ? structuredClone(mem.get(k)) : null),
  set: async (k, v) => void mem.set(k, structuredClone(v)),
  list: async (p) => [...mem.keys()].filter((k) => k.startsWith(p))
};
const api = createApi({ store, env: { TEACHER_CODE: "SCHOOL-123" } });

async function call(method, path, body, token) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const res = await api(new Request("http://x/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }));
  return { status: res.status, data: await res.json() };
}

let n = 0;
const ok = (name) => console.log(`  ok ${++n} ${name}`);

// --- registration ---
let r = await call("POST", "/register", { role: "student", name: "Safa", username: "Safa.K", password: "abc123", section: "6B" });
assert.equal(r.status, 201); assert.equal(r.data.user.username, "safa.k");
const sTok = r.data.token; const code = r.data.user.parentCode;
assert.match(code, /^[A-Z2-9]{6}$/); ok("student registers and gets a parent code");

r = await call("POST", "/register", { role: "student", name: "Dup", username: "safa.k", password: "abc123" });
assert.equal(r.status, 409); ok("duplicate username rejected");

r = await call("POST", "/register", { role: "student", name: "X", username: "ab", password: "abc123" });
assert.equal(r.status, 400); ok("short username rejected");
r = await call("POST", "/register", { role: "student", name: "X", username: "validname", password: "123" });
assert.equal(r.status, 400); ok("short password rejected");

r = await call("POST", "/register", { role: "parent", name: "Mum", username: "mum1", password: "parentpw", parentCode: "WRONG1" });
assert.equal(r.status, 400); ok("parent with bad code rejected");
r = await call("POST", "/register", { role: "parent", name: "Mum", username: "mum1", password: "parentpw", parentCode: code.toLowerCase() });
assert.equal(r.status, 201); const pTok = r.data.token;
assert.deepEqual(r.data.user.children, ["safa.k"]); ok("parent registers with the child's code");

r = await call("POST", "/register", { role: "teacher", name: "Ms Rao", username: "msrao", password: "teachpw", teacherCode: "nope" });
assert.equal(r.status, 403); ok("teacher with wrong access code rejected");
r = await call("POST", "/register", { role: "teacher", name: "Ms Rao", username: "msrao", password: "teachpw", teacherCode: "SCHOOL-123" });
assert.equal(r.status, 201); const tTok = r.data.token; ok("teacher registers with the access code");

const noTeacherApi = createApi({ store, env: {} });
const res0 = await noTeacherApi(new Request("http://x/api/register", { method: "POST", body: JSON.stringify({ role: "teacher", name: "T", username: "tt1", password: "secret1", teacherCode: "" }) }));
assert.equal(res0.status, 403); ok("teacher sign-up is off when TEACHER_CODE is unset");

// --- login ---
r = await call("POST", "/login", { username: "safa.k", password: "wrong" });
assert.equal(r.status, 401);
r = await call("POST", "/login", { username: "SAFA.K", password: "abc123" });
assert.equal(r.status, 200); ok("login works (case-insensitive username), wrong password fails");
for (let i = 0; i < 5; i++) await call("POST", "/login", { username: "mum1", password: "bad" + i });
r = await call("POST", "/login", { username: "mum1", password: "parentpw" });
assert.equal(r.status, 429); ok("lockout after repeated wrong passwords");
r = await call("POST", "/teacher/reset-password", { student: "mum1", password: "newpass1" }, tTok);
assert.equal(r.status, 200);
r = await call("POST", "/login", { username: "mum1", password: "newpass1" });
assert.equal(r.status, 200); ok("teacher password reset also clears the lockout");

// --- auth ---
r = await call("GET", "/me");
assert.equal(r.status, 401);
r = await call("GET", "/me", null, "garbage.token");
assert.equal(r.status, 401); ok("missing/forged token rejected");
const forged = sTok.split(".")[0] + ".AAAA";
r = await call("GET", "/me", null, forged); assert.equal(r.status, 401); ok("tampered signature rejected");

// --- progress ---
r = await call("POST", "/progress/chapter", { course: "science", chapter: 3, status: "done" }, sTok);
assert.equal(r.status, 200); assert.equal(r.data.summary.courses.science.done, 1);
r = await call("POST", "/progress/chapter", { course: "science", chapter: 99, status: "done" }, sTok);
assert.equal(r.status, 400);
r = await call("POST", "/progress/chapter", { course: "science", chapter: 1, status: "flying" }, sTok);
assert.equal(r.status, 400); ok("student updates chapter status; bad input rejected");

r = await call("POST", "/progress/practice", { course: "maths", chapter: 2, q: 0, stars: 3 }, sTok);
assert.equal(r.status, 200); assert.equal(r.data.summary.practiceStars, 3);
r = await call("POST", "/progress/practice", { course: "maths", chapter: 2, q: 0, stars: 1 }, sTok);
assert.equal(r.data.summary.practiceStars, 3); ok("practice keeps the best stars");
r = await call("POST", "/progress/practice", { course: "maths", chapter: 2, q: 0, stars: 3 }, pTok);
assert.equal(r.status, 403); ok("parents cannot post practice results");

// --- parent view ---
r = await call("GET", "/parent/children", null, pTok);
assert.equal(r.status, 200); assert.equal(r.data.children.length, 1);
assert.equal(r.data.children[0].summary.courses.science.done, 1); ok("parent sees linked child's progress");
r = await call("GET", "/parent/children", null, sTok); assert.equal(r.status, 403); ok("student cannot use parent route");

// second child + linking
r = await call("POST", "/register", { role: "student", name: "Zayd", username: "zayd", password: "abc123" });
const code2 = r.data.user.parentCode;
r = await call("POST", "/parent/link", { code: code2 }, pTok); assert.equal(r.status, 200);
r = await call("GET", "/parent/children", null, pTok); assert.equal(r.data.children.length, 2); ok("parent links a second child");

// --- teacher view ---
r = await call("GET", "/teacher/students", null, tTok);
assert.equal(r.status, 200); assert.equal(r.data.students.length, 2); ok("teacher lists all students");
r = await call("GET", "/teacher/students", null, pTok); assert.equal(r.status, 403);
r = await call("GET", "/teacher/students", null, sTok); assert.equal(r.status, 403); ok("only teachers can list students");
r = await call("POST", "/progress/chapter", { student: "safa.k", course: "maths", chapter: 1, status: "reading" }, tTok);
assert.equal(r.status, 200); assert.equal(r.data.summary.courses.maths.reading, 1); ok("teacher can update a student's chapter");
r = await call("POST", "/teacher/note", { student: "safa.k", text: "Great work on fractions!" }, tTok);
assert.equal(r.status, 200);
r = await call("GET", "/parent/children", null, pTok);
assert.equal(r.data.children.find((c) => c.student.username === "safa.k").progress.notes[0].text, "Great work on fractions!"); ok("teacher note is visible to parent");
r = await call("GET", "/teacher/student/safa.k", null, tTok); assert.equal(r.status, 200);
r = await call("GET", "/teacher/student/nobody", null, tTok); assert.equal(r.status, 404); ok("teacher student detail / 404");

// --- misc ---
r = await call("GET", "/courses"); assert.equal(r.data.courses.length, 5); ok("course list is public");
console.log(`\nAll ${n} checks passed.`);
