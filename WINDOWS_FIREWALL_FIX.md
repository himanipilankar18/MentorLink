# Fix: Allow Node.js in Windows Firewall (Outbound)

Your app can't reach MongoDB Atlas because Windows Firewall is blocking Node.js. Do one of the following.

---

## Option A: Allow Node.js (recommended)

### Step 1: Find Node.js path

1. Open **Command Prompt** or **PowerShell**.
2. Run:
   ```powershell
   where node
   ```
3. Note the path, e.g. `C:\Program Files\nodejs\node.exe`

### Step 2: Add outbound rule (GUI)

1. Press **Win + R**, type **`wf.msc`**, press **Enter**.
2. In the left pane click **Outbound Rules**.
3. In the right pane click **New Rule...**.
4. Select **Program** → **Next**.
5. Select **This program path:** and paste or browse to:
   ```
   C:\Program Files\nodejs\node.exe
   ```
   (Use the path from Step 1 if different.)
6. **Next** → **Allow the connection** → **Next**.
7. Leave **Domain**, **Private**, **Public** all checked → **Next**.
8. Name: **Node.js (MongoDB Atlas)** → **Finish**.

### Step 3: Test your app

```bash
npm run dev
```

If you still see the same error, try **Option B** or **Option C**.

---

## Option B: Run as Administrator (one-time)

Sometimes the rule works only when Node runs with full rights.

1. Close your terminal/IDE.
2. **Right-click** on **Command Prompt** or **PowerShell** → **Run as administrator**.
3. Go to your project:
   ```powershell
   cd D:\majorproject\MentorLink
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

---

## Option C: Use mobile hotspot

To confirm it’s your PC/network and not Atlas:

1. On your phone, turn on **Mobile hotspot** (share data via Wi‑Fi).
2. On your PC, connect to that Wi‑Fi.
3. Run:
   ```bash
   npm run dev
   ```

- If it **connects** on hotspot → your normal network (or firewall) is blocking. Use Option A or B on that network.
- If it **still fails** on hotspot → try Option D or check Atlas (user, whitelist).

---

## Option D: Temporarily turn firewall off (test only)

Use this only to test; turn it back on after.

1. Press **Win + R**, type **`firewall.cpl`**, press **Enter**.
2. Click **Turn Windows Defender Firewall on or off**.
3. Under **Private** and **Public**, select **Turn off Windows Defender Firewall**.
4. **OK**.
5. Run `npm run dev`.
6. When done testing, open **firewall.cpl** again and turn the firewall **back on**.

---

## Check reachability (optional)

From project folder:

```bash
node scripts/check-atlas-reachability.js
```

- **TCP connection succeeded** → firewall/reachability is OK; if the app still fails, the issue is TLS/auth or config.
- **TCP connection failed** → something is still blocking (firewall, antivirus, or network). Try hotspot (Option C) or temporary firewall off (Option D).

---

## Summary

| Step | Action |
|------|--------|
| 1 | Add outbound rule for `node.exe` (Option A). |
| 2 | Run `npm run dev` again. |
| 3 | If it still fails, try **Run as administrator** (Option B) or **mobile hotspot** (Option C). |
| 4 | Use **Turn off firewall** (Option D) only to test; then re-enable. |

After the firewall allows Node (or you’re on a network that doesn’t block 27017), the “your machine cannot reach Atlas” message should go away and MongoDB should connect.
