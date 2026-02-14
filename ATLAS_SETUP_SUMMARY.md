# MongoDB Atlas Setup - Complete Summary

## ✅ Files Created/Updated

### New Files Created:
1. **`config/db.js`** - MongoDB Atlas connection using Mongoose
2. **`MONGODB_ATLAS_SETUP.md`** - Complete step-by-step setup guide
3. **`ATLAS_QUICK_START.md`** - Quick 5-minute setup checklist
4. **`test-atlas-connection.js`** - Connection testing script

### Updated Files:
1. **`.env.example`** - Updated with Atlas connection string format
2. **`README.md`** - Added Atlas setup references

---

## 🔄 Using config/db.js vs config/database.js

You now have **two options** for database connection:

### Option 1: Use `config/db.js` (New - As Requested)
```javascript
const connectDB = require("./config/db");
```

### Option 2: Use `config/database.js` (Existing)
```javascript
const connectDB = require("./config/database");
```

**Both work the same way!** Choose one:
- If you want the exact format you requested → use `config/db.js`
- If you want to keep existing code → use `config/database.js`

**To switch:** Just update the require statement in `server.js`:
```javascript
// Change this line in server.js:
const connectDB = require("./config/db");  // or "./config/database"
```

---

## 📝 Quick Setup Steps

1. **Install packages:**
   ```bash
   npm install mongoose dotenv
   ```

2. **Create Atlas cluster** (free tier)
   - Sign up at mongodb.com/cloud/atlas
   - Create FREE cluster
   - Wait 3-5 minutes

3. **Create database user:**
   - Atlas → Database Access → Add New Database User
   - Save username and password

4. **Whitelist IP:**
   - Atlas → Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (for dev)
   - **Wait 1-2 minutes**

5. **Get connection string:**
   - Atlas → Database → Connect → Connect your application
   - Copy connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority`

6. **Create `.env` file:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
   JWT_SECRET=your_secret_key
   PORT=5000
   ```
   - No quotes, no spaces around `=`
   - URL-encode special characters in password

7. **Update `server.js`:**
   ```javascript
   require("dotenv").config();
   const express = require("express");
   const connectDB = require("./config/db");  // or "./config/database"
   
   const app = express();
   connectDB();
   app.use(express.json());
   
   const PORT = process.env.PORT || 5000;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

8. **Test connection:**
   ```bash
   node test-atlas-connection.js
   ```

9. **Start server:**
   ```bash
   npm run dev
   ```

---

## ✅ Expected Success Output

```
MongoDB Atlas Connected Successfully
Server running on port 5000
```

---

## 🔧 Troubleshooting

### If you see `ECONNREFUSED`:
1. Wait 2-3 minutes after adding IP whitelist
2. Flush DNS: `ipconfig /flushdns` (Windows)
3. Verify IP is whitelisted in Atlas
4. Check connection string format

### If you see `Authentication failed`:
1. Verify username/password
2. URL-encode special characters:
   - `@` → `%40`
   - `#` → `%23`
   - `$` → `%24`
   - `%` → `%25`

### If you see `querySrv ECONNREFUSED`:
1. Check internet connection
2. Verify cluster is running
3. Try non-SRV connection string from Atlas

---

## 📚 Documentation Files

- **`MONGODB_ATLAS_SETUP.md`** - Complete detailed guide (read this first!)
- **`ATLAS_QUICK_START.md`** - Quick reference checklist
- **`test-atlas-connection.js`** - Test your connection

---

## 🎯 Key Points

✅ **Uses Mongoose** (NOT MongoClient)  
✅ **Connection string format** includes database name  
✅ **Password URL-encoding** for special characters  
✅ **IP whitelist** required in Atlas  
✅ **Wait 1-2 minutes** after whitelist changes  
✅ **.env file** - no quotes, no spaces  

---

**Ready to connect!** Follow `MONGODB_ATLAS_SETUP.md` for detailed instructions. 🚀
