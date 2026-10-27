# Class VI Learning Portal — setup guide

A small website for a Class VI class (or just your own family) with:

- **Student sign-up and dashboard**: five courses (Maths, Science, Social Science, PE, Vocational), each chapter marked *Not started / Reading / Done*.
- **Parent view**: read-only progress for each child, teacher notes, recent activity.
- **Teacher view**: whole-class table, average progress per course, per-student detail you can edit, notes, password reset, CSV export.
- **Maths Explorer Hub**: the interactive practice for all 10 maths chapters. Every solved question is sent to the student's progress automatically.
- **Printables**: both workbook PDFs, and the Pattern Explorer game.

You don't need to write any code. You only need to follow the steps below once.

---

## What's in this folder

| Path | What it is |
|---|---|
| `public/` | The pages people see (sign-in, student, parent, teacher, practice, PDFs) |
| `netlify/functions/api.mjs` | The "back office" that stores accounts and progress |
| `netlify/server/courses.mjs` | The list of courses and chapters (edit this to add subjects) |
| `netlify.toml`, `package.json` | Settings Netlify reads automatically. Leave as they are |
| `tests/` | Automated checks (optional, you can ignore) |

Nothing else needs to be set up: no database account, no email service. Netlify's built-in storage keeps the data.

---

## Step 1 — Put the files on GitHub (about 10 minutes)

Netlify works best when it reads your files from GitHub.

1. Create a free account at **github.com** (skip if you have one).
2. Click **+** (top right) → **New repository**. Name it `class6-portal`. Choose **Private**. Click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Unzip the folder you downloaded. Open it, select **everything inside** (the folders `public`, `netlify`, `tests` and the files `netlify.toml`, `package.json`, `README.md`), and **drag them all** into the GitHub page.
   - Use Chrome or Edge so that folders upload with their structure intact.
5. Wait for the upload to finish. Scroll down and click **Commit changes**.
6. Check: in your repository you should see the folders `public`, `netlify`, `tests` and the file `netlify.toml`. Open `netlify` and confirm it contains `functions` and `server`.

## Step 2 — Create the site on Netlify (about 5 minutes)

1. Create a free account at **netlify.com** (the "Sign up with GitHub" button is easiest).
2. Click **Add new site** → **Import an existing project** → **GitHub**. Allow access, then choose `class6-portal`.
3. Leave every setting as it is (Netlify reads `netlify.toml`). Click **Deploy**.
4. After about a minute the site is live at an address like `https://something-random.netlify.app`.
   You can change this under **Site configuration → Change site name**.

## Step 3 — Switch on teacher sign-up (important)

Teachers need a secret access code so that students can't make themselves teachers.

1. In Netlify, open your site → **Site configuration** → **Environment variables** → **Add a variable**.
2. Key: `TEACHER_CODE`. Value: a code you invent, e.g. `GreenMango-2026`. Save.
3. Go to **Deploys** → **Trigger deploy** → **Deploy site** so the setting takes effect.

Keep the code private. Give it only to teachers.

## Step 4 — First use

1. Open your site → **Create account** → choose **Teacher** → enter your name, a username, a password, and the teacher access code.
2. Share the site address with your students. Each student chooses **Student**, makes a username and password, and (optionally) types their section, e.g. `6B`.
3. After signing up, each student's dashboard shows a **6-character parent code**. They give it to their parent.
4. A parent opens the site → **Create account** → **Parent** → types that code. They can add more children later with **Link another child**.

## Everyday use

- **Students**: open a course, set each chapter to *Reading* or *Done*. Tap **Practise** on a Maths chapter to open the interactive questions for that chapter.
- **Parents**: sign in to see progress, practice stars and teacher notes. It's read-only.
- **Teachers**: click any student to edit chapter status, write a note (parents and the student can see it), or reset a forgotten password. **Export CSV** downloads the class table for Excel or Google Sheets. Use the CSV as your backup.

---

## Good to know

**Textbooks are not included.** The NCERT books are marked "not to be republished", so the portal links each course to NCERT's own free download page instead of hosting the PDFs itself. (The last two courses link to NCERT's general textbook page. Search for *Khel Yatra* and *Kaushal Bodh* there.)

**Children's privacy.** The site stores only: name, username, an optional section, a scrambled (hashed) password and learning progress. There is no email, phone number or photo. Because the users are children, tell parents what is stored and get their agreement before students sign up. If this is for a school, check with the school's own data-protection rules too.

**Passwords.** Passwords are stored scrambled, never in plain text, and five wrong attempts locks that username for five minutes. There is no "forgot password" email. A teacher resets a student's password from the student's detail panel. If a *teacher* forgets their password, the simplest fix is to create a new teacher account with the access code.

**Sizes and costs.** This is meant for one class or a small school. Netlify's free plan has usage limits, so check their pricing page if you plan to go beyond a few hundred students.

**Progress for the Maths practice** is remembered per student on the device they use. The stars are also saved to the portal, so parents and teachers always see them. If a student switches to a different device, the practice questions start fresh there, but the stars already earned stay in the portal.

## Adding a subject (English, Hindi, Sanskrit…)

Open `netlify/server/courses.mjs` on GitHub (click the pencil icon). Copy one whole block between `{` and `},`, paste it after the last one, then change `id` (a short unique word), `title`, `book`, `emoji`, and the list of chapter names. Commit; Netlify rebuilds automatically. Existing progress is kept.

## Troubleshooting

| What you see | What to do |
|---|---|
| "Teacher sign-up is not switched on yet" | Do Step 3 (set `TEACHER_CODE`, then redeploy). |
| "Incorrect teacher access code" | The code is case-sensitive. Re-check it in Netlify → Environment variables. |
| "Can't reach the server" or the API gives a 404 | In Netlify open **Deploys**, click the latest deploy and look for the function named `api` in the log. If it isn't there, confirm the folder `netlify/functions/api.mjs` and the file `package.json` both made it to GitHub in Step 1. |
| A student's page says "Please sign in again" | Their sign-in expired (after 14 days). Sign in again. |
| Student forgot their password | Teacher view → click the student → **Reset password**. |

## Optional: try it on your own computer first

Needs Node.js 20+ installed. In this folder run `npm install`, then `node tests/dev-server.mjs` and open http://localhost:8888. This preview keeps data only until you stop it, and uses a teacher code of `SCHOOL-123`. `npm test` runs the automated checks.

## What was tested

The sign-up, sign-in, parent-link, teacher and progress logic passes 26 automated checks. A real browser also ran the full journey (student, Maths practice, parent, teacher) against a local copy. The final step, running on Netlify's own servers with Netlify's storage, can only be confirmed once you deploy. If anything in Step 1–3 behaves differently from this guide, the Troubleshooting table covers the usual causes.
