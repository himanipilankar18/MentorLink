# MentorLink – Send Real Emails to SPIT Inboxes

Follow these steps to send verification emails to real SPIT (@spit.ac.in) inboxes.

---

## Step 1: Get a Gmail App Password (SPIT uses Gmail)

1. Sign in to your **SPIT Gmail** (`@spit.ac.in`) in a browser.
2. Go to **[myaccount.google.com](https://myaccount.google.com)** → **Security**.
3. Turn on **2-Step Verification** if it’s off.
4. Go to **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**.
5. Choose **Mail** → **Other (Custom name)** → type `MentorLink`.
6. Click **Generate** and copy the 16-character password (e.g. `abcd efgh ijkl mnop`).
7. Store this somewhere safe; it won’t be shown again.

---

## Step 2: Add SMTP to your `.env`

1. Open `.env` in the MentorLink project root.
2. Add (or uncomment) these lines and replace the placeholders:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_spit_email@spit.ac.in
SMTP_PASS=abcdefghijklmnop
EMAIL_FROM=MentorLink <your_spit_email@spit.ac.in>
BACKEND_BASE_URL=http://localhost:5000
```

**Replace:**
- `your_spit_email@spit.ac.in` → your real SPIT Gmail address
- `abcdefghijklmnop` → the 16-character App Password (no spaces)

---

## Step 3: Restart the server

```bash
cd c:\Users\Chetan\OneDrive\Desktop\MENTORLINK
npm run dev
```

---

## Step 4: Test the flow

1. Open `http://localhost:5000`.
2. Register a new user with another valid SPIT email (e.g. teammate).
3. Check that inbox for the “Verify your MentorLink email” message.
4. Click the verification link.
5. Log in with that user’s credentials.

---

## Troubleshooting

| Problem | Solution |
|--------|----------|
| “Username and Password not accepted” | Use the **App Password**, not your normal Gmail password. |
| “App passwords” option missing | Enable **2-Step Verification** first. |
| Emails go to spam | Ask recipients to move the first email to Inbox and mark “Not spam”. |
| No SPIT account | Ask faculty/admin for a shared SPIT account for MentorLink. |
