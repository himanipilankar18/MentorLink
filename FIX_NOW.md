# 🚨 FIX YOUR .env FILE NOW

## ✅ Verification Results

Your `.env` file currently has:
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
```

**Issues Found:**
1. ❌ Missing database name (`/mentorlink`)
2. ❌ Wrong query parameters (`?appName=DB`)

---

## 🔧 EXACT FIX - Copy This

### Step 1: Open Your .env File
Located at: `D:\majorproject\MentorLink\.env`

### Step 2: Find This Line
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
```

### Step 3: Replace With This EXACT Line
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**What Changed:**
- `/?appName=DB` → `/mentorlink?retryWrites=true&w=majority`
- Added `/mentorlink` (database name)
- Fixed query parameters

### Step 4: Save the File
Press `Ctrl + S` to save

### Step 5: Verify It's Fixed
```bash
node verify-env.js
```

You should see:
```
✅ Connection string format looks correct!
```

### Step 6: Test Connection
```bash
node test-atlas-connection.js
```

---

## 📋 Complete Corrected .env File

Copy this entire content to your `.env` file:

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

---

## ⚠️ IMPORTANT: Also Check These

### 1. IP Whitelist in Atlas
- Go to [cloud.mongodb.com](https://cloud.mongodb.com)
- Click **"Network Access"** (left sidebar)
- Click **"Add IP Address"**
- Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
- **Wait 2 minutes** for changes to apply

### 2. Flush DNS Cache
```bash
ipconfig /flushdns
```

### 3. Verify Database User
- Go to Atlas → **"Database Access"**
- Verify user `admin` exists
- Check password is `admin` (or update connection string if different)

---

## ✅ After Fixing

1. **Verify .env:**
   ```bash
   node verify-env.js
   ```

2. **Test Connection:**
   ```bash
   node test-atlas-connection.js
   ```

3. **Start Server:**
   ```bash
   npm run dev
   ```

**Expected Output:**
```
✅ Connection string format looks correct!
MongoDB Atlas Connected Successfully
Server running in development mode on port 5000
```

---

## 🎯 Quick Copy-Paste Fix

Just replace this ONE line in your `.env`:

**OLD:**
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
```

**NEW:**
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**That's it!** Save and test again. 🚀
