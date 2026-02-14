# Fix: querySrv ETIMEOUT (DNS SRV lookup failing)

## What the error means

**`querySrv ETIMEOUT _mongodb._tcp.db.jmrmhg3.mongodb.net`**

Your machine (or your DNS server) cannot resolve the **SRV record** that `mongodb+srv://` uses. So the connection never gets to TCP or auth — it fails at DNS.

**Fix:** Stop using the SRV connection string and use the **standard** connection string with explicit hostnames. No SRV lookup needed.

---

## Step 1: Use the standard connection string in `.env`

**Replace** your current `MONGODB_URI` line in `.env` with the line below.

Use your **actual** username and password. If the password has special characters, URL-encode them (`@` → `%40`, `#` → `%23`, etc.).

**Standard URI (non-SRV) for your cluster:**

```env
MONGODB_URI=mongodb://admin:admin@ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017/mentorlink?ssl=true&replicaSet=atlas-lycijz6-shard-0&authSource=admin&retryWrites=true&w=majority
```

**What to change:**
- `admin:admin` → your Atlas **username:password**
- Keep everything else the same (hostnames and `replicaSet=atlas-lycijz6-shard-0` are for your cluster).

**Example** if your password is `MyP@ss` (encode `@` as `%40`):

```env
MONGODB_URI=mongodb://admin:MyP%40ss@ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017,ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017/mentorlink?ssl=true&replicaSet=atlas-lycijz6-shard-0&authSource=admin&retryWrites=true&w=majority
```

---

## Step 2: Save and run

1. Save `.env`.
2. Run:
   ```bash
   npm run dev
   ```

You should see something like:
```text
Connecting to MongoDB...
MongoDB Connected: ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net
Server running in development mode on port 5000
```

---

## Differences: SRV vs standard

| | SRV (failing) | Standard (use this) |
|---|----------------|----------------------|
| Scheme | `mongodb+srv://` | `mongodb://` |
| Host | `db.jmrmhg3.mongodb.net` | Full hostnames with `:27017` |
| DNS | Needs SRV record | Normal A/AAAA only |
| Your case | querySrv ETIMEOUT | No SRV → no timeout |

---

## If you get a different cluster later

To get the **standard** connection string from Atlas:

1. Atlas → **Database** → **Connect** → **Connect your application**.
2. Copy the **SRV** string, then open **“Drivers”** / connection options.
3. Look for **“Standard connection string”** or **“Connection string with full host list”** and copy that, or build it from your cluster’s hostnames and replica set name (shown in Atlas or in error messages).

Your current cluster’s replica set name is **`atlas-lycijz6-shard-0`** and the three hosts are the `ac-lycijz6-shard-00-xx.jmrmhg3.mongodb.net` hostnames used above.

---

## Optional: try different DNS

If you prefer to keep using `mongodb+srv://`, you can try:

- Flush DNS: `ipconfig /flushdns`
- Use Google DNS (8.8.8.8) or Cloudflare (1.1.1.1) on your PC or router

Often the most reliable fix is still to **use the standard connection string** and avoid SRV entirely.
