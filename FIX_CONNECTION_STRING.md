# Fix Your MongoDB Atlas Connection String

## 🔴 Current Issue

Your connection string in `.env` is:
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
```

**Problems:**
1. ❌ Missing database name (`/mentorlink`) before the `?`
2. ❌ Wrong query parameters (`?appName=DB` instead of `?retryWrites=true&w=majority`)
3. ❌ Cluster name format looks unusual (`db.jmrmhg3.mongodb.net`)

---

## ✅ Correct Format

Your connection string should be:
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**Key Changes:**
1. ✅ Added `/mentorlink` (database name) before `?`
2. ✅ Changed `?appName=DB` to `?retryWrites=true&w=majority`

---

## 🔧 Step-by-Step Fix

### Step 1: Get Correct Connection String from Atlas

1. **Go to MongoDB Atlas Dashboard**
   - Login at [cloud.mongodb.com](https://cloud.mongodb.com)

2. **Navigate to Connect**
   - Click **"Database"** (left sidebar)
   - Click **"Connect"** button on your cluster

3. **Choose Connection Method**
   - Click **"Connect your application"**
   - **Driver**: Node.js
   - **Version**: 5.5 or later

4. **Copy the Connection String**
   - You'll see something like:
     ```
     mongodb+srv://admin:<password>@db.jmrmhg3.mongodb.net/?retryWrites=true&w=majority
     ```

### Step 2: Update Your .env File

**Replace your current MONGODB_URI with:**

```env
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**Important:**
- Add `/mentorlink` before the `?` (this is your database name)
- Keep `?retryWrites=true&w=majority` at the end
- No quotes, no spaces

### Step 3: Verify Network Access

1. **Go to Network Access** in Atlas
   - Click **"Network Access"** (left sidebar)
   - Click **"Add IP Address"**
   - Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - **Wait 1-2 minutes** for changes to apply

### Step 4: Verify Database User

1. **Go to Database Access** in Atlas
   - Click **"Database Access"** (left sidebar)
   - Verify user `admin` exists
   - Check password is correct
   - Verify user has **"Atlas admin"** or **"Read and write to any database"** privileges

### Step 5: Test Connection

```bash
node test-atlas-connection.js
```

Or restart your server:
```bash
npm run dev
```

---

## 🔍 If Still Getting ECONNREFUSED

### Solution 1: Flush DNS Cache
```bash
# Windows
ipconfig /flushdns

# macOS/Linux
sudo dscacheutil -flushcache
```

Then restart your server.

### Solution 2: Check Connection String Format

Make sure it follows this exact pattern:
```
mongodb+srv://[username]:[password]@[cluster]/[database]?retryWrites=true&w=majority
```

**Your corrected version:**
```
mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

### Solution 3: Verify Credentials

1. **Check username**: Should be `admin` (or your database user)
2. **Check password**: Should match Atlas database user password
3. **URL-encode special characters** if password has them:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`

### Solution 4: Use Non-SRV Connection String

If SRV still doesn't work:

1. In Atlas → Connect → Connect your application
2. Look for **"Connection String Options"**
3. Copy the **non-SRV** connection string
4. Format: `mongodb://admin:admin@db.jmrmhg3.mongodb.net:27017/mentorlink?ssl=true&retryWrites=true&w=majority`

### Solution 5: Check Cluster Status

1. Go to Atlas Dashboard
2. Check if cluster status is **"Active"** (green)
3. If paused, click **"Resume"**

---

## ✅ Corrected .env File

Here's your complete corrected `.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=97fc4f6662906117eceddf323a86c88ed8c5f881c23da40d403d9b392407126c9b5c9e0ad34320ef6afe875970ba1677d51039c59764a8e95f0a1774eb338941
JWT_EXPIRE=7d

# Allowed Institute Email Domains (comma-separated)
ALLOWED_DOMAINS=spit.ac.in
```

**Key Fix:** Added `/mentorlink` and changed query parameters.

---

## 🧪 Test After Fix

1. **Save your `.env` file**
2. **Restart server:**
   ```bash
   # Stop with Ctrl+C, then:
   npm run dev
   ```

3. **Expected Output:**
   ```
   MongoDB Connected: db.jmrmhg3.mongodb.net
   Server running in development mode on port 5000
   ```

---

## 📝 Quick Checklist

- [ ] Connection string has `/mentorlink` before `?`
- [ ] Query parameters are `?retryWrites=true&w=majority`
- [ ] IP address whitelisted in Atlas (waited 2 minutes)
- [ ] Database user exists with correct password
- [ ] Cluster is active/running
- [ ] `.env` file has no quotes, no spaces around `=`
- [ ] Flushed DNS cache
- [ ] Restarted server after changes

---

## 🎯 Most Common Fix

**90% of the time**, the issue is:
1. Missing database name in connection string
2. IP not whitelisted (or didn't wait long enough)

**Quick fix:**
1. Add `/mentorlink` to your connection string
2. Whitelist IP in Atlas (wait 2 minutes)
3. Restart server

---

**After making these changes, your connection should work!** 🚀
