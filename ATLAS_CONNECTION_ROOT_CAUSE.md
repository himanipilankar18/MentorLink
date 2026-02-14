# Atlas Connection: Root Cause & Fix

## What was wrong

### 1. Server started before DB connected

**Before:** `connectDB()` was called but **not awaited**. So:

1. `connectDB()` started (async).
2. `app.listen(PORT, ...)` ran **immediately**.
3. You saw "Server running on port 5000".
4. MongoDB then failed in the background.
5. You only saw the generic driver message: *"Could not connect to any servers..."*.

So the **real** error (auth, TLS, replica set, etc.) was hidden, and it looked like an IP whitelist issue.

**After:** We use `async function startServer()` and **await connectDB()** before calling `app.listen()`. So:

1. "Connecting to MongoDB..." is logged.
2. If MongoDB fails → full error is printed and process exits (no "Server running").
3. If MongoDB succeeds → then we start the HTTP server.

So you now see the **actual** failure reason.

---

### 2. Only `error.message` was logged

**Before:** `console.error("MongoDB Connection Error:", error.message)` — so you only got the generic message.

**After:** We log the **full error object** plus `error.name`, `error.reason`, `error.code` so you can tell:

- **Authentication failed** → wrong user/password or encoding.
- **TLS / certificate** → `error.reason` or stack will mention TLS.
- **Replica set / topology** → driver or `reason` will mention it.
- **Timeout** → `serverSelectionTimeoutMS` or network.

---

## Correct MONGODB_URI format

Use this pattern (replace `username`, `password`, cluster host, and DB name):

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
```

Rules:

1. **Database name:** Must appear **before** `?`. Example: `...mongodb.net/mentorlink?retryWrites=...`
2. **Query string:** Use `?retryWrites=true&w=majority` (not `?appName=DB`).
3. **Password:** If it contains `@ # $ % & / : ? =`, URL-encode them (e.g. `@` → `%40`, `#` → `%23`).
4. **No quotes** around the value in `.env`, no spaces around `=`.

Example (password is `P@ss#1`):

```env
MONGODB_URI=mongodb+srv://admin:P%40ss%231@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

---

## Corrected server.js pattern

- `require('dotenv').config()` at the top.
- Single entry point: `async function startServer()`.
- **Await** `connectDB()` before calling `app.listen()`.
- On connection failure: log full error and `process.exit(1)`.

So the server only prints "Server running" **after** MongoDB is connected, and any failure gives you the real root cause in the logs.

---

## What to do next

1. Run again: `npm run dev`.
2. If it still fails, check the **full error** in the console (message, name, reason, code, full object).
3. Use that to fix:
   - **Authentication** → user/password and encoding in `MONGODB_URI`.
   - **URI format** → database name and `?retryWrites=true&w=majority` as above.

The updated `server.js` and `config/database.js` implement this behavior and logging.
