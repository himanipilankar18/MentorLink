# MentorLink – Institute Email Verification Options

Goal: **Only real, institute‑issued SPIT email IDs** should be able to register, not just anything that ends with `@spit.ac.in`.

Below are implementation options with pros/cons so we can pick what is feasible.

---

## 1. Standard Email OTP / Link Verification (Domain‑Restricted)

**Idea:** Keep the current domain check (`@spit.ac.in`) but also send a one‑time verification link or OTP to that address. Account is activated only after the link is clicked / OTP is entered.

- **Flow:**
  - User enters name, SPIT email, password, etc.
  - Backend checks domain = `spit.ac.in`.
  - Backend creates a temporary user with status `pending` and generates a signed token.
  - System sends verification link: `https://yourdomain/verify?token=...` or 6‑digit OTP.
  - User must click link or enter OTP → backend marks user as `active`.

- **Pros:**
  - Simple, standard, and works with your existing stack.
  - Proves user **controls that mailbox**, which is usually enough in practice.

- **Cons:**
  - Does *not* guarantee that the email is an “official” SPIT ID (but if only the institute can create those accounts, this is practically good enough).
  - Requires SMTP / email sending setup (e.g. Gmail SMTP, SendGrid, etc.).

**When this is enough:** If SPIT already restricts who can get a `@spit.ac.in` address, OTP verification + domain filter is usually accepted as “valid SPIT email only”.

---

## 2. Official Whitelist of Valid SPIT Emails (CSV / DB)

**Idea:** Get an official list of valid SPIT email IDs (or roll numbers + email) from the institute and only allow registration if the email exists in that list.

- **Flow:**
  - Admin uploads a CSV like: `rollNo, name, officialEmail` (once per semester or year).
  - Backend stores this in a `WhitelistedEmail` (or `StudentMaster`) collection/table.
  - During registration:
    - Check domain is `spit.ac.in`.
    - Look up email in whitelist; if not found → reject.
    - Optionally require matching rollNo or DOB as extra check.

- **Pros:**
  - Very strong guarantee: only institute‑issued emails present in the master list can register.
  - No dependence on mail server behavior.

- **Cons:**
  - Requires cooperation from college admin/IT to provide/update the master list.
  - Need an admin interface or script to upload/refresh the list.

**Best for:** Formal deployment when you can coordinate with the institute.

---

## 3. Pattern + Roll‑Number Validation (Heuristic)

**Idea:** If SPIT emails follow a strict pattern (e.g. `yearbranchroll@spit.ac.in`), encode that pattern as validation logic.

- **Flow:**
  - Back‑end regex and custom validator for the local part before `@spit.ac.in`:
    - Example (pseudo): `^[0-9]{4}[A-Z]{2}[0-9]{3}@spit\.ac\.in$`
  - Optionally cross‑check: entered year/department in the form matches what is inferred from the email pattern.

- **Pros:**
  - No integration or lists required if the pattern is stable.
  - Filters out “randomname@spit.ac.in” that doesn’t match institute pattern.

- **Cons:**
  - Only as strong as the pattern; if institute ever changes email format, validation must be updated.
  - Still doesn’t 100% prove the mailbox exists (but makes faking harder).

**Best for:** Quick improvement today, especially if you know the exact SPIT email format.

---

## 4. Integration with Institute SSO / Directory (Best but Hardest)

**Idea:** Use the college’s authentication system instead of your own passwords, e.g.:

- Google Workspace / Microsoft Entra ID SSO (if SPIT uses Google or Microsoft for email).
- LDAP / Active Directory login against campus directory.

- **Flow (Google example):**
  - “Login with Google” button.
  - OAuth2 flow restricted to `@spit.ac.in` domain using hosted domain or GSuite domain restriction.
  - Token from Google proves the account is a real SPIT Google account.

- **Pros:**
  - Strongest proof of validity – you never manage passwords.
  - Students use their existing institute login.

- **Cons:**
  - Needs admin access to set up OAuth / client IDs.
  - More setup + coordination; may not be possible for a college project environment.

**Best for:** Final production version if you can get access/approval from institute IT.

---

## 5. SMTP “VRFY” / “RCPT TO” Probing (Not Recommended)

**Idea:** Talk to the mail server directly and see if it accepts the address.

- Many modern mail servers **disable VRFY** and always accept RCPT TO to prevent user enumeration.
- Even when it works, it’s brittle and can be flagged as abuse.

**Conclusion:** Mentionable theoretically, but not a good real‑world solution here.

---

## Recommended Practical Approach for MentorLink

Given this is a college major project and you **already**:

- Restrict to `@spit.ac.in`, and
- Have working JWT auth and backend,

a realistic, implementable path is:

1. **Short term (for demo + weekly reports):**
   - Keep `@spit.ac.in` domain validation.
   - Add **email verification via OTP or link** to ensure the user controls that SPIT mailbox.
   - (Optional) Implement simple pattern check if SPIT email format is well known.

2. **Medium term (if you can get data from college):**
   - Add a **whitelist master collection** of valid emails/roll numbers.
   - Registration = `domain check` + `whitelist check` + `email verification`.

3. **Long term (ideal production):**
   - Integrate with **institute SSO** (Google/Microsoft/LDAP) so students log in directly with their official account.

We can now pick which of these to actually build next (e.g. implement OTP‑based verification + optional pattern check) depending on what’s feasible for you right now.

