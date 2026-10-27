/* Shared helpers for every portal page. Loaded with a normal <script> tag. */
(function () {
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var STATUS_LABEL = { not_started: "Not started", reading: "Reading", done: "Done" };
  var HOME = { student: "/student.html", parent: "/parent.html", teacher: "/teacher.html" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { "content-type": "application/json" };
    var t = LS.get("lp_token");
    if (t) headers.authorization = "Bearer " + t;
    var res;
    try {
      res = await fetch("/api" + path, {
        method: opts.method || (opts.body ? "POST" : "GET"),
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      throw new Error("Can't reach the server. Check your internet connection.");
    }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401 && t && path !== "/login") {
      signOut(true);
      throw new Error("Please sign in again.");
    }
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function saveSession(resp) {
    LS.set("lp_token", resp.token);
    LS.set("lp_user", resp.user.username);
    LS.set("lp_role", resp.user.role);
    LS.set("lp_name", resp.user.name);
  }

  function signOut(redirect) {
    ["lp_token", "lp_user", "lp_role", "lp_name"].forEach(LS.del);
    if (redirect !== false) location.href = "/index.html";
  }

  async function requireRole(role) {
    if (!LS.get("lp_token")) { location.href = "/index.html"; throw new Error("redirect"); }
    var me = (await api("/me")).user;
    if (me.role !== role) { location.href = HOME[me.role] || "/index.html"; throw new Error("redirect"); }
    var who = document.getElementById("who");
    if (who) who.innerHTML = "Signed in as <strong>" + esc(me.name) + "</strong> <button class='btn-ghost' id='logoutBtn'>Sign out</button>";
    var lb = document.getElementById("logoutBtn");
    if (lb) lb.addEventListener("click", function () { signOut(); });
    return me;
  }

  function starString(n, max) {
    max = max || 3; var s = "";
    for (var i = 0; i < max; i++) s += i < n ? "★" : "☆";
    return s;
  }

  function timeAgo(ts) {
    if (!ts) return "Never";
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "Just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " hr ago";
    var d = Math.floor(s / 86400);
    if (d < 30) return d + (d === 1 ? " day ago" : " days ago");
    return new Date(ts).toLocaleDateString();
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function pct(done, total) { return total ? Math.round((done * 100) / total) : 0; }

  function courseMap(courses) {
    var m = {}; courses.forEach(function (c) { m[c.id] = c; }); return m;
  }

  /* Renders the list of notes + recent activity (read-only), used by student/parent/teacher pages. */
  function notesHTML(notes) {
    if (!notes || !notes.length) return "<div class='muted'>No teacher notes yet.</div>";
    return notes.slice(0, 20).map(function (n) {
      return "<div class='note'>" + esc(n.text) + "<small>" + esc(n.by) + " · " + fmtDate(n.ts) + "</small></div>";
    }).join("");
  }

  function activityHTML(activity, cmap) {
    if (!activity || !activity.length) return "<div class='muted'>No activity yet.</div>";
    return "<ul class='feed'>" + activity.slice(0, 12).map(function (a) {
      var c = cmap[a.course] || { title: a.course, unitLabel: "Chapter", chapters: [] };
      var title = c.chapters[a.chapter - 1] || "";
      var text;
      if (a.type === "practice") {
        text = "Practised <b>" + esc(c.title) + " " + a.chapter + "</b> " + starString(a.stars);
      } else {
        var verb = a.status === "done" ? "Finished" : a.status === "reading" ? "Started" : "Reset";
        text = verb + " <b>" + esc(c.title) + " " + esc(c.unitLabel.toLowerCase()) + " " + a.chapter + "</b>" +
          (title ? " – " + esc(title) : "") + (a.by ? " <span class='muted'>(by " + esc(a.by) + ")</span>" : "");
      }
      return "<li><span>" + text + "</span><time>" + timeAgo(a.ts) + "</time></li>";
    }).join("") + "</ul>";
  }

  window.P = {
    api: api, esc: esc, LS: LS, saveSession: saveSession, signOut: signOut, requireRole: requireRole,
    starString: starString, timeAgo: timeAgo, fmtDate: fmtDate, toast: toast, pct: pct, courseMap: courseMap,
    notesHTML: notesHTML, activityHTML: activityHTML, STATUS_LABEL: STATUS_LABEL, HOME: HOME
  };
})();
