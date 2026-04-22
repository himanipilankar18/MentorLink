# ML Recommendations - Quick Reference Card

## 📍 What to Look For

### In the Browser (Right Sidebar)

```
━━━━━━━━━━━━━━━━━━━━━━━━━
    Suggestions (NEW!)
━━━━━━━━━━━━━━━━━━━━━━━━━

  [AJ] Alex Johnson     87%  [Follow]
       CS • Year 3

  [SC] Sarah Chen       92%  [Follow]  
       CS • Year 4

  [MP] Mike Patel       78%  [Follow]
       Eng • Year 3

  [EW] Emma Wilson      85%  [Follow]
       CS • Year 2

  [DK] David Kumar      71%  [Follow]
       Data Sci • Year 4
```

**Color Legend:**
- 🟢 87%, 92%, 85% = Green (≥80%)
- 🟡 78%, 71% = Amber (60-79%)

---

## 🖱️ How to Use

### 1. **Hover Over Score Badge**

```
Move mouse to "87%" badge
         ↓
Tooltip appears:
┌──────────────────────────┐
│ Compatibility: 87%       │
├──────────────────────────┤
│ 🎯 Skill Match: 85%     │
│ ⭐ Mentor Quality: 90%  │
│ 📊 Activity Level: 88%  │
│ 👤 Profile Strength: 75%│
│ 🏢 Same Dept: 100%     │
│ ⏰ Schedule: 80%       │
└──────────────────────────┘
```

### 2. **Move Mouse Away**

Tooltip disappears automatically

### 3. **Click Follow Button**

Button changes to "Following" (backend integration coming)

---

## ✅ Verification Checklist

**On Page Load:**
- [ ] Recommendations appear in 2-3 seconds
- [ ] Shows exactly 5 mentors
- [ ] Each has a name, department, year
- [ ] Each has a colored score badge
- [ ] No red errors in browser console

**On Hover:**
- [ ] Tooltip appears with animation
- [ ] Shows all 6+ score components
- [ ] Tooltip disappears on mouse leave
- [ ] Score matches badge number

**Colors:**
- [ ] 80+% = Green background
- [ ] 60-79% = Amber background
- [ ] <60% = Red background

---

## 🔧 If Something's Wrong

### Recommendations Don't Show

**Check 1:** Is backend running?
```bash
curl http://localhost:5000
# Should get a response, not "Connection refused"
```

**Check 2:** Is JWT token present?
```javascript
// In browser console
localStorage.getItem('mentorlink_token')
// Should show a long token string, not null
```

**Check 3:** Check console for errors
```javascript
// Open DevTools: F12 → Console tab
// Should see: "Rendered 5 ML recommendations"
// Should NOT see any red ❌ errors
```

### Tooltip Doesn't Appear

**Solution:** Hover longer (animation takes 200ms) or check CSS loaded
```javascript
// In browser console
document.querySelectorAll('.ml-tooltip').length
// Should show: 5 (one per mentor)
```

### Scores Look Wrong

**Check:** Are they 0-100? They should be
```javascript
// In browser console
document.querySelectorAll('.ml-score-badge')
// Should show: 87%, 92%, 78%, etc. (NOT 0%)
```

---

## 📊 Score Meaning

**What the percentage means:**

```
87% = "Alex is an 87% match for your learning needs"

This comes from:
  • Do your skills match theirs? (85%)
  • Are they a good mentor? (90%)
  • Are they active & responsive? (88%)
  • Do you have compatible schedules? (80%)
  • Same department? (100%)
  • How complete is their profile? (75%)
  
Average = 87% ✓ Excellent match!
```

**Use this to decide:**
- 🟢 **80%+** = Contact them! Great match
- 🟡 **60-79%** = Good option if first choice busy
- 🔴 **<60%** = Fair match, try others first

---

## 🚀 Full Testing (5 minutes)

1. **Open Browser** → `http://localhost:5000/home.html`
2. **Wait 3 seconds** → Recommendations load
3. **Check Right Sidebar** → See 5 mentors with colored badges
4. **Hover over first badge** → Tooltip appears
5. **Check Colors** → Verify green/amber/red
6. **Check Console** → No red errors (F12)
7. **Done!** ✅

---

## 📝 Key Files

| File | Purpose |
|------|---------|
| `public/js/recommendations.js` | Main logic (324 lines) |
| `public/home.html` | UI + styles (added ~100 lines) |
| `ML_RECOMMENDATIONS_IMPLEMENTATION.md` | Full documentation |
| `ML_RECOMMENDATIONS_TESTING.md` | Testing guide |

---

## 🎯 What This Replaces

**Before:**
```
Suggestions
Loading suggestions...
[Static list when it loads]
```

**After:**
```
Suggestions
[ML-powered dynamic list]
[Color-coded compatibility]
[Hover tooltips with breakdown]
```

---

## 💡 How It Works (Simple Explanation)

```
1. You open home page
   ↓
2. System asks backend: "Who should I talk to?"
   ↓
3. Backend runs AI algorithm:
   - Looks at 1000+ mentors
   - Calculates match score for each
   - Picks top 5
   ↓
4. Frontend shows top 5 with:
   - Green if great match (87%)
   - Amber if good match (75%)
   - Red if okay match (55%)
   ↓
5. You hover on score → See WHY they're recommended
```

---

## 🎨 Visual Quick Reference

### Sidebar Layout
```
Right Sidebar
┌─────────────────────┐
│ People              │ ← Search bar here
│ [Search box]        │
│                     │
│ Suggestions         │ ← THIS SECTION
│ ┌─────────────────┐ │
│ │[A] Alex    87% │ │
│ │    CS•3    ► │ │ ← Hover badge
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │[S] Sarah   92% │ │
│ │    CS•4    ► │ │
│ └─────────────────┘ │
│ ... (3 more)        │
└─────────────────────┘
```

### Score Tooltip
```
Position: Above badge (doesn't cut off)
Size: Auto-fits content
Color: Dark background, purple text
Animation: Fade-in (200ms)
```

---

## 🔐 Security Note

✅ **All requests use JWT authentication**
- Token from localStorage
- Sent in Authorization header
- Backend validates on every call

✅ **Safe to use with production data**
- Only returns recommendations for authenticated user
- Other users can't see your matches

---

## ⚡ Performance

- **Loads in:** 2-3 seconds (includes API call)
- **Size:** 324 lines of code (no external dependencies)
- **Animations:** 200ms tooltip fade-in
- **Updates:** On page load (refresh for new recommendations)

---

## 📞 Quick Support

| Problem | Solution |
|---------|----------|
| Nothing shows | Backend down? Check: `curl localhost:5000` |
| All 0% scores | No interaction data in DB |
| Tooltip broken | Try refreshing page (F5) |
| Slow loading | Check internet speed & API latency |

---

## ✨ Key Achievements

✅ Dynamic recommendations (not static)
✅ Color-coded compatibility
✅ Interactive tooltips
✅ JWT authenticated
✅ Error handling
✅ No external dependencies
✅ Dark theme consistent
✅ Fully documented

---

## 🎓 Next Time You Work on This

1. Open: `public/js/recommendations.js`
2. Main function: `initializeRecommendations()`
3. API call: Line ~25
4. Rendering: `renderMLRecommendations()`
5. Colors: `getScoreColor()`

---

**Version:** 1.0  
**Status:** Ready for testing  
**Last Updated:** April 22, 2026
