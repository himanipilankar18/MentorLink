# ML-Based Mentor Recommendations - Frontend Integration

**Date:** April 22, 2026  
**Status:** ✅ Implemented and Ready for Testing  
**Version:** 1.0

---

## 🎯 Overview

The MentorLink frontend now displays **AI-powered mentor recommendations** in the right sidebar, powered by the backend ML engine (K-Means clustering + multi-factor compatibility scoring).

### What Changed

| Component | Previous | Now |
|-----------|----------|-----|
| Sidebar Suggestions | Static hardcoded list | **Dynamic ML recommendations** |
| Score Display | None | **Color-coded compatibility score (0-100%)** |
| User Insights | Basic name/role | **Hover tooltip with breakdown scores** |
| Data Source | Mock data | **Live backend API** |

---

## 🏗️ Architecture

### Files Added/Modified

```
public/
├── home.html
│   ├── New: CSS styles for ML badges & tooltips
│   └── New: Script tag loading recommendations.js
│
└── js/
    └── recommendations.js (NEW)
        ├── RecommendationEngine object
        ├── API fetching logic
        ├── Rendering functions
        └── Fallback handlers
```

### Data Flow

```
User Views Home Page
        ↓
recommendations.js loads
        ↓
Fetch JWT from localStorage
        ↓
Call GET /api/recommendations/mentors?limit=5
        ↓
Backend runs ML engine
  - K-Means clustering
  - Multi-factor scoring
  - Analytics aggregation
        ↓
Return top 5 mentors with scores
        ↓
Render in sidebar with tooltips
        ↓
User hovers on score badge → See breakdown
```

---

## 🎨 UI Components

### 1. Recommendation Item Structure

```html
<div class="suggestion-item">
  <!-- Avatar -->
  <div class="avatar-sm">AJ</div>
  
  <!-- Info (Name + Department) -->
  <div class="info">
    <div class="name">Alex Johnson</div>
    <div>Computer Engineering • Year 3</div>
  </div>
  
  <!-- ML Score Badge (COLOR CODED) -->
  <div class="ml-score-badge" style="background: rgba(16,185,129,0.15); color: #10b981;">
    87%
    
    <!-- Tooltip on Hover -->
    <div class="ml-tooltip">
      <strong>Compatibility: 87%</strong>
      <hr>
      <div>🎯 Skill Match: 85%</div>
      <div>⭐ Mentor Quality: 90%</div>
      <div>📊 Activity Level: 88%</div>
      ...
    </div>
  </div>
  
  <!-- Follow Button -->
  <button class="btn-follow">Follow</button>
</div>
```

### 2. Score Color Coding

```javascript
Score Range  | Color   | Background
≥ 80%        | Green   | rgba(16, 185, 129, 0.15)   // Excellent match
60-79%       | Amber   | rgba(251, 191, 36, 0.15)    // Good match
< 60%        | Red     | rgba(239, 68, 68, 0.15)     // Fair match
```

### 3. Tooltip Breakdown

The hover tooltip displays detailed compatibility metrics:

```
Compatibility: 87%
─────────────────────────
🎯 Skill Match: 85%
⭐ Mentor Quality: 90%
📊 Activity Level: 88%
👤 Profile Strength: 75%
🏢 Same Dept: 100%
⏰ Schedule: 80%
```

---

## 🔌 API Integration

### Endpoint Used

**GET** `/api/recommendations/mentors?limit=5`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "recommendations": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Alex Johnson",
      "department": "Computer Engineering",
      "year": "3",
      "score": 87,
      "compatibilityBreakdown": {
        "finalScore": 0.87,
        "components": {
          "skillAlignment": 85,
          "departmentMatch": 100,
          "academicProgression": 75,
          "availabilityMatch": 80,
          "mentorQuality": 90,
          "activitySignal": 88,
          "profileStrength": 75,
          "clusterFit": 82,
          "clusterBonus": 8
        }
      }
    },
    ...4 more mentors...
  ],
  "clustering": {
    "model": "kmeans",
    "clusterCount": 3,
    "vocabularySize": 42,
    "selectedCluster": 0,
    "clusters": [...]
  }
}
```

---

## 🚀 Implementation Details

### Step 1: API Fetching (`fetchMentorRecommendations`)

```javascript
// Get JWT token from localStorage
const token = localStorage.getItem('mentorlink_token');

// Fetch recommendations with auth header
const response = await fetch(
  `${apiUrl}/api/recommendations/mentors?limit=5`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

// Parse and return
const data = await response.json();
return data.success ? data : null;
```

### Step 2: Score Explanation (`getScoreExplanation`)

Generates HTML tooltip content from the breakdown:

```javascript
const tooltip = `
  <strong>Compatibility: 87%</strong>
  <hr>
  <div>🎯 Skill Match: ${components.skillAlignment}%</div>
  <div>⭐ Mentor Quality: ${components.mentorQuality}%</div>
  ...
`;
```

### Step 3: Color Coding (`getScoreColor`)

Maps score ranges to colors:

```javascript
if (score >= 80) return '#10b981';    // Green
if (score >= 60) return '#fbbf24';    // Amber
return '#ef4444';                      // Red
```

### Step 4: Rendering (`renderMLRecommendations`)

Creates DOM elements for each mentor:

```javascript
recommendations.forEach(mentor => {
  // Create suggestion item div
  const item = document.createElement('div');
  item.className = 'suggestion-item';
  
  // Populate with mentor data
  item.innerHTML = `
    <div class="avatar-sm">${initials}</div>
    <div class="info">
      <div class="name">${mentor.name}</div>
      <div>${mentor.department} • Year ${mentor.year}</div>
    </div>
    <div class="ml-score-badge" style="color: ${scoreColor};">
      ${mentor.score}%
      <div class="ml-tooltip">${tooltip}</div>
    </div>
    <button class="btn-follow">Follow</button>
  `;
  
  // Add hover interactions
  badge.addEventListener('mouseenter', () => {
    tooltip.style.display = 'block';
  });
  
  container.appendChild(item);
});
```

### Step 5: Error Handling

If API fails, displays default suggestions:

```javascript
if (!result || !result.recommendations.length) {
  renderDefaultSuggestions(container);
  return;
}
```

---

## 🎯 User Interactions

### Hover Behavior

1. **Hover over score badge** → Tooltip fades in (0.2s animation)
2. **Hover leaves badge** → Tooltip fades out
3. **Tooltip shows**: Skill match, mentor quality, activity, profile strength, etc.

### Click Behavior

- **Follow Button**: Updates UI to show "Following" state (backend integration TODO)
- **Avatar/Name**: Could link to mentor profile (future)
- **Score Badge**: Explains why this mentor was recommended

---

## 🧪 Testing Checklist

### ✅ Functional Testing

- [ ] Recommendations load on page refresh
- [ ] Correct number of mentors displayed (top 5)
- [ ] Scores are accurate (0-100%)
- [ ] Colors change based on score thresholds
- [ ] Hover tooltips appear and disappear
- [ ] Follow button toggles state
- [ ] Fallback displays if API fails

### ✅ Visual Testing

- [ ] Badges align properly with text
- [ ] Tooltips don't overflow screen edges
- [ ] Colors are visually distinct
- [ ] Animations are smooth (no lag)
- [ ] Dark theme consistency maintained
- [ ] Mobile responsive (if applicable)

### ✅ Integration Testing

- [ ] JWT token fetched correctly
- [ ] Authorization header sent properly
- [ ] API response parsed correctly
- [ ] Network errors handled gracefully
- [ ] No console errors

### ✅ Performance Testing

- [ ] Page loads in < 3 seconds
- [ ] No layout shifts after loading
- [ ] Hover tooltips respond immediately
- [ ] No memory leaks on refresh

---

## 🔧 Configuration

### API Base URL

The script automatically detects the API URL:

```javascript
const apiUrl = import.meta?.env?.VITE_API_URL || 'http://localhost:5000';
```

**To change API endpoint**, set `VITE_API_URL` in your `.env` file (for Vite projects) or modify in `recommendations.js`:

```javascript
// For standalone HTML files:
const API_BASE = 'http://your-api-server.com'; // Change this line
```

### Recommendation Limit

Default is 5 mentors. To change:

```javascript
// In recommendations.js, line ~130
initializeRecommendations(); // Change 5 to your desired number
// To:
await RecommendationEngine.fetchMentorRecommendations(10); // 10 mentors
```

---

## 📊 ML Scoring Components

The backend calculates compatibility using 8 weighted factors:

```
Final Score = Weighted Sum of Components + Cluster Bonus

Components                Weight   Description
─────────────────────────────────────────────────────────
Skill Alignment           28%      Jaccard similarity of skills
Department Match          10%      Same department bonus
Academic Progression      10%      Year difference appropriateness
Availability Match        8%       Schedule compatibility
Mentor Quality            18%      Satisfaction + completion rate
Activity Signal           11%      Recent interaction frequency
Profile Strength          10%      Profile completeness (picture, skills, CGPA, projects)
Cluster Fit              5%       K-Means cluster distance
Cluster Bonus            +8%      Bonus if in primary cluster
```

---

## 🐛 Troubleshooting

### Issue: Recommendations not loading

**Check:**
1. Is `recommendations.js` loaded? Check browser DevTools Network tab
2. Is JWT token in localStorage? Check `localStorage.getItem('mentorlink_token')`
3. Is API accessible? Test: `curl http://localhost:5000/api/recommendations/mentors -H "Authorization: Bearer TOKEN"`

### Issue: Scores are all 0%

**Possible cause:** Backend analytics not calculated for mentors yet. Ensure:
- Interaction data exists in database
- Mentorship records are created
- Run analytics aggregation query

### Issue: Tooltip cuts off screen

**Fixed in CSS:** Tooltip positioned with `right: 0` to stay within viewport

### Issue: Follow button not working

**Current status:** UI state updates only. Backend integration (POST /api/mentorship) needed.

---

## 🔄 Future Enhancements

### Phase 2: Deeper Integration

- [ ] **Follow Action**: POST `/api/mentorship/request` when clicking Follow
- [ ] **Mentor Details Modal**: Click mentor to see full profile + breakdown
- [ ] **Refresh Button**: Manual refresh of recommendations
- [ ] **Filter Options**: Filter by department, skills, availability
- [ ] **Save Preferences**: Remember which mentors user followed

### Phase 3: Advanced Analytics

- [ ] **Explainability Dashboard**: Visual breakdown of score calculation
- [ ] **Trend Analysis**: How recommendations change over time
- [ ] **Performance Metrics**: Track mentorship success rates
- [ ] **A/B Testing**: Compare different recommendation algorithms

### Phase 4: Real-time Updates

- [ ] WebSocket updates when mentors become online
- [ ] Push notifications for high-match mentors
- [ ] Caching strategy to reduce API calls

---

## 📚 Related Documentation

- [Backend Recommendation API](../API_DOCUMENTATION.md)
- [ML Engine Details](../README.md#analytics-ready-data--hardening)
- [Security Implementation](../ADMIN_SECURITY_FIX_IMPLEMENTATION.md)

---

## 📝 Summary

The ML recommendation system transforms the static "Suggestions" sidebar into an **intelligent, data-driven discovery interface**. Users can now see why they're matched with mentors (via hover tooltips) and understand the underlying AI matching logic.

**Key Metrics:**
- ✅ 5 mentors displayed (configurable)
- ✅ Compatibility scores 0-100%
- ✅ Color-coded visual hierarchy
- ✅ Detailed tooltips on hover
- ✅ Graceful fallback if API fails
- ✅ JWT-authenticated requests
- ✅ Dark theme UI consistent

---

**Last Updated:** April 22, 2026  
**Implemented By:** GitHub Copilot  
**Status:** Ready for QA Testing
