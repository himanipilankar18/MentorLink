# MongoDB Atlas Setup Guide - Step by Step

## 🎯 Complete Setup Instructions for MongoDB Atlas + Mongoose

This guide will help you connect MongoDB Atlas to your Express.js backend using Mongoose.

---

## 📋 Prerequisites

- Node.js installed
- MongoDB Atlas account (free tier available)
- Express.js project set up

---

## Step 1️⃣: Install Required Packages

Open your terminal in the project root and run:

```bash
npm install mongoose dotenv
```

**What this does:**
- `mongoose` - MongoDB object modeling for Node.js (handles schemas and models)
- `dotenv` - Loads environment variables from `.env` file

---

## Step 2️⃣: Create MongoDB Atlas Account & Cluster

### 2.1 Sign Up
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** or **"Sign Up"**
3. Create your account (use Google/GitHub or email)

### 2.2 Create Free Cluster
1. After login, click **"Build a Database"**
2. Choose **FREE** tier (M0 Sandbox)
3. Select your preferred cloud provider and region
4. Click **"Create Cluster"**
5. Wait 3-5 minutes for cluster to be created

---

## Step 3️⃣: Create Database User

### 3.1 Navigate to Database Access
1. In Atlas dashboard, click **"Database Access"** (left sidebar)
2. Click **"Add New Database User"**

### 3.2 Configure User
1. **Authentication Method**: Password
2. **Username**: Create a username (e.g., `mentorlink_user`)
3. **Password**: 
   - Click **"Autogenerate Secure Password"** OR
   - Create your own strong password
   - **⚠️ IMPORTANT**: Save this password! You'll need it for connection string

4. **Database User Privileges**: 
   - Select **"Atlas admin"** (for development)
   - OR **"Read and write to any database"**

5. Click **"Add User"**

---

## Step 4️⃣: Add IP Address to Whitelist

### 4.1 Navigate to Network Access
1. Click **"Network Access"** (left sidebar)
2. Click **"Add IP Address"**

### 4.2 Add Your IP
**Option A: Allow All IPs (Development Only)**
- Click **"Allow Access from Anywhere"**
- This adds `0.0.0.0/0` to whitelist
- ⚠️ **Warning**: Only for development! Not secure for production.

**Option B: Add Your Current IP**
- Click **"Add Current IP Address"**
- Your IP will be detected automatically
- Click **"Confirm"**

### 4.3 Wait for Changes
- **Important**: Wait 1-2 minutes after saving
- Changes may take a moment to propagate

---

## Step 5️⃣: Get Connection String

### 5.1 Navigate to Connect
1. Click **"Database"** (left sidebar)
2. Click **"Connect"** button on your cluster

### 5.2 Choose Connection Method
1. Select **"Connect your application"**
2. **Driver**: Node.js
3. **Version**: 5.5 or later

### 5.3 Copy Connection String
You'll see something like:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**⚠️ Important Notes:**
- `<username>` - Replace with your database username
- `<password>` - Replace with your database password
- **Special characters in password must be URL-encoded:**
  - `@` → `%40`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`
  - `&` → `%26`
  - `/` → `%2F`
  - `:` → `%3A`
  - `?` → `%3F`
  - `=` → `%3D`

### 5.4 Add Database Name
Add your database name (`mentorlink`) before the `?`:

**Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
```

**Example:**
```
mongodb+srv://mentorlink_user:MyP@ssw0rd@cluster0.abc123.mongodb.net/mentorlink?retryWrites=true&w=majority
```

---

## Step 6️⃣: Create .env File

### 6.1 Create File
In your project root directory, create a file named `.env`

**⚠️ Important:**
- File name must be exactly `.env` (with the dot)
- No quotes around values
- No spaces around `=`
- No semicolons at the end

### 6.2 Add Configuration
Copy this template and fill in your values:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
JWT_SECRET=supersecretkey
PORT=5000
```

**Example with real values:**
```env
MONGODB_URI=mongodb+srv://mentorlink_user:MyP%40ssw0rd@cluster0.abc123.mongodb.net/mentorlink?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
NODE_ENV=development
ALLOWED_DOMAINS=spit.ac.in
```

**⚠️ Password Encoding Example:**
If your password is `MyP@ss#123`, encode it as `MyP%40ss%23123`

---

## Step 7️⃣: Create config/db.js File

### 7.1 Create Directory
```bash
mkdir config
```

### 7.2 Create File
Create `config/db.js` with this exact code:

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

**What this does:**
- Uses Mongoose (NOT MongoClient)
- Connects using `process.env.MONGODB_URI` from `.env`
- Logs success message
- Exits process on error

---

## Step 8️⃣: Update server.js

### 8.1 Update Your server.js

Make sure your `server.js` looks like this:

```javascript
require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const app = express();

// Connect to MongoDB Atlas
connectDB();

// Middleware
app.use(express.json());

// Routes (add your routes here)
// app.use("/api/auth", require("./routes/auth"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Key Points:**
- `require("dotenv").config()` - Must be FIRST line (loads .env)
- `connectDB()` - Called before routes
- Uses `./config/db` (your connection file)

---

## Step 9️⃣: Test Connection

### 9.1 Start Server
```bash
npm run dev
```

**Expected Output:**
```
MongoDB Atlas Connected Successfully
Server running on port 5000
```

### 9.2 If You See Errors

**Error: `ECONNREFUSED`**
- Wait 2-3 minutes after adding IP to whitelist
- Verify IP is whitelisted in Atlas
- Check connection string format

**Error: `Authentication failed`**
- Verify username and password
- URL-encode special characters in password
- Check database user has correct permissions

**Error: `querySrv ECONNREFUSED`**
- Check internet connection
- Try flushing DNS (see troubleshooting below)
- Verify cluster is running in Atlas

---

## Step 🔟: Restart Properly

### 10.1 Stop Server
Press `Ctrl + C` in terminal

### 10.2 Restart
```bash
npm run dev
```

### 10.3 If Using Nodemon
- Type `rs` and press Enter to restart
- Or stop with `Ctrl + C` and run `npm run dev` again

---

## 🔧 Troubleshooting: If ECONNREFUSED Still Happens

### Solution 1: Flush DNS (Windows)
```bash
ipconfig /flushdns
```
Then restart your server.

### Solution 2: Use Non-SRV Connection String
1. In Atlas, go to **"Connect"** → **"Connect your application"**
2. Look for **"Connection String Options"**
3. Copy the **non-SRV** connection string
4. Format: `mongodb://username:password@cluster-shard-00-00.xxxxx.mongodb.net:27017/mentorlink?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority`

### Solution 3: Check Firewall
- Temporarily disable firewall to test
- Add Node.js to firewall exceptions

### Solution 4: Verify Credentials
- Double-check username and password
- Try creating a new database user
- Verify user has correct permissions

### Solution 5: Check Cluster Status
- In Atlas dashboard, verify cluster is running
- Status should be "Active" (green)

### Solution 6: Test Connection String
Use MongoDB Compass to test:
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Paste your connection string
3. Click "Connect"
4. If it works in Compass, the issue is in your code

---

## ✅ Verification Checklist

- [ ] MongoDB Atlas account created
- [ ] Free cluster created and running
- [ ] Database user created with password
- [ ] IP address added to whitelist (waited 2 minutes)
- [ ] Connection string copied and formatted correctly
- [ ] Password URL-encoded (if special characters)
- [ ] Database name added to connection string (`/mentorlink`)
- [ ] `.env` file created in project root
- [ ] `MONGODB_URI` added to `.env` (no quotes, no spaces)
- [ ] `config/db.js` file created
- [ ] `server.js` updated with `connectDB()`
- [ ] Packages installed (`mongoose`, `dotenv`)
- [ ] Server starts without errors
- [ ] See "MongoDB Atlas Connected Successfully" message

---

## 📝 Quick Reference

### Connection String Format
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

### .env File Format
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mentorlink?retryWrites=true&w=majority
JWT_SECRET=your_secret_key
PORT=5000
```

### config/db.js Format
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

---

## 🎉 Success!

If you see this message:
```
MongoDB Atlas Connected Successfully
Server running on port 5000
```

**Congratulations!** Your MongoDB Atlas connection is working! 🚀

---

## 📚 Next Steps

1. Create your Mongoose models/schemas
2. Set up your API routes
3. Test CRUD operations
4. Build your application features

---

**Need Help?** Check the error message carefully - it usually tells you exactly what's wrong!
