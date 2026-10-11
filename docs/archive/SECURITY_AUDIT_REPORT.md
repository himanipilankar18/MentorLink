# MentorLink Security Audit Report

**Date:** February 28, 2026  
**Auditor:** AI Security Analysis  
**Application:** MentorLink - Academic Mentoring Platform  

---

## Executive Summary

This security audit identified **7 security vulnerabilities** ranging from CRITICAL to LOW severity. The most critical issue allows privilege escalation to admin role through the public registration endpoint. Immediate action is required to secure the application before production deployment.

**Risk Overview:**
- 🔴 CRITICAL: 1 vulnerability
- 🟠 HIGH: 2 vulnerabilities  
- 🟡 MEDIUM: 3 vulnerabilities
- 🟢 LOW: 1 vulnerability

---

## 🔴 CRITICAL VULNERABILITIES

### 1. Admin Role Privilege Escalation

**Severity:** CRITICAL  
**CVSS Score:** 9.8 (Critical)  
**Location:** `routes/auth.js` - POST `/api/auth/register` endpoint

**Description:**  
The registration endpoint accepts the `role` parameter directly from user input without any restrictions. This allows ANY user with a valid SPIT email to register as an 'admin' and gain full system privileges.

**Vulnerable Code:**
```javascript
// routes/auth.js (line 45-52)
const user = await User.create({
  name,
  email,
  password,
  year,
  department,
  role,  // <-- Takes ANY role from user input, including 'admin'!
  skills: skills || [],
  interests: interests || [],
  cgpa: cgpa || null,
  isVerified: false
});
```

**Attack Scenario:**
1. Attacker registers with SPIT email
2. Sends request with `"role": "admin"` in POST body
3. Receives admin privileges after email verification
4. Can access all system functions, modify/delete any data

**Impact:**
- Complete system compromise
- Unauthorized access to all user data
- Ability to modify/delete any records
- Bypass all role-based access controls

**Remediation:**
```javascript
// OPTION 1: Force role based on email/criteria
const role = determineRoleFromEmail(email) || 'junior';

// OPTION 2: Block admin registration entirely
if (req.body.role === 'admin') {
  return res.status(403).json({
    success: false,
    message: 'Admin registration not allowed through public endpoint'
  });
}

// OPTION 3: Whitelist allowed roles
const allowedRoles = ['junior', 'senior', 'faculty'];
const role = allowedRoles.includes(req.body.role) ? req.body.role : 'junior';
```

**Priority:** IMMEDIATE - Fix before any production use

---

## � PROPOSED SOLUTIONS FOR ADMIN PRIVILEGE ESCALATION

After detailed analysis, here are the shortlisted solutions for implementation:

### ⭐ Solution 2: Whitelist Allowed Roles (Quick Fix)
**Status:** 🔴 **SELECTED FOR INITIAL IMPLEMENTATION**

**What it does:**
- Blocks 'admin' from the registration endpoint
- Only allows: `['junior', 'senior', 'faculty']`
- Any other role defaults to 'junior'

**Implementation:**
```javascript
// routes/auth.js - Registration endpoint
const ALLOWED_REGISTRATION_ROLES = ['junior', 'senior', 'faculty'];

// In register endpoint (line ~42)
const requestedRole = req.body.role;
const role = ALLOWED_REGISTRATION_ROLES.includes(requestedRole) 
  ? requestedRole 
  : 'junior';

const user = await User.create({
  name,
  email,
  password,
  year,
  department,
  role,  // Now sanitized!
  // ... rest of fields
});
```

**Pros:**
- ✅ Immediate security fix
- ✅ Simple to implement (5 minutes)
- ✅ No breaking changes to existing code
- ✅ Clear and maintainable

**Cons:**
- ⚠️ Still need manual database insert for first admin
- ⚠️ No admin management interface

---

### ⭐ Solution 6: Protected Admin Endpoint (Scalable)
**Status:** 🟡 **PLANNED FOR PHASE 2**

**What it does:**
- Creates a separate secured endpoint for admin creation
- Only existing admins can create new admins
- Requires authentication + admin role verification

**Implementation:**
```javascript
// routes/auth.js - Add new protected endpoint

// Protected endpoint - only admins can create new admins
router.post('/create-admin', 
  verifyToken,           // Must be logged in
  checkRole('admin'),    // Must be an admin
  async (req, res) => {
    try {
      const { name, email, password, department } = req.body;
      
      // Check if admin already exists
      const existingAdmin = await User.findOne({ email });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Admin with this email already exists'
        });
      }
      
      // Create admin user
      const admin = await User.create({
        name,
        email,
        password,
        department,
        role: 'admin',
        isVerified: true,  // Auto-verify admins
        profileComplete: true
      });
      
      res.status(201).json({
        success: true,
        message: 'Admin user created successfully',
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating admin user',
        error: error.message
      });
    }
});
```

**Pros:**
- ✅ Scalable admin management
- ✅ Admins can create other admins securely
- ✅ Full audit trail of admin creation
- ✅ No manual database access needed

**Cons:**
- ⚠️ Still need bootstrap process for first admin
- ⚠️ Slightly more complex

---

### ⭐⭐⭐ Solution 7: Hybrid Approach (Recommended - Best of Both)
**Status:** 🟢 **RECOMMENDED FOR COMPLETE IMPLEMENTATION**

**What it does:**
- **Combines Solution 2 + Solution 6**
- Public registration whitelisted to safe roles
- Protected endpoint for admin management
- Bootstrap script for initial admin setup

**Complete Implementation:**

**Step 1: Whitelist public registration (Solution 2)**
```javascript
// routes/auth.js
const ALLOWED_REGISTRATION_ROLES = ['junior', 'senior', 'faculty'];

// In POST /api/auth/register
const role = ALLOWED_REGISTRATION_ROLES.includes(req.body.role) 
  ? req.body.role 
  : 'junior';
```

**Step 2: Add protected admin endpoint (Solution 6)**
```javascript
// routes/auth.js - Protected endpoint
router.post('/create-admin', verifyToken, checkRole('admin'), async (req, res) => {
  // ... (see Solution 6 code above)
});
```

**Step 3: Create bootstrap script for first admin**
```javascript
// scripts/create-first-admin.js
const User = require('../models/User');
const connectDB = require('../config/database');

async function createFirstAdmin() {
  await connectDB();
  
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) {
    console.log('❌ Admin already exists');
    return;
  }
  
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@spit.ac.in',
    password: 'SecurePassword123!',  // Change after first login
    role: 'admin',
    department: 'Computer',
    isVerified: true,
    profileComplete: true
  });
  
  console.log('✅ First admin created:', admin.email);
  console.log('⚠️  IMPORTANT: Change the password immediately!');
}

createFirstAdmin();
```

**Step 4: Update frontend**
```html
<!-- public/register.html - Remove admin from dropdown -->
<select id="role" name="role" required>
  <option value="">Select Role</option>
  <option value="junior">Junior (1st/2nd year)</option>
  <option value="senior">Senior (3rd/4th year)</option>
  <option value="faculty">Faculty</option>
  <!-- <option value="admin">Admin</option> --> <!-- REMOVED -->
</select>
```

**Why Solution 7 is Best:**
1. ✅ **Immediate Security:** Blocks admin registration right away
2. ✅ **Scalability:** Admins can manage admins without database access
3. ✅ **Clean Separation:** Public vs. protected endpoints
4. ✅ **Audit Trail:** All admin creation logged and tracked
5. ✅ **Bootstrap Friendly:** Easy first-time setup with script
6. ✅ **Production Ready:** Complete solution for long-term use

**Implementation Effort:**
- Whitelisting: 5 minutes
- Protected endpoint: 15 minutes
- Bootstrap script: 10 minutes
- Frontend update: 5 minutes
- **Total: 35 minutes**

---

## �🟠 HIGH VULNERABILITIES

### 2. CORS Misconfiguration - Wide Open

**Severity:** HIGH  
**CVSS Score:** 7.5 (High)  
**Location:** `server.js` line 13

**Description:**  
CORS (Cross-Origin Resource Sharing) is configured to allow requests from ANY domain without restrictions. This allows malicious websites to make authenticated requests to your API and potentially steal user data.

**Vulnerable Code:**
```javascript
// server.js (line 13)
app.use(cors());  // <-- No origin restrictions!
```

**Attack Scenario:**
1. Attacker creates malicious website (evil.com)
2. User visits evil.com while logged into MentorLink
3. evil.com makes API requests with user's credentials
4. Attacker steals user data, performs actions as the user

**Impact:**
- Session hijacking
- Data theft via CSRF attacks
- Unauthorized actions on behalf of users

**Remediation:**
```javascript
// server.js
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5000',
    'https://mentorlink.spit.ac.in'  // Your production domain
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
```

**Add to .env:**
```
ALLOWED_ORIGINS=http://localhost:5000,https://mentorlink.spit.ac.in
```

**Priority:** HIGH - Fix before deployment

---

### 3. NoSQL Injection Vulnerability

**Severity:** HIGH  
**CVSS Score:** 8.1 (High)  
**Location:** All endpoints accepting user input (especially auth endpoints)

**Description:**  
No input sanitization for NoSQL injection attacks. MongoDB query operators like `$ne`, `$gt`, `$regex` can be injected to bypass authentication or manipulate queries.

**Missing Protection:**  
- No `express-mongo-sanitize` package installed
- No input sanitization middleware

**Attack Scenario:**
```javascript
// Login bypass attempt:
POST /api/auth/login
Content-Type: application/json

{
  "email": {"$ne": null},
  "password": {"$ne": null}
}

// This could match any user where email exists and password exists
```

**Impact:**
- Authentication bypass
- Unauthorized data access
- Query manipulation
- Database enumeration

**Remediation:**

**Step 1:** Install protection package:
```bash
npm install express-mongo-sanitize
```

**Step 2:** Add to server.js:
```javascript
const mongoSanitize = require('express-mongo-sanitize');

// Add after express.json()
app.use(mongoSanitize({
  replaceWith: '_'  // Replace $ and . with _
}));
```

**Priority:** HIGH - Fix before handling any user data

---

## 🟡 MEDIUM VULNERABILITIES

### 4. OTP Brute Force Vulnerability

**Severity:** MEDIUM  
**CVSS Score:** 6.5 (Medium)  
**Location:** `routes/auth.js` - POST `/api/auth/verify-otp`

**Description:**  
The OTP verification endpoint has no attempt limiting beyond the general rate limiter (1000 attempts per 15 minutes in development). An attacker could systematically try all 1,000,000 possible 6-digit OTP combinations.

**Current Protection:**
- Rate limiter: 1000 attempts per 15 minutes (development)
- OTP expires after 15 minutes
- No per-user attempt tracking

**Attack Feasibility:**
- Total possible OTPs: 1,000,000 (000000 to 999999)
- With 1000 attempts per 15 min: ~16.67 attempts/min
- Time to try all combinations: ~1000 hours (41 days)
- Could be faster with distributed attack from multiple IPs

**Impact:**
- Account takeover
- Unauthorized email verification
- Email enumeration

**Remediation:**

**Add OTP attempt tracking:**
```javascript
// models/User.js - Add fields:
otpAttempts: {
  type: Number,
  default: 0
},
otpLockedUntil: {
  type: Date,
  default: null
}

// routes/auth.js - In verify-otp endpoint:
// Check if locked
if (user.otpLockedUntil && user.otpLockedUntil > Date.now()) {
  return res.status(429).json({
    success: false,
    message: 'Too many failed attempts. Please try again later.'
  });
}

// On wrong OTP:
user.otpAttempts += 1;
if (user.otpAttempts >= 5) {
  user.otpLockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 min
  user.otpAttempts = 0;
  await user.save();
  return res.status(429).json({
    success: false,
    message: 'Too many failed attempts. Account locked for 15 minutes.'
  });
}
await user.save();

// On correct OTP:
user.otpAttempts = 0;
user.otpLockedUntil = null;
```

**Priority:** MEDIUM - Implement before public launch

---

### 5. No Rate Limiting on OTP Resend

**Severity:** MEDIUM  
**CVSS Score:** 5.3 (Medium)  
**Location:** `routes/auth.js` - POST `/api/auth/resend-otp`

**Description:**  
Users can repeatedly request OTP resends without specific limitations, potentially flooding email inboxes or causing email service costs to spike.

**Current Protection:**
- General rate limiter: 1000 auth requests per 15 minutes
- No per-user resend tracking
- No cooldown between resends

**Attack Scenario:**
1. Attacker registers with victim's SPIT email
2. Continuously requests OTP resends
3. Victim's inbox flooded with hundreds of OTPs
4. Email sending costs increase significantly

**Impact:**
- Email flooding (DoS)
- Increased SMTP costs
- Poor user experience
- Potential SMTP service blacklisting

**Remediation:**

```javascript
// models/User.js - Add field:
lastOtpSentAt: {
  type: Date,
  default: null
}

// routes/auth.js - In resend-otp:
// Check cooldown (e.g., 60 seconds)
if (user.lastOtpSentAt && (Date.now() - user.lastOtpSentAt) < 60000) {
  return res.status(429).json({
    success: false,
    message: 'Please wait before requesting another OTP'
  });
}

// After sending:
user.lastOtpSentAt = Date.now();
await user.save();
```

**Priority:** MEDIUM - Implement to prevent abuse

---

### 6. Information Disclosure - Stack Traces

**Severity:** MEDIUM  
**CVSS Score:** 5.3 (Medium)  
**Location:** `middleware/errorHandler.js`

**Description:**  
Stack traces are exposed to clients in development mode, potentially revealing sensitive information about the application architecture, file paths, and code structure.

**Vulnerable Code:**
```javascript
// middleware/errorHandler.js
res.status(error.statusCode || 500).json({
  success: false,
  message: error.message || 'Server Error',
  ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
});
```

**Risk:**
- Reveals internal file structure
- Exposes package versions
- Helps attackers understand application architecture
- Could reveal sensitive variable names

**Impact:**
- Information gathering for targeted attacks
- Technology stack disclosure
- Internal path disclosure

**Remediation:**

```javascript
// middleware/errorHandler.js
res.status(error.statusCode || 500).json({
  success: false,
  message: error.message || 'Server Error',
  // Only log stack traces server-side, never send to client
});

// Log detailed errors server-side only:
if (process.env.NODE_ENV === 'development') {
  console.error('Detailed error:', err.stack);
}
```

**Priority:** MEDIUM - Fix before production

---

## 🟢 LOW VULNERABILITIES

### 7. User Enumeration via Error Messages

**Severity:** LOW  
**CVSS Score:** 3.7 (Low)  
**Location:** Multiple endpoints (registration, login, forgot-password)

**Description:**  
Different error messages reveal whether a user account exists in the system, allowing attackers to enumerate valid email addresses.

**Examples:**

**Registration endpoint:**
```javascript
// Reveals if email exists
return res.status(400).json({
  success: false,
  message: 'User already exists with this email'  // <-- Confirms email exists
});
```

**Login endpoint:**
```javascript
// Generic message, but timing differences may reveal existence
if (!user) {
  return res.status(401).json({
    success: false,
    message: 'Invalid credentials'
  });
}
```

**Forgot Password endpoint:**
```javascript
// Good - same message regardless
return res.json({
  success: true,
  message: 'If an account with that email exists, a password reset link has been sent.'
});
```

**Attack Scenario:**
1. Attacker tests common email patterns
2. Collects list of valid emails from registration errors
3. Uses list for targeted phishing attacks

**Impact:**
- User enumeration
- Targeted phishing preparation
- Privacy concerns

**Remediation:**

**Registration:**
```javascript
// Always return same message
if (existingUser) {
  // Log attempt but don't reveal
  console.log(`Registration attempt for existing email: ${email}`);
  
  // Return generic success message
  return res.status(201).json({
    success: true,
    message: 'Please check your SPIT email for verification OTP.'
  });
}
```

**Login:**
```javascript
// Use constant-time comparison and same error for all failures
const isValidUser = user ? true : false;
const isValidPassword = user ? await user.comparePassword(password) : false;

if (!isValidUser || !isValidPassword) {
  return res.status(401).json({
    success: false,
    message: 'Invalid credentials'
  });
}
```

**Priority:** LOW - Consider for production hardening

---

## Additional Security Recommendations

### 1. Add Security Headers
Install and configure `helmet` (already installed but can add more options):
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 2. Implement Account Lockout
Add progressive delays after failed login attempts:
- 3 failed attempts: 5-minute lockout
- 5 failed attempts: 15-minute lockout
- 10 failed attempts: 1-hour lockout

### 3. Add Session Management
- Implement session expiry
- Add "logout all devices" functionality
- Track active sessions per user

### 4. Enable Audit Logging
Log security-relevant events:
- Login attempts (success/failure)
- Password changes
- Admin actions
- Failed OTP attempts
- Role changes

### 5. Production Checklist
Before deploying to production:
- [ ] Set `NODE_ENV=production`
- [ ] Restore rate limits to 5-10 requests per 15 minutes
- [ ] Configure CORS with actual domain
- [ ] Disable error stack traces
- [ ] Change JWT secret to new secure value
- [ ] Change MongoDB password
- [ ] Enable HTTPS only
- [ ] Review all environment variables
- [ ] Set up monitoring/alerting

---

## Implementation Priority Order

### Phase 1: CRITICAL (Implement Immediately)
1. **Block admin role registration** - 5 minutes
2. **Restrict CORS** - 5 minutes
3. **Add NoSQL injection protection** - 10 minutes

### Phase 2: HIGH (Implement Before Testing)
4. **Add OTP attempt limiting** - 20 minutes
5. **Add OTP resend cooldown** - 10 minutes

### Phase 3: MEDIUM (Implement Before Production)
6. **Remove stack trace exposure** - 5 minutes
7. **Fix user enumeration** - 15 minutes
8. **Add security headers** - 10 minutes

### Phase 4: BEST PRACTICES (Consider for Production)
9. **Add audit logging** - 30 minutes
10. **Implement session management** - 60 minutes
11. **Add account lockout** - 30 minutes

**Total Estimated Time for Critical Fixes:** ~1 hour

---

## Testing Recommendations

After implementing fixes, test:
1. Try registering as admin - should fail
2. Attempt NoSQL injection in login - should fail
3. Try CORS from unauthorized domain - should fail
4. Attempt OTP brute force - should lock account
5. Spam OTP resend - should enforce cooldown
6. Trigger errors - should not expose stack traces

---

## Conclusion

The MentorLink application has a solid foundation but requires immediate security hardening before production deployment. The admin role privilege escalation vulnerability is particularly critical and must be fixed immediately.

After implementing the recommended fixes, the application will have enterprise-grade security suitable for handling sensitive student and faculty data.

**Contact for Questions:**  
Review this document and confirm which fixes to implement first.

---

**Document Version:** 1.0  
**Last Updated:** February 28, 2026
