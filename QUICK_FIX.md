# 🚨 QUICK FIX - Connection String Error

## The Problem

Your connection string is missing the database name and has wrong query parameters.

**Current (WRONG):**
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
```

## The Fix

**Change to (CORRECT):**
```
MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
```

## What Changed?

1. ✅ Added `/mentorlink` before the `?` (database name)
2. ✅ Changed `?appName=DB` to `?retryWrites=true&w=majority`

## Steps to Fix

1. **Open your `.env` file**
2. **Find this line:**
   ```
   MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/?appName=DB
   ```
3. **Replace with:**
   ```
   MONGODB_URI=mongodb+srv://admin:admin@db.jmrmhg3.mongodb.net/mentorlink?retryWrites=true&w=majority
   ```
4. **Save the file**
5. **Verify IP Whitelist in Atlas:**
   - Go to Atlas → Network Access
   - Add IP: `0.0.0.0/0` (Allow from anywhere)
   - Wait 2 minutes
6. **Restart server:**
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

## Expected Result

You should see:
```
MongoDB Connected: db.jmrmhg3.mongodb.net
Server running in development mode on port 5000
```

## If Still Not Working

1. **Flush DNS:**
   ```bash
   ipconfig /flushdns
   ```

2. **Check Atlas Dashboard:**
   - Cluster is "Active" (green)
   - IP is whitelisted
   - Database user exists

3. **Test connection:**
   ```bash
   node test-atlas-connection.js
   ```

---

**That's it! This should fix your connection.** ✅
