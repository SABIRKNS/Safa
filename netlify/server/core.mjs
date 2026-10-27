import crypto from "node:crypto";
import { COURSES, COURSE_MAP } from "./courses.mjs";

const STATUSES = ["not_started", "reading", "done"];
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid mix-ups
const TOKEN_DAYS = 14;
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
const fail = (status, message) => json({ error: message }, status);

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const scrypt = (pw, salt) =>
  new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt);
  return { salt: salt.toString("hex"), hash: h.toString("hex") };
}
async function verifyPassword(pw, rec) {
  const h = await scrypt(pw, Buffer.from(rec.salt, "hex"));
  return safeEqual(h.toString("hex"), rec.hash);
}
function randomCode(n = 6) {
  const bytes = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}

const cleanText = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

const emptyProgress = () => ({ chapters: {}, practice: {}, notes: [], activity: [], lastActive: null });

function summarize(prog) {
  const courses = {};
  let done = 0;
  let total = 0;
  for (const c of COURSES) {
    let d = 0;
    let r = 0;
    for (let i = 1; i <= c.chapters.length; i++) {
      const s = prog.chapters[`${c.id}:${i}`]?.status;
      if (s === "done") d++;
      else if (s === "reading") r++;
    }
    courses[c.id] = { done: d, reading: r, total: c.chapters.length };
    done += d;
    total += c.chapters.length;
  }
  let stars = 0;
  let solved = 0;
  for (const v of Object.values(prog.practice)) {
    for (const s of v.stars || []) {
      if (s) {
        stars += s;
        solved++;
      }
    }
  }
  return {
    courses,
    done,
    total,
    pct: total ? Math.round((done * 100) / total) : 0,
    practiceStars: stars,
    practiceMax: 60,
    practiceSolved: solved,
    lastActive: prog.lastActive
  };
}

function pushActivity(prog, entry, touchLastActive) {
  prog.activity.unshift(entry);
  prog.activity = prog.activity.slice(0, 40);
  if (touchLastActive) prog.lastActive = entry.ts;
}

export function createApi({ store, env = {} }) {
  let secretCache = null;
  async function getSecret() {
    if (secretCache) return secretCache;
    let rec = await store.get("config/secret");
    if (!rec) {
      rec = { value: crypto.randomBytes(32).toString("hex") };
      await store.set("config/secret", rec);
      rec = (await store.get("config/secret")) || rec;
    }
    secretCache = rec.value;
    return secretCache;
  }
  async function sign(user) {
    const payload = Buffer.from(
      JSON.stringify({ u: user.username, exp: Date.now() + TOKEN_DAYS * 86400000 })
    ).toString("base64url");
    const sig = crypto.createHmac("sha256", await getSecret()).update(payload).digest("base64url");
    return `${payload}.${sig}`;
  }
  async function authenticate(req) {
    const h = req.headers.get("authorization") || "";
    const t = h.startsWith("Bearer ") ? h.slice(7) : "";
    const [payload, sig] = t.split(".");
    if (!payload || !sig) return null;
    const expect = crypto.createHmac("sha256", await getSecret()).update(payload).digest("base64url");
    if (!safeEqual(sig, expect)) return null;
    let data;
    try {
      data = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      return null;
    }
    if (!data.exp || data.exp < Date.now()) return null;
    return (await store.get("u/" + data.u)) || null;
  }

  const publicUser = (u) => {
    const out = { username: u.username, role: u.role, name: u.name };
    if (u.role === "student") {
      out.grade = u.grade;
      out.section = u.section;
      out.parentCode = u.parentCode;
    }
    if (u.role === "parent") out.children = u.children;
    return out;
  };

  async function loadProgress(username) {
    return (await store.get("p/" + username)) || emptyProgress();
  }
  async function studentDetail(username) {
    const user = await store.get("u/" + username);
    if (!user || user.role !== "student") return null;
    const progress = await loadProgress(username);
    return {
      student: { username: user.username, name: user.name, section: user.section },
      progress,
      summary: summarize(progress)
    };
  }

  async function listStudents() {
    const keys = await store.list("u/");
    const users = await Promise.all(keys.map((k) => store.get(k)));
    const students = users.filter((u) => u && u.role === "student");
    const rows = await Promise.all(
      students.map(async (u) => {
        const prog = await loadProgress(u.username);
        return { username: u.username, name: u.name, section: u.section, summary: summarize(prog) };
      })
    );
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }

  async function handle(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();
    let body = {};
    if (method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    try {
      // ---------- public ----------
      if (method === "GET" && path === "/courses") {
        return json({ courses: COURSES });
      }

      if (method === "POST" && path === "/register") {
        const role = body.role;
        const name = cleanText(body.name, 60);
        const username = String(body.username || "").toLowerCase().trim();
        const password = String(body.password || "");
        if (!["student", "parent", "teacher"].includes(role)) return fail(400, "Choose student, parent or teacher.");
        if (!name) return fail(400, "Please enter a name.");
        if (!USERNAME_RE.test(username))
          return fail(400, "Username must be 3-30 characters: letters, numbers, dot, dash or underscore.");
        if (password.length < 6 || password.length > 100) return fail(400, "Password must be at least 6 characters.");
        if (await store.get("u/" + username)) return fail(409, "That username is taken. Try another.");

        const user = {
          username,
          role,
          name,
          pass: await hashPassword(password),
          createdAt: Date.now()
        };

        if (role === "student") {
          user.grade = "6";
          user.section = cleanText(body.section, 20);
          let code;
          do {
            code = randomCode(6);
          } while (await store.get("pc/" + code));
          user.parentCode = code;
          await store.set("pc/" + code, { student: username });
          await store.set("p/" + username, emptyProgress());
        } else if (role === "parent") {
          const code = String(body.parentCode || "").toUpperCase().replace(/\s/g, "");
          const link = code ? await store.get("pc/" + code) : null;
          if (!link) return fail(400, "That parent code wasn't found. Ask your child for the code shown on their dashboard.");
          user.children = [link.student];
        } else if (role === "teacher") {
          if (!env.TEACHER_CODE) return fail(403, "Teacher sign-up is not switched on yet (the site owner must set TEACHER_CODE).");
          if (!safeEqual(String(body.teacherCode || ""), env.TEACHER_CODE)) return fail(403, "Incorrect teacher access code.");
        }

        await store.set("u/" + username, user);
        return json({ token: await sign(user), user: publicUser(user) }, 201);
      }

      if (method === "POST" && path === "/login") {
        const username = String(body.username || "").toLowerCase().trim();
        const password = String(body.password || "");
        const rlKey = "rl/" + username;
        const rl = (await store.get(rlKey)) || { count: 0, until: 0 };
        if (rl.until > Date.now()) return fail(429, "Too many wrong attempts. Please wait a few minutes and try again.");
        const user = USERNAME_RE.test(username) ? await store.get("u/" + username) : null;
        const ok = user && (await verifyPassword(password, user.pass));
        if (!ok) {
          rl.count += 1;
          if (rl.count >= MAX_FAILS) {
            rl.until = Date.now() + LOCK_MS;
            rl.count = 0;
          }
          await store.set(rlKey, rl);
          return fail(401, "Username or password is incorrect.");
        }
        if (rl.count || rl.until) await store.set(rlKey, { count: 0, until: 0 });
        return json({ token: await sign(user), user: publicUser(user) });
      }

      // ---------- everything below needs a login ----------
      const me = await authenticate(req);
      if (!me) return fail(401, "Please sign in.");

      if (method === "GET" && path === "/me") return json({ user: publicUser(me) });

      // ----- student -----
      if (method === "GET" && path === "/progress") {
        if (me.role !== "student") return fail(403, "Students only.");
        return json(await studentDetail(me.username));
      }

      if (method === "POST" && path === "/progress/chapter") {
        let target = me.username;
        const touch = me.role === "student";
        if (me.role === "teacher") target = String(body.student || "");
        else if (me.role !== "student") return fail(403, "Not allowed.");
        const course = COURSE_MAP[body.course];
        const chapter = Number(body.chapter);
        if (!course) return fail(400, "Unknown course.");
        if (!Number.isInteger(chapter) || chapter < 1 || chapter > course.chapters.length) return fail(400, "Unknown chapter.");
        if (!STATUSES.includes(body.status)) return fail(400, "Unknown status.");
        const t = await store.get("u/" + target);
        if (!t || t.role !== "student") return fail(404, "Student not found.");
        const prog = await loadProgress(target);
        const ts = Date.now();
        prog.chapters[`${course.id}:${chapter}`] = { status: body.status, updatedAt: ts, by: me.role };
        pushActivity(
          prog,
          { ts, type: "chapter", course: course.id, chapter, status: body.status, by: me.role === "teacher" ? me.name : undefined },
          touch
        );
        await store.set("p/" + target, prog);
        return json({ summary: summarize(prog), progress: prog });
      }

      if (method === "POST" && path === "/progress/practice") {
        if (me.role !== "student") return fail(403, "Students only.");
        const chapter = Number(body.chapter);
        const q = Number(body.q);
        const stars = Number(body.stars);
        if (body.course !== "maths" || !Number.isInteger(chapter) || chapter < 1 || chapter > 10) return fail(400, "Unknown practice chapter.");
        if (![0, 1].includes(q) || ![1, 2, 3].includes(stars)) return fail(400, "Invalid result.");
        const prog = await loadProgress(me.username);
        const key = `maths:${chapter}`;
        const rec = prog.practice[key] || { stars: [0, 0], attempts: [0, 0] };
        rec.stars[q] = Math.max(rec.stars[q] || 0, stars); // keep the best result
        rec.attempts[q] = (rec.attempts[q] || 0) + 1;
        prog.practice[key] = rec;
        pushActivity(prog, { ts: Date.now(), type: "practice", course: "maths", chapter, q, stars }, true);
        await store.set("p/" + me.username, prog);
        return json({ summary: summarize(prog) });
      }

      // ----- parent -----
      if (method === "POST" && path === "/parent/link") {
        if (me.role !== "parent") return fail(403, "Parents only.");
        const code = String(body.code || "").toUpperCase().replace(/\s/g, "");
        const link = code ? await store.get("pc/" + code) : null;
        if (!link) return fail(400, "That parent code wasn't found.");
        if (!me.children.includes(link.student)) {
          me.children.push(link.student);
          await store.set("u/" + me.username, me);
        }
        return json({ ok: true });
      }

      if (method === "GET" && path === "/parent/children") {
        if (me.role !== "parent") return fail(403, "Parents only.");
        const out = [];
        for (const username of me.children) {
          const d = await studentDetail(username);
          if (d) out.push(d);
        }
        return json({ children: out });
      }

      // ----- teacher -----
      if (path.startsWith("/teacher")) {
        if (me.role !== "teacher") return fail(403, "Teachers only.");

        if (method === "GET" && path === "/teacher/students") {
          return json({ students: await listStudents() });
        }
        let m = path.match(/^\/teacher\/student\/([a-z0-9._-]{3,30})$/);
        if (method === "GET" && m) {
          const d = await studentDetail(m[1]);
          return d ? json(d) : fail(404, "Student not found.");
        }
        if (method === "POST" && path === "/teacher/note") {
          const text = cleanText(body.text, 500);
          if (!text) return fail(400, "Write a note first.");
          const t = await store.get("u/" + String(body.student || ""));
          if (!t || t.role !== "student") return fail(404, "Student not found.");
          const prog = await loadProgress(t.username);
          prog.notes.unshift({ ts: Date.now(), by: me.name, text });
          prog.notes = prog.notes.slice(0, 100);
          await store.set("p/" + t.username, prog);
          return json({ notes: prog.notes });
        }
        if (method === "POST" && path === "/teacher/reset-password") {
          const pw = String(body.password || "");
          if (pw.length < 6 || pw.length > 100) return fail(400, "Password must be at least 6 characters.");
          const t = await store.get("u/" + String(body.student || ""));
          if (!t) return fail(404, "User not found.");
          t.pass = await hashPassword(pw);
          await store.set("u/" + t.username, t);
          await store.set("rl/" + t.username, { count: 0, until: 0 });
          return json({ ok: true });
        }
      }

      return fail(404, "Not found.");
    } catch (e) {
      console.error("API error", e);
      return fail(500, "Something went wrong on the server.");
    }
  }

  return handle;
}
