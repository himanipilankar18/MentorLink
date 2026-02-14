# MongoDB Connection Setup Guide

## 🔴 Current Error
```
Error: querySrv ECONNREFUSED _mongodb._tcp.db.jmrmhg3.mongodb.net
```

This error indicates a connection issue with MongoDB Atlas (cloud database).

## ✅ Solutions

### Option 1: Use Local MongoDB (Recommended for Development)

1. **Install MongoDB locally** (if not installed):
   - Windows: Download from [mongodb.com/download](https://www.mongodb.com/try/download/community)
   - Or use Chocolatey: `choco install mongodb`

2. **Start MongoDB**:
   ```bash
   # Windows (if installed as service)
   net start MongoDB
   
   # Or run directly
   mongod
   ```

3. **Update `.env` file**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/mentorlink
   ```

4. **Restart your server**:
   ```bash
   npm run dev
   ```

---

### Option 2: Fix MongoDB Atlas Connection

If you want to use MongoDB Atlas (cloud), follow these steps:

#### Step 1: Check Your Connection String
Your `.env` should have something like:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
```

#### Step 2: Verify Network Access
1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com/)
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** (for development) or add your IP
5. Save

#### Step 3: Verify Database User
1. Go to **Database Access** (left sidebar)
2. Check if your user exists
3. If not, create a new user:
   - Username: your username
   - Password: generate a secure password
   - Database User Privileges: **Read and write to any database**

#### Step 4: Check Connection String Format
Make sure your connection string is correct:
```
mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority
```

**Important**: Replace special characters in password:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

#### Step 5: Test Connection
Try connecting using MongoDB Compass or update your `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
```

---

### Option 3: Use MongoDB Atlas Free Tier (If Not Set Up)

1. **Create Account**: Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**: Choose FREE tier (M0)
3. **Create Database User**: Set username and password
4. **Whitelist IP**: Add `0.0.0.0/0` for development (or your IP)
5. **Get Connection String**: Click "Connect" → "Connect your application"
6. **Copy connection string** to your `.env` file

---

## 🧪 Test Connection

After updating `.env`, restart your server:
```bash
npm run dev
```

You should see:
```
MongoDB Connected: cluster0.xxxxx.mongodb.net
Server running in development mode on port 5000
```

---

## 🔍 Troubleshooting

### DNS Resolution Error
If you see `querySrv ECONNREFUSED`:
- Check your internet connection
- Try using IP address instead of hostname (not recommended)
- Check firewall settings

### Authentication Failed
- Verify username and password in connection string
- Check if user has correct permissions
- Ensure password doesn't have special characters (or URL-encode them)

### Network Access Denied
- Add your IP to MongoDB Atlas Network Access whitelist
- For development, use `0.0.0.0/0` (allows all IPs)

### Connection Timeout
- Check if MongoDB Atlas cluster is running
- Verify connection string format
- Try connecting from MongoDB Compass first

---

## 💡 Quick Fix for Development

**Easiest solution**: Use local MongoDB

1. Install MongoDB locally
2. Update `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/mentorlink
   ```
3. Start MongoDB: `mongod`
4. Restart server: `npm run dev`

This avoids all cloud connection issues during development!

---

## 📝 Example .env File

```env
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/mentorlink

# OR MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority

PORT=5000
NODE_ENV=development
JWT_SECRET=your_generated_secret_here
JWT_EXPIRE=7d
ALLOWED_DOMAINS=spit.ac.in
```

---

**Once connected, you'll see**: `MongoDB Connected: ...` ✅
