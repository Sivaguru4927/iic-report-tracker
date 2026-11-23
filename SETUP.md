# IIC REPORT TRACKER — Setup (Supabase + Netlify)

Two pages, one database:

| Page | Address | Who uses it |
|---|---|---|
| Tracker (sign in) | `https://iicactivitytracker.netlify.app` | CII&E coordinator — verify, remarks, summary, departments |
| Submission page | `https://iicactivitytracker.netlify.app/submit` | Departments — fields 1–7 with the Word file, no login |

Files in this folder:

- `index.html` + `admin.js` — the tracker
- `submit.html` + `submit.js` — the department page
- `common.js`, `styles.css` — shared code and design
- `export.js` — Excel and PDF downloads
- `dashboard.js` — the Dashboard tab
- `combo.js` — type-to-search Department field on the submission page
- `categories.js` — Reports by activity type (edit the keyword list at the top to add or change types)
- `config.js` — **your Supabase details go here**
- `templates/IIC_Report_Template.docx` — the IIC event report format departments download (replace this file to change it)
- `supabase-setup.sql` — run once in Supabase
- `supabase-update-email.sql` — only if you ran the setup before the Email column was added
- `supabase-update-submission-email.sql` — only if you ran the setup before the Email field was added to the submission page (then run `supabase-email-notifications.sql` again too)
- `supabase-update-dashboard.sql` — run this once if you set up before November 2026 (Activity type, NIRF Innovation 2025 / NISP gap dashboard, all months in Month of activity). Safe to run again.
- `framework.js` — IIC 9.0 calendar, important days, NISP and NIRF Innovation 2025 lists, and the Dashboard gap analysis (edit the lists here if MIC / NIRF change them)
- `supabase-update-queries-tab.sql` — only if you set up before the Queries tab was added (run `supabase-update-query.sql` first if you haven't; then run `supabase-email-notifications.sql` again and paste the new `Code.gs`)
- `supabase-update-query.sql` — only if you set up before the Queries / Difficulties field was added (then run `supabase-email-notifications.sql` again too, and paste the new `Code.gs`)
- `supabase-update-month.sql` — only if you set up before the Month field was added (then run `supabase-email-notifications.sql` again too, and paste the new `Code.gs`)
- `supabase-email-notifications.sql` + `apps-script/Code.gs` — email notifications (Step 8) and Google Drive storage for report files (Step 9)
- `supabase-update-drive.sql` — Step 9, only if you set up before Drive storage was added
- `supabase-update-ai.sql` — Step 10, only if you set up before the AI report check was added
- `docxformat.js` — the AI formatting agent: formats each uploaded Word report to the CII&E style before upload
- `supabase-update-format.sql` — adds the *Formatted* mark on reports (run once)
- `supabase-update-deadline.sql` — only if you set up before the submission deadline (10th of the next month) was added
- `_redirects` — makes `/submit` work on Netlify

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com and sign in (use the CII&E Google account if you like).
2. Click **New project**.
   - Name: `iic-tracker`
   - Database password: choose one and keep it safe (you won't need it day to day).
   - Region: **South Asia (Mumbai)**.
3. Wait about two minutes for the project to finish setting up.

## Step 2 — Run the setup script

1. Open `supabase-setup.sql` in Notepad. On the last lines, check the admin email
   (`ecell@psgcas.ac.in`). Change it, or add more lines, if other coordinators need access:
   ```sql
   insert into public.admins (email) values ('ecell@psgcas.ac.in') on conflict (email) do nothing;
   insert into public.admins (email) values ('another@psgcas.ac.in') on conflict (email) do nothing;
   ```
2. In Supabase, open **SQL Editor** (left menu) → **New query**.
3. Paste the whole file and click **Run**. You should see "Success. No rows returned".

This creates the departments and reports tables, a private storage bucket for the Word files
(.docx only, 5 MB max), and the security rules:

- Departments can **only submit** new reports. They can't see other departments' mobile numbers or edit anything.
- Only emails in the admin list can view all reports, verify, add remarks, delete, download files and manage departments.

## Step 3 — Create your coordinator login

1. In Supabase, go to **Authentication → Users → Add user → Create new user**.
2. Enter the same email as in the admin list and a password. Tick **Auto Confirm User**. Click **Create user**.
3. Go to **Authentication → Sign In / Providers** (called "Providers" or "Settings" in some versions) and turn **off**
   "Allow new users to sign up". Only you add users from now on.

## Step 4 — Connect the pages to Supabase

1. In Supabase, go to **Project Settings → API** (or **Data API**).
2. Copy **Project URL** and the **anon public** key.
3. Open `config.js` and paste them:
   ```js
   SUPABASE_URL: "https://abcdefghijkl.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
   Use the **anon public** key only. Never paste the `service_role` key.
4. Save the file.

## Step 5 — Put it on Netlify

**Easiest (drag and drop):**
1. Sign in at https://app.netlify.com.
2. **Add new site → Deploy manually**.
3. Drag the whole `iic-tracker-netlify` folder onto the page.
4. Go to **Site configuration → Change site name** and set it to `iicactivitytracker`.
   Your site is now at `https://iicactivitytracker.netlify.app`.

**To update later:** open the site in Netlify → **Deploys** → drag the folder again.

## Step 6 — Allow your site's address for sign-in

In Supabase → **Authentication → URL Configuration**:
- Site URL: `https://iicactivitytracker.netlify.app`

## Step 7 — First run

1. Open `https://iicactivitytracker.netlify.app` and sign in with the user from Step 3.
2. In **Departments & faculty**, add the departments (or paste from Excel: Aided/SF, Department, Faculty, Mobile, Email).
3. Click **Open submission page**, submit one test report with a small .docx file.
4. Back on the tracker, the report appears in **All reports** (press Refresh if needed).
   Change its verification status, add a remark, and check the submission page shows the update.
5. Delete the test report.

Then send departments this link: **https://iicactivitytracker.netlify.app/submit**

## Step 8 — Email notifications (acknowledgement, verification, monthly reminders)

What gets emailed:
- **Acknowledgement** to the faculty member when their department submits a report.
- **Verification result** when you set a report to Verified, Returned for Correction or Rejected (with your remarks).
- **Reminder at 10:00 AM on the 20th of every month** to departments with no report submitted that month,
  plus a summary email to you listing who was reminded.

Emails are sent from your own Google account through a small Google Apps Script, so they come from
`iic@psgcas.ac.in` and replies come back to that inbox.

**8a. Install the email part in Supabase**
1. Supabase → **SQL Editor → New query**, paste all of `supabase-email-notifications.sql`, click **Run**.
2. Reload the tracker and open the new **Emails** tab. Copy the **Secret** shown there.

**8b. Create the Apps Script** (signed in to **iic@psgcas.ac.in**, the account all emails are sent from)
1. Sign in to Google as **iic@psgcas.ac.in** (use a private/incognito window if you're signed in to another account), go to https://script.google.com → **New project**. Rename it `IIC Tracker Emails`.
2. Delete the sample code, paste all of `apps-script/Code.gs`.
3. On the line `const SECRET = '…'`, paste the secret from the Emails tab between the quotes.
   Check the signature lines (`SIGNATURE_HTML`) and change them if needed. Press **Save** (disk icon).
4. In the function list at the top choose **authoriseAndTest** and click **Run**. Allow the permissions
   (if you see "Google hasn't verified this app": **Advanced → Go to IIC Tracker Emails**).
   You'll receive an email saying the script is authorised.
5. Click **Deploy → New deployment** → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

**8c. Connect them**
1. In the tracker's **Emails** tab, paste the Web app URL into **Apps Script web app link**.
2. Set the coordinator email to `iic@psgcas.ac.in` (it gets the monthly summary and is the reply-to address), check the site address, keep **Send reminders automatically** ticked, click **Save settings**.
3. Click **Send test email**. It should arrive within a minute, and the **Email log** shows *Sent to Google*.

**Important:**
- Add an **email for every faculty member** in Departments & faculty. If one is missing, their
  acknowledgement and verification emails come to you instead, and their monthly reminder is skipped
  (the summary email lists them).
- When verifying, **type the remarks first, then change the status**. The email goes out when the status changes.
- "Inactive" means the department has **no report submitted in the current calendar month** by the 20th.
- If you edit `Code.gs` later: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**.
  The link stays the same.
- Google's sending limit is about 1,500 emails a day for a college (Workspace) account and 100 a day for a personal Gmail.


## Step 9 — Keep report files in Google Drive (iic@psgcas.ac.in)

Supabase's free plan has 1 GB of file storage. With this step, every uploaded Word file is moved
into a Drive folder of **iic@psgcas.ac.in** within 5 minutes, then deleted from Supabase.
Departments still upload on the same page; nothing changes for them.

Drive folder layout: `IIC Report Tracker – Reports / IIC year 2026-27 / Quarter 1 / Aided – B.Sc Botany /`
`November 2026 – <report title> – <faculty>.docx`

**9a. Supabase**
1. **SQL Editor → New query**, paste all of `supabase-update-drive.sql`, **Run** (result: *Drive storage columns installed*).
2. **Project Settings → API Keys** (or **API**). Copy the **service_role** key (legacy tab) or a **Secret key** (`sb_secret_…`).
   This key can read and change everything — it goes only into the Apps Script below, never into `config.js` or a web page.

**9b. Apps Script** (the same `IIC Tracker Emails` project, signed in as iic@psgcas.ac.in)
1. Paste the new `apps-script/Code.gs` over the old code. Put your secret back in `const SECRET = '…'`.
2. In `const SUPABASE_URL = '…'`, paste your Supabase Project URL (the same as in `config.js`).
3. Check `SHARE_WITH` — the coordinators who open files from the tracker (default `ecell@psgcas.ac.in`). Press **Save**.
4. **Project Settings** (gear icon, left) → **Script properties → Add script property**:
   Property `SUPABASE_SERVICE_KEY`, Value: the key from 9a. **Save script properties**.
5. Back in **Editor**, choose **setupDriveStorage** in the function list and click **Run**. Allow the new
   permissions (Drive and "connect to an external service").
   You get an email "Drive storage is set up" with the folder link. It moves existing files 25 at a time, every 5 minutes.
6. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** (keeps the emails working with the new code).

**In the tracker:** All reports shows **Open in Drive** for files already moved (sign in to Google as
ecell@psgcas.ac.in or iic@psgcas.ac.in to open them). Files not moved yet still show **Download**.
The Excel download has a **Drive link** column. Deleting a report in the tracker doesn't delete its Drive file; the tracker shows a link to delete it there.

To see what the mover did: Apps Script → **Executions** (left menu).

---


## Step 10 — AI report check (optional)

An AI agent reads every new report after it reaches Drive and checks it against the
**IIC Event Report Format template** (`templates/IIC_Report_Template.docx`, the one on the submission page), 20 checks:
header; **title must contain Innovation / Entrepreneurship / Incubation / Start-Up / IPR**; details block (date, time,
duration, internal/external participants, category, theme, lead by, level 1–4, mode); department and month match;
expert details; Outcome; Objective (100+ words); Benefits (250+); Brief Description (500+); photographs with captions;
Key Highlights (250+); 2–3 feedback entries; organising team; permission letter, poster and signed attendance;
social media links; no template blanks left (____, dd.mm.yyyy, (Eg: …)); consistent details; formal style;
**content relevant to the title** (critical, T19); content fits the theme and Activity type (T20). The title words, leftover template blanks and the number of images (at least 5) are
checked by the script itself, not the AI. It runs inside the same Apps Script, every 5 minutes.

- **Relevance to the title (T19):** the AI names the subject of the event title, reads every section (objective,
  description, highlights, benefits, outcome, speaker topic, photo captions) and gives a relevance score out of 100
  with the off-topic sections. Below `AI_RELEVANCE_MIN_` (60), or when the title in the report differs from the
  title entered on the submission page, the report is returned with the sections to rewrite. The score shows in
  the report's AI check box in All reports.
- **Score:** starts at 100; each failed critical check −15, each other check −5.
- **Decision:** *Verified* only if no critical check fails and the score is at least `AI_PASS_SCORE` (70);
  otherwise *Returned for Correction*. The AI never rejects a report.
- In `AI_MODE = 'auto'` the AI sets the verification status and remarks, and the department gets the usual
  verification email with the list of corrections. In `'suggest'` it only shows its review in the tracker.
- It only touches reports that are still **Pending Verification**, so your own decisions are never overwritten.
  Older pending reports are checked too.
- The rules are in `AI_CHECKS_` near the end of `Code.gs` (with `PLACEHOLDERS_` and `MIN_IMAGES_`; the title-keyword check T2 is switched off); edit them there if the template changes.

**10a.** Supabase → SQL Editor: run `supabase-update-ai.sql` (result: *AI check columns installed*).

**10b.** Get an AI API key, one of:
- **Claude (Anthropic):** https://console.anthropic.com → API Keys → Create key (paid per use). Keep `AI_PROVIDER = 'claude'`.
- **Gemini (Google):** https://aistudio.google.com → Get API key. Set `AI_PROVIDER = 'gemini'` and `AI_MODEL` to a model
  name listed in AI Studio.

**10c.** Apps Script (signed in as iic@psgcas.ac.in):
1. Paste the new `Code.gs` over the old code. Put back `SECRET` and `SUPABASE_URL` as before. Check the `AI_…` lines. Save.
2. Project Settings → Script properties → **Add script property**: Property `AI_API_KEY`, Value: your key. Save.
3. Editor → choose **testAiCheck** → **Run**. The log shows the score, each check and the remarks for the latest report.
   Nothing is saved by this test.
4. Deploy → Manage deployments → Edit → New version → Deploy.

From then on the AI check runs with the 5-minute Drive mover. In **All reports**, each report shows
**AI 85/100 · Verified** (click it for the failed checks) and a **Check again** button, which sets the report back to
Pending Verification and re-runs the check. The Excel download has an **AI check** column.

The report text (including student names and register numbers in the feedback) is sent to the AI provider you choose.

---

## AI formatting agent (Word reports)

When a department picks its Word file on the submission page, the page formats it before upload, in the browser:
Times New Roman everywhere; main headings 16 pt bold, subheadings 14 pt bold, body 12 pt justified; letterhead colours of the
sample report (college name navy, IIC line pink, event title green, Date/Time/Internal/External/Duration/Mode labels red);
PSGCAS logo (left) and IIC logo (right) beside the letterhead if missing (taken from `templates/IIC_Report_Template.docx`);
0.75 in side margins, consistent spacing, tables with a shaded header row, oversized photos scaled to the page.
No words are added, removed or changed. The department sees "✓ Formatted …" with a *Preview the formatted file* link, and the
formatted file is what gets uploaded. If a file can't be formatted it is uploaded as it is. In **All reports** formatted files show a
green *Formatted* mark. Run `supabase-update-format.sql` once so the mark is saved.

## Good to know

- **Submission deadline.** A month's report is accepted during that month and until the **10th of the next month** (India time).
  After that the submission page and the database refuse it, and the department is told to email the report to iic@psgcas.ac.in
  (or explain the delay in field 11). **All reports** has a *Late submission* column (On time / Late · N days) and a filter.
  **Coordinator late entries:** sign in to the tracker, then click **Add a previous month's report** (or open `/submit` in the
  same browser). The page then accepts months whose deadline has passed; the report is marked
  "Late entry added by the CII&E coordinator on …".
  To change the 10 days, edit `GRACE_DAYS` in `common.js` and the `'9 days'` in `public.report_window` (supabase-update-deadline.sql).

- **No login for departments.** Anyone with the submission link can submit, but only for departments
  and faculty you have added, and only as "Submitted / Pending Verification". Keep the link within the college.
- **Mobile numbers and emails** you add are shown on the submission page when a faculty member is picked
  (the auto-fill needs them). Anyone with the link can see them that way.
- If a faculty member has **no email on record**, the submission page lets them type one. It's saved with
  that report and used for its acknowledgement and verification emails. Add it in Departments & faculty to make it permanent.
- **Free plan limits** (Supabase): 1 GB file storage and 500 MB database. With Step 9 the files live in Google Drive, so the 1 GB isn't used up.
  A free project pauses after 7 days with no activity; open the tracker at least once a week, or
  restore it from the Supabase dashboard if it pauses.
- **Adding another coordinator:** add their email to the admin list (SQL Editor:
  `insert into public.admins (email) values ('name@psgcas.ac.in');`) and create their user in Step 3.
- **Forgot password:** Supabase → Authentication → Users → the user's menu → Send password recovery,
  or set a new password there.

## If something goes wrong

| What you see | Fix |
|---|---|
| "Setup needed" on the page | `config.js` still has the placeholder values. Paste the URL and anon key, redeploy. |
| "This account isn't on the coordinator list" | Your email isn't in `admins`. Run the insert line from Step 2 with your email. |
| "Email or password is incorrect" | Reset the password in Supabase → Authentication → Users. |
| Department sees "This department and faculty are not on the list" | Add them in **Departments & faculty**, then the department reloads the page. |
| `/submit` shows "Page not found" | The `_redirects` file wasn't uploaded. Drag the whole folder again. |
| New reports don't appear by themselves | Press **Refresh**. Live updates need the last part of the SQL script; run the script again. |
| Emails tab says "not installed yet" | Run `supabase-email-notifications.sql` (Step 8a), then reload. |
| Email log shows "Not sent — email link not set up yet" | Paste the Apps Script Web app URL in the Emails tab and save (Step 8c). |
| Log says "Sent to Google" but no email arrives | The secret in `Code.gs` doesn't match the Emails tab, or the script wasn't redeployed after editing. Fix and redeploy as a New version. Also check Spam. |
| Log shows "Failed (401/403)" | The deployment's "Who has access" isn't **Anyone**. If your college account doesn't allow "Anyone", create the script from a personal Gmail account instead (emails will come from that address). |
| No reminders arrived on the 20th | The Supabase free project may have been paused. Open the tracker weekly; use **Send this month's reminders now** to catch up. |


## NIRF / NISP classification of reports

Every report is classified under the NIRF Innovation Rankings 2025 components and the NISP 2019 items it supports.
**All reports** has a *NIRF / NISP* column (blue chips = NIRF components, purple = NISP items; hover for the full name)
and a filter for any NIRF parameter or NISP item; the Excel download has the same column. The Dashboard's NIRF and
NISP sections count classified reports automatically.

- **By the AI agent** (Apps Script, Step 10): when a report is checked, the AI also chooses the NIRF components and NISP
  items from the report's content. Shown as "by AI agent".
- **Automatically from the title and activity type** for every other report (old ones, and the artifact version, which
  has no AI). Shown as "auto (title / activity type)".
- A NIRF component or NISP item chosen by the department in *Activity type* is always included.

## Corrected reports (link in the "returned for correction" email)

Run `supabase-update-resubmit.sql` once. The **Submit the corrected report** button in the email then opens
`/submit?fix=<report id>&t=<secret>`: the department sees that report and what to correct, and uploads the corrected
Word file. It **replaces** the earlier file of the same report (no new report is created), the report goes back to
*Pending Verification*, the AI agent checks it again, and a "Corrected report received" email is sent. In Google Drive
the corrected file is saved in the same folder and the earlier file goes to the bin. All reports marks such reports
**Corrected** and has a *Copy correction link* button on returned reports (to send the link again yourself).
