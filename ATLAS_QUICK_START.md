# MongoDB Atlas Quick Start - 5 Minutes

## ⚡ Fast Setup Checklist

### 1. Install Packages
```bash
npm install mongoose dotenv
```

### 2. Create Atlas Account & Cluster
- Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Sign up → Create FREE cluster → Wait 3-5 minutes

### 3. Create Database User
- Atlas Dashboard → **Database Access** → **Add New Database User**
- Username: `mentorlink_user`
- Password: Generate secure password (SAVE IT!)
- Privileges: **Atlas admin** or **Read and write to any database**

### 4. Whitelist IP Address
- Atlas Dashboard → **Network Access** → **Add IP Address**
- Click **"Allow Access from Anywhere"** (for development)
- **Wait 1-2 minutes** for changes to apply

### 5. Get Connection String
- Atlas Dashboard → **Database** → **Connect** → **Connect your application**
- Copy connection string
- Format: `mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority`
- **Replace:**
  - `<username>` → your database username
  - `<password>` → your database password (URL-encode special chars!)
  - Add `/mentorlink` before `?` (database name)

### 6. Create .env File
In project root, create `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_here
PORT=5000
```

**⚠️ Rules:**
- No quotes around values
- No spaces around `=`
- No semicolons
- File name must be `.env` (with dot)

### 7. Create config/db.js
```javascript
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Atlas Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 8. Update server.js
```javascript
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(express.json());

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 9. Test Connection
```bash
npm run dev
```

**Expected Output:**
```
MongoDB Atlas Connected Successfully
Server running on port 5000
```

---

## 🔧 If Connection Fails

### Error: `ECONNREFUSED`
1. Wait 2-3 minutes after adding IP whitelist
2. Verify IP is whitelisted in Atlas
3. Check connection string format

### Error: `Authentication failed`
1. Verify username/password
2. URL-encode special characters:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`

### Error: `querySrv ECONNREFUSED`
1. Flush DNS: `ipconfig /flushdns` (Windows)
2. Check internet connection
3. Verify cluster is running in Atlas

---

## ✅ Success Indicators

- ✅ See "MongoDB Atlas Connected Successfully"
- ✅ Server starts without errors
- ✅ Can create/read data in MongoDB

---

**Full detailed guide:** See `MONGODB_ATLAS_SETUP.md`
