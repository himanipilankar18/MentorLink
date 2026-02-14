# TCP Works but MongoDB Still Fails → TLS or Auth

If `node scripts/check-atlas-reachability.js` **succeeds** but `npm run dev` still shows "all replica set members Unknown", the problem is **after** TCP: either **TLS handshake** or **authentication**.

Do these in order.

---

## 1. Fix connection string (auth)

### 1.1 Username and password

- Get the **exact** username and password from Atlas: **Database Access** → your user.
- In `.env`, `MONGODB_URI` must use that username and password (no typos, no extra spaces).

### 1.2 Special characters in password

If the password contains `@ # $ % & / : ? =`, encode them in the URI:

| Character | Use in URI |
|-----------|------------|
| `@`       | `%40`      |
| `#`       | `%23`      |
| `$`       | `%24`      |
| `%`       | `%25`      |
| `&`       | `%26`      |
| `/`       | `%2F`      |
| `:`       | `%3A`      |
| `?`       | `%3F`      |
| `=`       | `%3D`      |

Example: password `P@ss#1` → in URI use `P%40ss%231`.

### 1.3 Add `authSource=admin` (very common fix)

Atlas often creates the user in the **admin** database. If you don’t set `authSource`, the driver may use the application database and auth can fail.

**In `.env`, change:**

```env
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**To:**

```env
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority&authSource=admin
```

Only add `&authSource=admin` at the end of the query string. Use your real username/password (and encoded chars if needed).

---

## 2. Test TLS (if auth looks correct)

If the connection string is correct and it still fails, try relaxing TLS once to see if it’s a certificate issue (e.g. on some Windows/Node setups).

**In `.env` add:**

```env
ATLAS_TLS_INSECURE=1
```

Then run:

```bash
npm run dev
```

- If it **connects** with `ATLAS_TLS_INSECURE=1`, the problem is TLS/cert validation on your machine. You can leave this for local dev only, but **remove it in production**.
- If it **still fails**, the issue is almost certainly username/password or `authSource` (step 1).

---

## 3. Verify user in Atlas

1. Atlas → **Database Access**.
2. Find your user (e.g. `admin`).
3. Ensure:
   - Password is correct (or reset it and update `.env`).
   - Built-in Role: **Atlas admin** or **Read and write to any database** (or equivalent).

---

## 4. Example `.env` (format only)

```env
# Correct format (no quotes, no spaces around =)
# authSource=admin often fixes "TCP works but connection fails"
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority&authSource=admin

# Optional: only if you need to test TLS cert issues (dev only)
# ATLAS_TLS_INSECURE=1
```

Use your real username, password (with special chars encoded), and cluster host.

---

## Summary

| Step | Action |
|------|--------|
| 1   | Add **`&authSource=admin`** to `MONGODB_URI` in `.env`. |
| 2   | Run `npm run dev` again. |
| 3   | If it still fails, check username/password and encoding (step 1.1–1.2). |
| 4   | Optionally set `ATLAS_TLS_INSECURE=1` to test TLS; remove in production. |

Most of the time when TCP works but the driver doesn’t, **adding `authSource=admin`** fixes it.
