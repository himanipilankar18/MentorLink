# Fix "TCP works but driver still fails" – Checklist

Do these **in order**. After each step, run `npm run dev` and see if it connects.

---

## Step 1: Use standard URI (no SRV) + authSource

SRV can timeout; standard URI avoids that. Always include `authSource=admin` for Atlas.

**In `.env`, set exactly (use your real username and password):**

```env
MONGODB_URI=mongodb://admin:admin@ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017/mentorlink?ssl=true&replicaSet=atlas-lycijz6-shard-0&authSource=admin&retryWrites=true&w=majority
```

- Replace `admin:admin` with your Atlas **username:password**.
- If password has `@` or `#`, encode: `@` → `%40`, `#` → `%23`.

Then run: `npm run dev`

---

## Step 2: If still failing – try TLS bypass (dev only)

Add this line to `.env`:

```env
ATLAS_TLS_INSECURE=1
```

Keep the same `MONGODB_URI` from Step 1. Run `npm run dev` again.

- If it **connects** → your machine has a TLS/cert issue; you can keep `ATLAS_TLS_INSECURE=1` for local dev only (remove in production).
- If it **still fails** → go to Step 3.

---

## Step 3: Confirm user and password in Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Database Access**.
2. Find your user (e.g. `admin`).
3. Click **Edit** → **Edit Password**.
4. Set a **new simple password** (e.g. only letters and numbers, no `@ # $`).
5. Copy that password and in `.env` use it in the URI:
   ```env
   MONGODB_URI=mongodb://admin:YOUR_NEW_PASSWORD@ac-lycijz6-shard-00-00...
   ```
6. Ensure the user has role **Atlas admin** or **Read and write to any database**.
7. Run `npm run dev` again.

---

## Step 4: Example `.env` (copy and adjust)

```env
PORT=5000
NODE_ENV=development

# Standard URI (no SRV). Replace admin:admin with your username:password
MONGODB_URI=mongodb://admin:admin@ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017/mentorlink?ssl=true&replicaSet=atlas-lycijz6-shard-0&authSource=admin&retryWrites=true&w=majority

# Only if Step 2 needed for TLS (dev only)
# ATLAS_TLS_INSECURE=1

JWT_SECRET=97fc4f6662906117eceddf323a86c88ed8c5f881c23da40d403d9b392407126c9b5c9e0ad34320ef6afe875970ba1677d51039c59764a8e95f0a1774eb338941
JWT_EXPIRE=7d
ALLOWED_DOMAINS=spit.ac.in
```

---

## Quick reference

| Step | Action |
|------|--------|
| 1 | Use standard URI + `authSource=admin`, correct user:pass in `.env` → `npm run dev` |
| 2 | Add `ATLAS_TLS_INSECURE=1` to `.env` → `npm run dev` |
| 3 | Reset password in Atlas, use new password in URI, check user role → `npm run dev` |

Start with Step 1; that fixes most cases.
