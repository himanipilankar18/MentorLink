# ML Recommendations - Quick Testing Guide

## 🚀 Quick Start

### 1. Ensure Backend is Running

```bash
cd d:\finalyrproject\MentorLink
npm run dev
```

Expected output: Server running on `http://localhost:5000`

### 2. Open Home Page

Navigate to: `http://localhost:5000/home.html`

### 3. Verify Recommendations Load

**In the Right Sidebar under "Suggestions":**
- Should see 5 mentor cards
- Each showing: Avatar, Name, Department, Year
- **Colored score badge** (Green/Amber/Red)
- "Follow" button

### 4. Test Hover Interaction

**Hover over the score badge:**
- Should see **tooltip appear** with:
  - "Compatibility: XX%"
  - Score breakdown (Skill Match, Mentor Quality, Activity Level, etc.)
- **Tooltip should disappear** when you move mouse away

### 5. Check Browser Console

Open DevTools (F12) → Console tab

**Expected logs:**
```
✅ RecommendationEngine initialized
✅ Fetching recommendations from API...
✅ Rendered 5 ML recommendations
```

**If errors appear:**
```
❌ Failed to fetch recommendations: [ERROR MESSAGE]
   → System will show default suggestions
```

---

## 📊 Expected UI

### Right Sidebar - Suggestions Section

```
━━━━━━━━━━━━━━━━━━━━━━━
    Suggestions
━━━━━━━━━━━━━━━━━━━━━━━

  [AJ] Alex Johnson           87%
       CS • Year 3            [Follow]
       
  [SC] Sarah Chen             92%
       CS • Year 4            [Follow]
       
  [MP] Mike Patel             78%
       Engineering • Year 3   [Follow]
       
  [EW] Emma Wilson            85%
       CS • Year 2            [Follow]
       
  [DK] David Kumar            71%
       Data Science • Year 4  [Follow]

━━━━━━━━━━━━━━━━━━━━━━━
```

### Score Badge Colors

- **87%** → 🟢 Green badge (excellent match)
- **92%** → 🟢 Green badge (excellent match)
- **78%** → 🟡 Amber badge (good match)
- **85%** → 🟢 Green badge (excellent match)
- **71%** → 🟡 Amber badge (good match)

### Tooltip on Hover (Example)

```
┌─────────────────────────┐
│ Compatibility: 87%      │
├─────────────────────────┤
│ 🎯 Skill Match: 85%     │
│ ⭐ Mentor Quality: 90%  │
│ 📊 Activity Level: 88%  │
│ 👤 Profile: 75%        │
│ 🏢 Same Dept: 100%     │
│ ⏰ Schedule: 80%       │
└─────────────────────────┘
```

---

## 🧪 Test Scenarios

### Scenario 1: Normal Load ✅

**Steps:**
1. Open home.html
2. Wait 2-3 seconds for recommendations to load

**Expected:**
- 5 mentors appear with scores
- All badges are colored (green/amber based on score)
- No console errors

---

### Scenario 2: Hover Interaction ✅

**Steps:**
1. Hover over first mentor's score badge
2. Hold for 1 second
3. Move mouse away

**Expected:**
- Tooltip appears smoothly (fade-in animation)
- Shows detailed breakdown
- Tooltip disappears when mouse leaves

---

### Scenario 3: API Failure Handling ✅

**Steps:**
1. Stop the backend server (kill the npm process)
2. Refresh home.html

**Expected:**
- Shows alert: "ML Recommendations Unavailable"
- Shows default suggestions instead
- No console errors (graceful fallback)

---

### Scenario 4: Missing JWT Token ✅

**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh home.html

**Expected:**
- Shows default suggestions
- Console message: "No authentication token found"
- No crash

---

## 📋 Checklist

### Visual Verification
- [ ] Score badge visible and positioned correctly
- [ ] Badge color matches score (green ≥80, amber 60-79, red <60)
- [ ] Mentor name, department, year displayed
- [ ] Follow button visible and clickable
- [ ] Layout doesn't break on hover

### Interaction Verification
- [ ] Tooltip appears on hover
- [ ] Tooltip contains all 8 score components
- [ ] Tooltip disappears on mouse leave
- [ ] No lag or flickering

### Backend Integration
- [ ] JWT token sent in Authorization header
- [ ] API endpoint called: `/api/recommendations/mentors?limit=5`
- [ ] Response parsed correctly
- [ ] Scores match API response

### Error Handling
- [ ] No console errors when API succeeds
- [ ] Graceful fallback when API fails
- [ ] Handles missing token gracefully
- [ ] Works without `import.meta.env`

---

## 🔍 Debug Commands

**Check if recommendations are loaded:**
```javascript
// In browser console
document.querySelectorAll('.suggestion-item').length
// Should output: 5 (or your configured limit)
```

**Check API response:**
```javascript
// Copy this to console
fetch('http://localhost:5000/api/recommendations/mentors?limit=5', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('mentorlink_token')}` }
})
.then(r => r.json())
.then(d => console.log(d))
```

**Check CSS is loaded:**
```javascript
// In browser console
const badge = document.querySelector('.ml-score-badge');
getComputedStyle(badge).backgroundColor
// Should show rgba color value
```

**Verify script loaded:**
```javascript
// In browser console
typeof RecommendationEngine
// Should output: "object"
```

---

## 🛠️ Common Issues & Fixes

### Issue: "Loading suggestions..." stays forever

**Fix:**
1. Check if backend is running: `curl http://localhost:5000`
2. Check API response: Use debug command above
3. Check browser console for errors
4. Verify JWT token exists: `localStorage.getItem('mentorlink_token')`

### Issue: Tooltip doesn't appear on hover

**Fix:**
1. Check CSS loaded: `document.getElementById('recommendations-styles')`
2. Check tooltip HTML created: `document.querySelectorAll('.ml-tooltip')`
3. Try hovering longer (animation takes 200ms)

### Issue: Scores are all 0%

**Fix:**
1. Verify mentors exist in database: `db.users.find().count()`
2. Check if mentorship data exists: `db.interactions.find().count()`
3. Run analytics aggregation on backend
4. Check API response scores directly

### Issue: Colors look wrong

**Fix:**
1. Check browser DevTools → Elements tab
2. Inspect badge element
3. Verify computed styles match CSS
4. Clear browser cache: Ctrl+Shift+Delete

---

## 📸 Expected Screenshots

### Before Integration
```
━━━━━━━━━━━━━━━━━━━━━━━
    Suggestions
━━━━━━━━━━━━━━━━━━━━━━━
Loading suggestions...
```

### After Integration
```
━━━━━━━━━━━━━━━━━━━━━━━
    Suggestions
━━━━━━━━━━━━━━━━━━━━━━━
  [AJ] Alex Johnson      87% [Follow]
  [SC] Sarah Chen        92% [Follow]
  [MP] Mike Patel        78% [Follow]
  [EW] Emma Wilson       85% [Follow]
  [DK] David Kumar       71% [Follow]
```

---

## 📞 Support

If recommendations don't work:

1. **Check server logs** for API errors
2. **Check browser console** for JavaScript errors
3. **Verify database** has mentor/interaction data
4. **Check MongoDB** connection: `db.connectionStatus()`
5. **Test API directly** using curl/Postman

---

## ✅ Sign-Off Checklist

- [ ] Recommendations load on page refresh
- [ ] All 5 mentors display with correct info
- [ ] Score badges show correct colors
- [ ] Hover tooltips work smoothly
- [ ] No console errors
- [ ] Fallback works when API fails
- [ ] Mobile responsive (if testing mobile)
- [ ] Dark theme consistent with rest of app

**Date Tested:** ___________  
**Tested By:** ___________  
**Status:** ☐ PASS ☐ FAIL

---

**Ready for Production?** When all checkboxes are ✅
