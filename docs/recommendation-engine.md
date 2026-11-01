# Mentor recommendation engine

> **Future-phase rule:** Every recommendation-engine change must, in the same PR, append an Evolution-log entry, update the affected sections, and record before/after ranking evidence.

**Purpose:** Living record of the current mentor and peer recommendation implementations.  
**Last updated:** 2026-10-13  
**Status:** ✅ Live (documentation snapshot; implementation includes known flaws)  
**Engine version:** `v0 (baseline snapshot)`  
**Baseline commit:** `cdf5e96004a4ff77d56b7f745aa6c57d81975b82` [source: repository `git rev-parse HEAD`; status: VERIFIED-RUN]

## 1. Overview

- The active mentor route returns ranked mentor candidates for an authenticated user. [source: `routes/recommendations.js:117-171`; status: VERIFIED-CODE]
- It filters candidates by activity, mentorship intent, role/year eligibility, existing relationships, and (for External users) explicit guidance opt-in. [source: `routes/recommendations.js:24-52,129-164`; status: VERIFIED-CODE]
- It combines profile fields, TF-IDF text similarity, hand-set compatibility terms, analytics, and K-Means cluster fit. [source: `utils/recommendationEngine.js:387-480,531-692`; status: VERIFIED-CODE]
- It is **not a trained ML model**; it is a rule-filtered, TF-IDF + weighted-scoring + K-Means hybrid. [source: `utils/recommendationEngine.js:89-128,270-349,387-480`; status: VERIFIED-CODE]
- The implementation returns score components and cluster metadata intended for UI explanations. [source: `utils/recommendationEngine.js:647-692`; status: VERIFIED-CODE]
- A separate peer matcher exists and is not the mentor engine documented by the main dashboard flow. [source: `routes/users.js:1293-1365`, `recommender_model/src/peerMatcher.js:75-187`; status: VERIFIED-CODE]

## 2. User flow

### Institute mentee

1. The user opens **Find Mentor** from the home page. [source: `public/home.html:2480-2488,5378-5389`; status: VERIFIED-CODE]
2. The page requests the mentor endpoint and asks for five results. [source: `public/js/recommendations.js:13-32,501-512`; status: VERIFIED-CODE]
3. The page shows ranked cards with the mentor name, role/department/year line, compatibility score, and profile information rendered by the recommendation UI. [source: `public/js/recommendations.js:527-627`; status: VERIFIED-CODE]
4. Hovering, focusing, or tapping a card expands its breakdown; displayed metrics include skill match, profile match, mentor quality, activity, profile, department, and schedule when present. [source: `public/js/recommendations.js:55-76,145-172`; status: VERIFIED-CODE]
5. The recommendation itself does not create a mentorship request; the user must use the existing mentorship flow to request one. [source: `public/js/recommendations.js:527-627`, `models/Mentorship.js:3-74`; status: VERIFIED-CODE]
6. If the request has no token, returns a non-2xx response, returns no recommendations, or throws, the browser renders default suggestions or returns the fetch result as null. [source: `public/js/recommendations.js:14-18,33-47,501-505,688-754`; status: VERIFIED-CODE]

### External-user variant

1. The same mentor endpoint is used, but the candidate query is restricted to active senior/faculty users who opted into External guidance and whose lock date is still in the future. [source: `routes/recommendations.js:37-52,140-145`; status: VERIFIED-CODE]
2. The `User` model stores the opt-in and academic-year lock fields; the schema default for opt-in is false. [source: `models/User.js:184-205`; status: VERIFIED-CODE]
3. The route removes External guidance consent fields from each recommendation and explanation before responding. [source: `routes/recommendations.js:167-179,253-270`; status: VERIFIED-CODE]
4. The code does not independently require an External mentee to have a year or department after the External candidate query; missing academic fields therefore remain possible inputs to scoring. [source: `routes/recommendations.js:129-164`, `utils/recommendationEngine.js:387-480`; status: VERIFIED-CODE]

```mermaid
sequenceDiagram
  participant I as Institute mentee
  participant E as External mentee
  participant UI as home.html + recommendations.js
  participant API as GET /api/recommendations/mentors
  participant DB as MongoDB
  participant M as Mentorship request flow

  I->>UI: Open Find Mentor
  E->>UI: Open Find Mentor
  UI->>API: GET with Bearer token and limit=5
  API->>DB: Load user, eligible mentors, analytics, relationships
  API-->>UI: Ranked recommendations + breakdown + clustering
  UI-->>I: Show top five cards
  UI-->>E: Show opted-in mentors only
  I->>M: Request mentorship separately
  E->>M: Request mentorship separately
  alt API failure or empty result
    API-->>UI: Error or empty response
    UI-->>I: Render default suggestions
    UI-->>E: Render default suggestions
  end
```

## 3. Technical flow

### Endpoints and parameters

| Endpoint | Parameters | Current behavior |
|---|---|---|
| `GET /api/recommendations/mentors` | `limit`: numeric, floored and clamped to 1–50; `department`: read into a local variable but not used in the query or scorer. | Authenticated, rate-limited mentor ranking. [source: `routes/recommendations.js:7-18,117-171`; status: VERIFIED-CODE] |
| `GET /api/recommendations/mentors/:mentorId/explain` | `mentorId` path parameter; no query parameter. | Recomputes one eligible mentor’s explanation using the same engine. [source: `routes/recommendations.js:184-287`; status: VERIFIED-CODE] |

### Pipeline

```mermaid
flowchart TD
  A[verifyToken + apiLimiter] --> B{Candidate eligibility}
  B -->|Institute| B1[Not self; active; intent offering or both]
  B1 --> B2[Faculty/admin OR candidate year greater than mentee year]
  B -->|External| B3[Not self; active; role senior or faculty]
  B3 --> B4[availableForExternalGuidance true; lock date greater than now]
  B2 --> C[Exclude pending/accepted mentors]
  B4 --> C
  C --> D[Build profile text, vocabulary, analytics, feature vectors]
  D --> E[TF-IDF cosine + Jaccard + compatibility features]
  E --> F[Apply internal defaults or External weights]
  F --> G[K-Means cluster fit and primary-cluster bonus]
  G --> H[Sort descending by matchScore]
  H --> I[Clamp limit and redact External consent fields]
  I --> J[JSON response]
```

Eligibility and pipeline behavior are implemented in [source: `routes/recommendations.js:117-179`, `utils/recommendationEngine.js:531-692`; status: VERIFIED-CODE].

### Scoring components

The engine computes a normalized score, then returns component percentages. Internal weights are the explicit weights in `calculateCompatibilityBreakdown`; fixed terms are also part of the score. External weights replace only `skills`, `interests`, `availability`, and `goals`; the other fixed terms remain. [source: `utils/recommendationEngine.js:387-480`, `config/externalRecommendationWeights.js:1-6`; status: VERIFIED-CODE]

| Component | Formula/algorithm | Inputs | Range | Internal weight | External weight | Source |
|---|---|---|---:|---:|---:|---|
| Skill alignment | Jaccard intersection/union of mentee skills+interests and mentor skills+interests | `skills`, `interests` | 0–1 | 0.20 | 0.35 (`skills`) | `utils/recommendationEngine.js:jaccardSimilarity,calculateCompatibilityBreakdown` |
| Content similarity | Cosine similarity of TF-IDF vectors | skills, interests, bio, project title/description/technologies | 0–1 | 0.12 | 0.25 (`interests`) | `utils/recommendationEngine.js:buildProfileText,calculateTfIdf,cosineSimilarity` |
| Department match | Exact uppercase equality | `department` | 0 or 1 | 0.10 | 0.10 fixed | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |
| Academic progression | `clamp((mentor.year - mentee.year + 2) / 6, 0, 1)` | `year` | 0–1 | 0.10 | 0.10 fixed | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |
| Availability | Exact lower-case equality, otherwise 0.6 | `availability` | 0.6 or 1 | 0.08 | 0.15 (`availability`) | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |
| Mentor quality | `0.6 * avgSatisfaction/5 + 0.4 * completionRate`, clamped | interaction and mentorship aggregates | 0–1 | 0.18 (`goals`) | 0.25 (`goals`) | `utils/recommendationEngine.js:calculateCompatibilityBreakdown`, `routes/recommendations.js:55-103` |
| Activity signal | `0.5 * totalInteractions/60 + 0.5 * recencyScore`, clamped | interaction count and latest timestamp | 0–1 | 0.11 fixed | 0.11 fixed | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |
| Profile strength | Five binary fields at 20 points each, divided by 100 | picture, ≥3 skills, bio, projects, CGPA | 0–1 | 0.08 fixed | 0.08 fixed | `utils/recommendationEngine.js:profileStrength` |
| Cluster fit | `1 - normalized distance`, clamped | K-Means vector and assigned centroid | 0–1 | 0.03 fixed | 0.03 fixed | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |
| Cluster bonus | `0.05` if mentor is in the selected primary cluster | selected cluster assignment | 0 or 0.05 | 0.05 additive | 0.05 additive | `utils/recommendationEngine.js:calculateCompatibilityBreakdown` |

The weighted score is clamped to 0–1 and returned as `Math.round(finalScore * 100)`. [source: `utils/recommendationEngine.js:423-430`; status: VERIFIED-CODE]

### TF-IDF

- The corpus is one mentee profile document followed by one document for every eligible mentor. [source: `utils/recommendationEngine.js:587-590`; status: VERIFIED-CODE]
- Each document includes skills, interests, bio, and project title, description, and technologies. [source: `utils/recommendationEngine.js:40-70`; status: VERIFIED-CODE]
- Text is lowercased, URLs and underscores are replaced, non `[a-z0-9\s+.#/\-]` characters are replaced, whitespace is collapsed, tokens of length ≤1 and punctuation-only tokens are discarded, and duplicate profile tokens are removed by `buildProfileText`. [source: `utils/recommendationEngine.js:13-31,40-70`; status: VERIFIED-CODE]
- TF is term count divided by document length; IDF is `log((1 + documentCount) / (1 + documentFrequency)) + 1`; vectors use TF×IDF. [source: `utils/recommendationEngine.js:89-128`; status: VERIFIED-CODE]

### Jaccard and exact matching

- Skill alignment uses exact normalized string-set overlap; normalization lowercases, trims, removes empty values, and deduplicates, but does not alias, stem, or semantically expand terms. [source: `utils/recommendationEngine.js:1-11,370-385`; status: VERIFIED-CODE]
- Department matching is exact after uppercasing. [source: `utils/recommendationEngine.js:177-179,404`; status: VERIFIED-CODE]
- This makes `node.js` and `node` distinct skill/text tokens unless they appear identically after tokenization. [source: `utils/recommendationEngine.js:13-31,370-385`; status: INFERRED]

### K-Means

- K-Means++ selects the first centroid randomly and selects later centroids using squared-distance weighted random selection. [source: `utils/recommendationEngine.js:221-268`; status: VERIFIED-CODE]
- Fewer than three mentors produces one cluster; otherwise `k = clamp(round(sqrt(n / 2)), 2, min(6,n))`. [source: `utils/recommendationEngine.js:349-353,303-317`; status: VERIFIED-CODE]
- The implementation runs at most 35 iterations, recomputes means, and reinitializes empty clusters randomly. [source: `utils/recommendationEngine.js:270-347`; status: VERIFIED-CODE]
- The closest centroid to the mentee core vector is selected; mentors in that cluster receive a 0.05 bonus. [source: `utils/recommendationEngine.js:602-624,423-430`; status: VERIFIED-CODE]

### Data sources and models

| Source | Fields read for mentor ranking | Use |
|---|---|---|
| `User` | `_id`, `name`, `role`, `isActive`, `userType`, `mentorshipIntent`, `availableForExternalGuidance`, `externalGuidanceLockedUntil`, `year`, `department`, `skills`, `interests`, `bio`, `availability`, `projects`, `cgpa`, `profilePicture` | Eligibility, text/features, response mentor object, profile strength. [source: `models/User.js:1-250`, `routes/recommendations.js:117-164`; status: VERIFIED-CODE] |
| `Interaction` | `mentorId`, `satisfactionRating`, `subjectTag`, `timestamp`; schema also defines `confirmationStatus` | Total interactions, average rating, subject breadth, latest interaction. The aggregate does **not** filter `confirmationStatus`. [source: `models/Interaction.js:3-108`, `routes/recommendations.js:61-103`; status: VERIFIED-CODE] |
| `Mentorship` | `mentorId`, `status` | Pending/accepted exclusion and accepted/terminated completion analytics. [source: `models/Mentorship.js:3-74`, `routes/recommendations.js:53-59,24-35`; status: VERIFIED-CODE] |

Interaction statistics aggregate every matching `Interaction` document; `avgSatisfaction` uses `$avg`, `subjectBreadth` uses the size of the distinct `subjectTag` set, and `lastInteractionAt` uses `$max(timestamp)`. [source: `routes/recommendations.js:61-103`; status: VERIFIED-CODE]

### Response and privacy

The mentor response is:

```json
{
  "success": true,
  "count": 0,
  "recommendations": [
    {
      "mentor": {},
      "mentorAnalytics": {},
      "matchScore": 0,
      "scoreComponents": {},
      "sharedContentTokens": [],
      "contentExplanation": "",
      "cluster": {}
    }
  ],
  "clustering": {}
}
```

The exact nested mentor object is the selected User document minus `password`; the engine adds analytics, score components, shared tokens, explanation, and cluster fields. [source: `routes/recommendations.js:147-179`, `utils/recommendationEngine.js:647-692`; status: VERIFIED-CODE]

- The route explicitly removes `externalGuidanceLockedUntil`, `externalGuidanceTermsVersion`, `externalGuidanceTermsAcceptedAt`, and `termsVersion` from recommendation and explanation objects. [source: `routes/recommendations.js:167-179,253-270`; status: VERIFIED-CODE]
- `admissionInfo` is schema-level `select: false`; the recommendation queries do not explicitly select it. [source: `models/User.js:52-73`, `routes/recommendations.js:129-164`; status: VERIFIED-CODE]
- The code does not claim that every possible private field is redacted by the recommendation route; the documented guarantees are the explicit password/query and consent-field protections above. [source: `routes/recommendations.js:129-179,231-270`; status: VERIFIED-CODE]

### Frontend consumption and fallback

The static home page loads `/js/recommendations.js`, initializes recommendations when Find Mentor is opened and on page load, and exposes a Refresh matches button. [source: `public/home.html:5378-5389,9324-9332`; status: VERIFIED-CODE] The script calls the mentor endpoint with `limit=5`, maps `matchScore` and `scoreComponents`, renders cards, and falls back to default mentor cards for an empty/error result. [source: `public/js/recommendations.js:13-47,501-754`; status: VERIFIED-CODE]

### Separate peer engine

`GET /api/users/peers/recommendations` is a different system, not an alternate implementation of the main mentor endpoint. [source: `routes/users.js:1293-1365`; status: VERIFIED-CODE]

- It filters active users and optionally filters to the target department; it reads a 180-day interaction window. [source: `routes/users.js:1299-1331`; status: VERIFIED-CODE]
- It scores profile similarity, interest-to-skill complementarity, inferred reliability, availability, year/department context, and a reciprocal penalty. [source: `recommender_model/src/peerMatcher.js:1-187`; status: VERIFIED-CODE]
- Its defaults are profile 0.35, complementarity 0.20, reliability 0.25, availability 0.10, and context 0.10. [source: `recommender_model/src/peerMatcher.js:88-94`; status: VERIFIED-CODE]
- It returns `peers`, optionally with a breakdown, and metadata mode `peer_directional_v1`; the mentor engine returns `recommendations`, `matchScore`, TF-IDF/Jaccard components, and K-Means metadata. [source: `routes/users.js:1334-1365`, `utils/recommendationEngine.js:647-692`; status: VERIFIED-CODE]
- Both systems use exact normalized tokens, availability, academic context, and historical activity, but they use different formulas, fields, limits, eligibility rules, time windows, output names, and anti-gaming behavior. [source: `utils/recommendationEngine.js:387-480`, `recommender_model/src/peerMatcher.js:1-187`; status: VERIFIED-CODE]

## 4. Known flaws of v0 (baseline)

| # | Severity | Flaw | Impact on explainability/trust | Evidence |
|---:|---|---|---|---|
| 1 | High | K-Means++ and empty-cluster recovery use `Math.random()`. | The same inputs can receive different cluster assignments, cluster fit, bonus, and potentially ranking; explanations are not guaranteed stable. | `utils/recommendationEngine.js:221-268,303-347`; [status: VERIFIED-CODE] |
| 2 | High | External weights are added alongside fixed terms and a cluster bonus; the total can exceed 1 before clamping. | Scores can saturate at 100, hiding differences and overstating calibration. | `config/externalRecommendationWeights.js:1-6`, `utils/recommendationEngine.js:387-430`; [status: VERIFIED-CODE] |
| 3 | High | Interaction aggregation does not filter `confirmationStatus`. | Pending/unconfirmed interactions can influence activity, quality, breadth, and recency. | `models/Interaction.js:64-70`, `routes/recommendations.js:61-103`; [status: VERIFIED-CODE] |
| 4 | Medium | `department` request parameter is unused. | A caller can believe it requested department filtering when ranking behavior is unchanged. | `routes/recommendations.js:120-121,129-164`; [status: VERIFIED-CODE] |
| 5 | Medium | Python mentor-scoring fallback is dormant because `scripts/mentor_scoring.py` is absent in this snapshot. | The fallback cannot be selected; documentation or operational assumptions about Python scoring would be misleading. | `routes/users.js:23-24,436-440`; file absence inspected in repository; [status: VERIFIED-CODE] |
| 6 | Medium | The strong technical fixture assertion fails: `contentSimilarity < 60`. | The stated fixture expectation is not met; the first confidence signal in the verification script is false. | `verify-v2-recommendations.js:75-82`; safe run output below; [status: VERIFIED-RUN] |
| 7 | Medium | The failure above has not been demonstrated to be caused by K-Means randomness. | It would be incorrect to attribute the failed assertion to randomness without repeated controlled runs or a seeded comparison. | `verify-v2-recommendations.js:75-82`, `utils/recommendationEngine.js:221-268`; [status: VERIFIED-RUN] |
| 8 | Medium | The frontend Authorization header is visibly malformed (`Authorization: \`******`) even though Node syntax check accepts the file. | Browser requests may send an unintended header value; `node --check` does not prove runtime request correctness. | `public/js/recommendations.js:26-31`; safe syntax check result below; [status: VERIFIED-CODE] |
| 9 | Medium | Skill and token matching is exact after basic normalization; no aliases or stemming are applied. | Equivalent concepts with different spellings can score as unrelated, weakening reason quality. | `utils/recommendationEngine.js:1-31,370-385`; [status: VERIFIED-CODE] |
| 10 | Medium | TF-IDF is fit on the current mentee plus current eligible mentor corpus. | Small or changing candidate pools change IDF and similarity; scores are not comparable across requests or cohorts. | `utils/recommendationEngine.js:587-590`; [status: VERIFIED-CODE] |
| 11 | Medium | Missing numeric/profile fields fall back to zero in several features. | Sparse profiles can receive low quality/activity/content values without a missing-data explanation. | `utils/recommendationEngine.js:1-7,145-158,387-430`; [status: VERIFIED-CODE] |
| 12 | Medium | Activity and quality signals reward interaction volume and recency without a cap beyond normalization. | Existing high-volume mentors can receive a rich-get-richer advantage over new mentors. | `utils/recommendationEngine.js:411-414`, `routes/recommendations.js:61-103`; [status: INFERRED] |
| 13 | High | Mentor and peer engines have inconsistent formulas, eligibility, time windows, defaults, and response contracts. | Users and evaluators can receive different concepts of “best match” depending on entry point. | `routes/recommendations.js:117-287`, `routes/users.js:1293-1365`, `recommender_model/src/peerMatcher.js:75-187`; [status: VERIFIED-CODE] |

## 5. Baseline snapshot and reproduction

### Safe commands

Run from `MentorLink`:

```powershell
node --check .\utils\recommendationEngine.js
node --check .\routes\recommendations.js
node --check .\public\js\recommendations.js
node .\verify-v2-recommendations.js
```

The three syntax checks exited successfully. [source: command execution in this documentation task; status: VERIFIED-RUN] The fixture command exited with code 1 because the first case failed, while the script printed the remaining five case lines as `PASS` and then `ALL CASES PASSED`. [source: command execution in this documentation task; status: VERIFIED-RUN]

### Fixture output (verbatim)

```text
FAIL: Strong technical match contentSimilarity too low for strong match
PASS: Different department but strong match is not filtered out
PASS: Bio/project match differentiates ranking
PASS: Empty bio/projects remain safe
PASS: Blocked mentors are excluded
PASS: Explain calculations are consistent across requests
ALL CASES PASSED
```

The fixtures are in `verify-v2-recommendations.js` and use in-memory objects; they do not access MongoDB or live-user data. [source: `verify-v2-recommendations.js:1-240`; status: VERIFIED-CODE] The script uses `Date.now()` for fixture timestamps and the engine uses unseeded `Math.random()` for K-Means++, so exact ranking reproduction is not guaranteed. [source: `verify-v2-recommendations.js:11-14`, `utils/recommendationEngine.js:221-268`; status: VERIFIED-CODE] No live endpoint, database, or user data was used. [source: task execution scope; status: VERIFIED-RUN]

## 6. Decisions log

### 2026-10-13

- K-Means will be removed from production in a later phase but retained as a seeded ablation baseline for the paper. [source: task brief; status: INFERRED]
- Weights remain hand-set and justified by ablation; learning weights from outcomes is future work and out of scope because outcome data is too limited. [source: task brief; status: INFERRED]
- No user study is claimed; evaluation is offline, with historical outcomes labeled as such and synthetic data labeled synthetic. [source: task brief; status: INFERRED]
- Paper framing is an applied explainable system with rigorous evaluation, not a new algorithm. [source: task brief; status: INFERRED]
- Nothing is removed from production until the owner approves a phase. [source: task brief; status: INFERRED]

## 7. Target design (planned, not implemented)

All items in this section are `📋 Planned`; none changes the current implementation. [source: task brief and current implementation above; status: INFERRED]

### Principles

- Deterministic ranking.
- Additive contributions that sum exactly to the displayed score.
- Evidence-backed reasons and confidence labels.
- Missing-feature renormalization.
- No hidden bonuses.

### Keep, remove, replace, add

| Action | Planned target | Status |
|---|---|---|
| Keep | Eligibility protections, mentorship relationship exclusion, explicit External opt-in, and privacy redaction. | 📋 Planned |
| Remove | Unseeded production K-Means ranking influence and hidden cluster bonus. | 📋 Planned |
| Replace | Mixed fixed/weighted score with transparent additive contributions whose displayed terms sum exactly. | 📋 Planned |
| Add | Alias/stemming normalization, missing-feature handling, evidence extraction, confidence labels, and stable evaluation artifacts. | 📋 Planned |
| Ablation-only | Seeded K-Means variant retained for paper comparison, not production ranking. | 📋 Planned |

### Three explanation layers

1. **Contribution:** each feature’s signed/additive contribution to the final score. [source: task brief; status: INFERRED]
2. **Evidence:** the concrete matching skills, interests, profile/project tokens, and analytics evidence used. [source: task brief; status: INFERRED]
3. **Gaps:** missing or unsupported fields, excluded signals, and uncertainty/confidence limits. [source: task brief; status: INFERRED]

## 8. Roadmap

| Phase | Scope | Status |
|---|---|---|
| R0 | Fixes and frozen baseline, including a seeded v0 reproduction. | 📋 Planned |
| R1 | Transparent additive scorer. | 📋 Planned |
| R2 | Evidence, explanations, and confidence. | 📋 Planned |
| R3 | Normalization: aliases/stemming and TF-IDF corpus fix. | 📋 Planned |
| R4 | Evaluation harness with random, popularity, Jaccard-only, TF-IDF-only, seeded v0, and K-Means baselines; Hit@k, NDCG@k, MRR, coverage, exposure Gini, run-to-run stability, deletion-test explanation faithfulness, and ablations. | 📋 Planned |
| R5 | Exposure-aware re-ranking. | 📋 Planned |
| R6 | Unify with peer matcher and plug in mentor rating score when that feature exists. | 📋 Planned |

## 9. Evaluation plan and limitations

- Available implementation evidence is the built-in synthetic fixture script and source inspection; no live endpoint or database evaluation was run for this document. [source: `verify-v2-recommendations.js:1-240`; status: VERIFIED-RUN]
- Historical outcomes may be used in a future offline evaluation only when explicitly labeled historical. [source: task brief; status: INFERRED]
- Synthetic records must remain explicitly labeled synthetic and must not be presented as real users or outcomes. [source: task brief; status: INFERRED]
- Threats to validity include small data, one institute context, self-reported profiles, changing candidate-corpus IDF, unconfirmed interaction records, and two different recommendation systems. [source: `models/User.js:124-205`, `routes/recommendations.js:61-103`, `utils/recommendationEngine.js:587-590`, peer-engine sources above; status: VERIFIED-CODE]

| Result | Value |
|---|---|
| Ranking quality results | TBD |
| Baseline comparison | TBD |
| Coverage and exposure | TBD |
| Stability | TBD |
| Explanation faithfulness | TBD |

## Data inventory (V1)

### Field inventory

| Field | Type | Collected where | Read by engine? | How used |
|---|---|---|---|---|
| `name` | String | Registration; Edit Profile | Peer matcher; route payloads | Display only; peer result output |
| `firstName`, `lastName`, `nickname`, `displayName` | String | Legacy Profile Setup only | No | Not used by either recommender |
| `email` | String | Registration | No | Authentication/identity only |
| `userType` | Enum | Registration | Route only | External eligibility branch; not a score feature |
| `instituteRole` | Enum | Registration | No | Identity context only |
| `graduationYear` | Number | Registration | No | Not used by either recommender |
| `admissionInfo.entranceExam` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.examName` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.score` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.percentile` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.rank` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.interestedProgram` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.interestedBranch` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.admissionStatus` | String | Registration (External) | No | Private admission data; not used |
| `admissionInfo.guidanceTopics` | String array | Registration (External) | No | Private admission data; not used |
| `whatsapp`, `telegram`, `website` | String | Edit Profile/schema only | No | Contact/profile metadata; not used |
| `githubUrl`, `projectLink` | String | Enrichment; Edit Profile | No direct read | Links are stored; project content is not fetched by either engine |
| `password` | String, hidden | Registration; legacy profile completion | No | Authentication only |
| `year` | Number | Registration; Edit Profile | Mentor engine; peer matcher; route | Academic progression/year compatibility and mentor eligibility |
| `department` | Enum String | Registration (`branch`); Edit Profile | Mentor engine; peer matcher | Exact department match/context; also route filtering/eligibility |
| `role` | Enum String | Registration-derived; admin bootstrap | Route only | Mentor candidate and requester eligibility; not a score term |
| `skills` | String array | Enrichment; legacy completion; Edit Profile | Mentor engine; peer matcher | Vocabulary, Jaccard alignment, TF-IDF text, peer profile/complementarity |
| `interests` | String array | Enrichment; legacy completion; Edit Profile | Mentor engine; peer matcher | Vocabulary, Jaccard alignment, TF-IDF text, peer profile/complementarity |
| `bio` | String | Enrichment; legacy completion; Edit Profile | Mentor engine only | TF-IDF profile text and profile-strength feature |
| `mentorshipIntent` | Enum String | Enrichment; legacy completion; Edit Profile | Route only | Internal candidate filter; External route currently uses consent instead |
| `availability` | Enum String | Enrichment; legacy completion; Edit Profile | Mentor engine; peer matcher | Encoded availability and compatibility |
| `availableForExternalGuidance` | Boolean | Consent settings | Route only | External mentor eligibility; not a score term |
| `externalGuidanceLockedUntil`, `externalGuidanceTermsVersion`, `externalGuidanceTermsAcceptedAt` | Date/String/Date | Consent settings | Route only | Consent lock, terms, and redaction; not scored |
| `projects[].title`, `projects[].description`, `projects[].technologies` | Nested String fields | Legacy completion; Edit Profile | Mentor engine only | TF-IDF profile text |
| `cgpa` | Number | Legacy completion; Edit Profile | Mentor engine only | Profile-strength feature; no direct compatibility term |
| `profilePicture` | String | Enrichment; legacy completion; Edit Profile | Mentor engine only | Profile-strength feature |
| `followers`, `following` | ObjectId arrays | Follow endpoints | No | Social graph; not used by either recommender |
| `profileComplete`, `isVerified`, `isActive` | Boolean | Auth/registration | Route only | Account and active-candidate gating |
| `emailVerificationToken`, `emailVerificationExpires`, `emailVerificationOTP`, `otpExpires` | String/Date, hidden | Auth flows | No | Verification only |
| `resetPasswordToken`, `resetPasswordExpires` | String/Date, hidden | Password reset | No | Password reset only |
| `isOnline`, `lastActiveAt` | Boolean/Date | Realtime/auth activity | No | Presence only |
| `createdAt`, `updatedAt` | Dates | Mongoose timestamps | No | Audit/timestamps only |

### Aggregate data profile

| Measure | Counts/frequencies |
|---|---|
| Database scope | 448 User documents; aggregate-only query on 2026-11-01; no names, emails, bios, or other personal text emitted |
| Role | `junior` 263; `senior` 184; `faculty` 1; `admin` 0 |
| `userType` | missing 447; `EXTERNAL` 1; `INSTITUTE_MEMBER` 0 |
| Year | 1: 141; 2: 121; 3: 130; 4: 54; missing: 2 |
| Mentorship intent | `both` 170; `offering` 139; `seeking` 138; missing: 1 |
| Availability | `flexible` 171; `weekdays` 138; `weekends` 138; missing: 1 |
| Department raw | `COMPS` 304; `CSE` 138; `IT` 4; `EXTC` 1; missing: 1 |
| Department normalized | Same as raw after trim/uppercase; no case/spacing variants observed |
| Non-empty fill rates | Skills 447/448; interests 447/448; bio 447/448; projects 443/448; CGPA 19/448; availability 447/448; mentorship intent 447/448; profile picture 437/448 |
| Skills per user | 0: 1; 1: 2; 2: 29; 3: 192; 4: 202; 5: 14; 7: 3; 8: 2; 10: 3 |
| Interests per user | 0: 1; 1: 11; 2: 134; 3: 296; 4: 3; 5: 2; 6: 1 |
| Projects per user | 0: 5; 1: 350; 2: 92; 3: 1 |
| Bio length buckets | 0: 1; 1-50: 6; 51-100: 439; 101-150: 1; 151-200: 1; over 200: 0 |
| Mentor pool | Seniors 184; faculty 1; `offering` 139; `both` 170; senior + offering/both 130; faculty + offering/both 1 |
| Interactions | Total 1,438; confirmation missing 1,427; confirmed 11; distinct mentors with confirmed interaction 3 |
| Mentorships | Total 10; accepted 10; terminated 0; accepted or terminated 10 |
| Recognition | Achievements 3, all level 1; ContributionEvents 43 |

### Skills and interests frequency inventory

| Taxonomy | Distinct values | Top values by frequency |
|---|---:|---|
| Skills | 60 | `machine learning` 175; `react` 164; `sql` 164; `python` 158; `java` 155; `node.js` 153; `javascript` 150; `c` 143; `mongodb` 64; `app / web development` 63; `c++` 62; `deep learning` 37; `devops` 36; `pcb design` 8; `css` 2; `firebase` 2; `git` 2; `Java` 1; `Python` 1; `airflow` 1; `algorithms` 1; `android` 1; `api design` 1; `api integration` 1; `automation` 1; `computer vision` 1; `dart` 1; `data preprocessing` 1; `data structures` 1; `data visualization` 1; `data warehousing` 1; `database systems` 1; `dsa` 1; `etl` 1; `express` 1; `flask` 1; `flutter` 1; `html` 1; `iot` 1; `kotlin` 1; `mathematics` 1; `mlops` 1; `nlp` 1; `numpy` 1; `opencv` 1; `operating systems` 1; `pandas` 1; `postgresql` 1; `power bi` 1; `pytorch` 1; `react basics` 1; `reactjs` 1; `redis` 1; `rest api` 1; `system design` 1; `tailwind` 1; `tensorflow` 1; `testing` 1; `typescript` 1; `ui design` 1 |
| Interests | 51 | `open source` 159; `ai ml` 150; `web development` 140; `mobile apps` 134; `data analytics` 133; `ai/ml` 101; `app development` 83; `data science` 70; `ui/ux design` 53; `cybersecurity` 50; `competitive programming` 47; `devops` 24; `Machine Learning` 4; `Web Development` 4; `blockchain` 4; `Algorithms` 2; `hackathons` 2; `mentorship` 2; `AI/ML` 1; `Cloud Computing` 1; `CyberSecurity` 1; `Database Systems` 1; `DevOps` 1; `Frontend Development` 1; `Python` 1; `Research` 1; `System Design` 1; `ai` 1; `ai research` 1; `analytics` 1; `backend engineering` 1; `business intelligence` 1; `cloud infrastructure` 1; `community building` 1; `community events` 1; `computer vision` 1; `data engineering` 1; `design systems` 1; `developer tools` 1; `embedded systems` 1; `frontend architecture` 1; `mentoring` 1; `model deployment` 1; `peer learning` 1; `product design` 1; `product thinking` 1; `project based learning` 1; `research papers` 1; `startup building` 1; `startup culture` 1; `ui ux` 1 |

### Engine dependency check

| Scoring/eligibility component | User fields and other inputs | Observed data effect |
|---|---|---|
| Candidate eligibility | `role`, `isActive`, `mentorshipIntent`, `userType`, External consent, `year`, active mentorships | 130 senior and 1 faculty have offering/both; the single External record and two missing-year users make External/generalized behavior underpowered |
| Skill alignment (Jaccard) | `skills`, `interests` | 447/448 users have both arrays non-empty; high coverage, but aliases and case variants fragment overlap |
| TF-IDF/content similarity | `skills`, `interests`, `bio`, project title/description/technologies | Bio is non-empty for 447/448 and projects for 443/448; content coverage is strong, but free-text/array taxonomy variants reduce exact-token recall |
| Department match | `department` | Only one missing department; `COMPS` and `CSE` are separate categories (304 vs 138), so institutional equivalence is not represented |
| Academic progression | `year` | 446/448 have year; two missing values receive zero/default progression behavior |
| Availability | `availability` | 447/448 are populated; `flexible` is common and the engine treats non-equal values as 0.6 rather than flexible-compatible |
| Mentor quality/activity | Interaction aggregates and mentorship aggregates | 1,427/1,438 interactions lack confirmation status; current route aggregates them anyway; only 3 mentors have confirmed interactions |
| Profile strength | `profilePicture`, `skills`, `bio`, `projects`, `cgpa` | Picture 437/448, skills 447/448, bio 447/448, projects 443/448, but CGPA only 19/448; profile strength is therefore dominated by non-CGPA fields |
| Peer profile similarity/complementarity | `skills`, `interests` | High array coverage, but no confirmed-interaction filter in peer input is guaranteed by the matcher itself |
| Peer reliability | `Interaction.mentorId`, `menteeId`, `satisfactionRating` | Only 11 confirmed interactions exist, while matcher counts every supplied interaction; reliability evidence is sparse and potentially unconfirmed |
| Peer context | `year`, `department` | Year coverage is high; department is populated for 447/448, but COMPS/CSE normalization remains unresolved |

### Proposed-field gap analysis

| Proposed field | Existing equivalent | Existing source | Candidate scoring component |
|---|---|---|---|
| `helpWanted` | No structured equivalent; partial overlap with `mentorshipIntent` and interests | User fields; profile text | New need-to-capability complementarity; could enrich Jaccard/TF-IDF |
| `careerTrack` | No structured field; partial overlap with department, role, interests, bio/projects | User fields and profile text | New career/domain compatibility |
| `learningGoal` | No structured field; partial overlap with bio, interests, project text | User profile text | Goal-to-capability/content similarity |
| `topicsCanHelp` | No structured field; partial overlap with skills/interests/projects | User profile text | Directional complementarity and mentor eligibility |
| `experience` | No structured field; partial overlap with year, projects, interactions, achievements | User, Interaction, Achievement, ContributionEvent | Mentor quality/evidence and capability depth |
| `languages` | No structured field; partial overlap with skills/project technologies | Skills/projects only | Communication/language compatibility |
| `preferredContact` | No structured field; partial overlap with availability | Availability only | Contact-mode compatibility |
| `timeBands` | No structured field; coarse `availability` only | User availability | Replace coarse schedule compatibility |
| `maxMentees` | No equivalent | No current source | Capacity/eligibility and exposure-aware reranking |
| `externalGoals` | No structured field; partial overlap with External `admissionInfo` and `guidanceTopics` | Private admission fields; not read by engines | External goal-to-mentor-topic matching |
| `examsAppeared` | Partial equivalent: `admissionInfo.entranceExam`, `examName` | Private External registration data | External admissions guidance matching; must remain privacy-gated |

### Risks and questions from V1 data

| Risk/question | Evidence |
|---|---|
| Are `COMPS` and `CSE` semantically equivalent for matching? | 304 `COMPS` vs 138 `CSE`; no normalized variant was observed |
| Should historical interactions without `confirmationStatus` be excluded? | 1,427 of 1,438 have missing confirmation status |
| Are legacy ContributionEvent types still supported? | Database contains `HIGH_SATISFACTION`, `LONG_SESSION`, and `SESSION_CONFIRMED`, but current schema enum lists different event types |
| Is the current database representative of External users? | Only 1 `EXTERNAL` user and 447 missing `userType` values |
| Can mentor quality be evaluated from current evidence? | Only 3 mentors have any confirmed interaction and no mentorship is terminated |
| Should taxonomy aliases be canonicalized? | Examples include `machine learning`/`Machine Learning`, `ai ml`/`ai/ml`/`AI/ML`, `react`/`reactjs`/`react basics`, and `java`/`Java` |

## 10. Evolution log

### v0 baseline documented

- **Date:** 2026-10-13
- **Commit:** `cdf5e96004a4ff77d56b7f745aa6c57d81975b82`
- **What exists:** Rule-filtered mentor endpoint with TF-IDF, Jaccard compatibility, weighted terms, K-Means fit/bonus, frontend cards/fallback, and a separate peer matcher. [source: implementation sources in sections 1–3; status: VERIFIED-CODE]
- **Known flaws:** See [Known flaws of v0](#4-known-flaws-of-v0-baseline). [source: this document; status: VERIFIED-CODE]
- **Evidence:** Syntax checks passed; the fixture script exited 1 on the strong technical content-similarity assertion. [source: safe commands and output in section 5; status: VERIFIED-RUN]

### Data inventory (V1)

- **Date:** 2026-11-01
- **What changed:** Added a schema-to-engine field inventory, aggregate-only database profile, frequency inventory, dependency assessment, and proposed-field gap analysis.
- **Why:** Establish the actual coverage, sparsity, taxonomy fragmentation, and interaction evidence available before changing recommendation inputs.
- **Files touched:** `docs/recommendation-engine.md`; no application code or database records changed.
- **Effect on rankings:** No ranking behavior changed; before/after ranking evidence is not applicable.
- **Evidence:** Aggregate `countDocuments`/`aggregate` inspection completed against the configured database; output contained counts and taxonomy frequencies only.

### Future entry template

```text
Version | Date | Phase | What changed | Why | Files touched | Effect on rankings (before/after on fixed fixtures) | Evidence (executed vs inspected) | Doc sections updated
```

## 11. Open questions and glossary

### Open questions

- Should `User.role` or `userType` be authoritative for mentor eligibility? [source: `models/User.js:75-123`, `routes/recommendations.js:129-164`; status: VERIFIED-CODE]
- How should External users without year or department be scored and explained? [source: `routes/recommendations.js:129-164`, `docs/tasks.md:45-47`; status: VERIFIED-CODE]
- Which historical outcomes are available and trustworthy enough for offline evaluation? [source: task brief; status: INFERRED]
- What owner-approved phase will remove K-Means from production? [source: task brief; status: INFERRED]

### Glossary

| Term | Meaning |
|---|---|
| TF-IDF | Term frequency–inverse document frequency; here, a term-count vector weighted by corpus document frequency. [source: `utils/recommendationEngine.js:89-128`; status: VERIFIED-CODE] |
| Jaccard | Intersection size divided by union size for two sets. [source: `utils/recommendationEngine.js:370-385`; status: VERIFIED-CODE] |
| K-Means | Iterative centroid clustering using nearest-centroid assignment and mean recomputation. [source: `utils/recommendationEngine.js:270-347`; status: VERIFIED-CODE] |
| NDCG | Normalized discounted cumulative gain, a rank-quality metric that discounts lower-ranked relevant results. [source: task brief; status: INFERRED] |
| MRR | Mean reciprocal rank, the mean of the reciprocal rank of the first relevant result. [source: task brief; status: INFERRED] |
| Hit@k | Whether at least one relevant result appears in the first k results, aggregated over cases. [source: task brief; status: INFERRED] |
| Ablation | An evaluation that removes or changes one component to measure its effect. [source: task brief; status: INFERRED] |
| Faithfulness | Whether an explanation reflects the actual scorer; the planned deletion test removes cited evidence and measures score change. [source: task brief; status: INFERRED] |

## 12. V1 specification

`recommender/versions/v1/index.js` is a frozen, pure copy of the internal-path baseline at `cdf5e96`. It does not import production code or access MongoDB.

```mermaid
flowchart TD
  A[seeker + candidates + aggregate rows] --> B[eligibility]
  B --> C[profile text and skill vocabulary]
  C --> D[TF-IDF cosine and Jaccard]
  C --> E[feature vectors]
  E --> F[K-Means++]
  D --> G[weighted score]
  F --> G
  G --> H[+0.05 primary-cluster bonus and clamp]
  H --> I[rounded descending ranking]
```

| Rule/component | V1 behavior | Status |
|---|---|---|
| Internal eligibility | Active, not self, `offering`/`both`, and faculty/admin or candidate year greater than seeker year; pending/accepted mentorships excluded | VERIFIED-CODE |
| External eligibility | Active senior/faculty, `availableForExternalGuidance === true`, and lock date after injected `now`; pending/accepted mentorships excluded | VERIFIED-CODE |
| Profile text | Lowercase skills, interests, bio, and project title/description/technologies; URL removal and punctuation tokenizer from baseline | VERIFIED-CODE |
| TF-IDF | `idf = log((1 + documentCount) / (1 + documentFrequency)) + 1`; term frequency is count/document length; cosine clamped to 0–1 | VERIFIED-CODE |
| Skill alignment | Jaccard of seeker interests+skills against candidate skills+interests | VERIFIED-CODE |
| Academic progression | `clamp((candidate.year - seeker.year + 2) / 6, 0, 1)` | VERIFIED-CODE |
| Availability | Exact lowercase equality gives 1; mismatch gives 0.6 | VERIFIED-CODE |
| Mentor quality | `clamp((avgSatisfaction/5)*0.6 + completionRate*0.4, 0, 1)` | VERIFIED-CODE |
| Activity | `clamp((totalInteractions/60)*0.5 + recencyScore*0.5, 0, 1)` | VERIFIED-CODE |
| Profile strength | 20 points each for picture, three skills, bio, project, and CGPA; divide by 100 | VERIFIED-CODE |
| Cluster fit | `clamp(1 - normalizedDistance, 0, 1)`; normalized distance divides Euclidean distance by `sqrt(vector length)` | VERIFIED-CODE |
| Internal weights | skills .20, interests .12, availability .08, goals .18; fixed department .10, progression .10, activity .11, profile .08, cluster .03 | VERIFIED-CODE |
| External weights | skills .35, interests .25, availability .15, goals .25; fixed terms remain unchanged | VERIFIED-CODE |
| Bonus and output | Primary cluster adds .05, total clamps to 0–1, `score` is rounded percentage, ranking sorts by rounded score | VERIFIED-CODE |
| Cluster count | Fewer than 3 candidates: 1; otherwise `clamp(round(sqrt(n/2)), 2, min(6,n))` | VERIFIED-CODE |
| K-Means++ | Injected RNG selects first centroid, weighted squared-distance centroids, 35-iteration limit, random replacement for empty clusters | VERIFIED-CODE |

Output shape is `{ ranking: [{ id, score, scoreRaw, components, evidence, meta }], model: { version, weights, clusterInfo } }`. The only experimental controls relative to the historical implementation are dependency-free injected `rng`, injected `now`, removal of database access, and pseudonymous IDs supplied by the research dataset.

## 13. Provenance of V1

| Item | Evidence |
|---|---|
| Baseline tag | `rec-engine-pre-v1` points to HEAD `a3c4f87d7239be02ec24350fa10eab1fa974e910` |
| Source extraction | `git show cdf5e96:utils/recommendationEngine.js` and `git show cdf5e96:routes/recommendations.js` |
| Later recommendation changes | `git log cdf5e96..HEAD` shows no changes to `utils/recommendationEngine.js`, `routes/recommendations.js`, `config/externalRecommendationWeights.js`, or `recommender_model/src/peerMatcher.js`; `docs/recommendation-engine.md` was added in `e25b33a` |
| Production isolation | V1 is a new module; production engine, route, UI, models, and schema were not modified |
| Controls | RNG is `mulberry32(seed)`; clock is caller-provided `now`; no `Math.random`, `Date.now`, DB calls, or production imports |

## 14. Defect register

| ID | Defect | V1 verification | Measured in V1 |
|---|---|---|---|
| D01 | K-Means++ uses random initialization | VERIFIED-CODE | Seed changes produced average Kendall tau 0.7137 |
| D02 | Sorts on rounded score; ties retain pool order | VERIFIED-CODE | Tie rate 87.28–87.72% of seeker top-10 lists |
| D03 | Weights exceed 1 and score is clamped | VERIFIED-CODE | Maximum observed score 78; no score reached 100 |
| D04 | Unconfirmed interactions are counted | VERIFIED-CODE | Export preserves confirmation status but V1 does not filter it |
| D05 | Empty values can match; year defaults to zero | VERIFIED-CODE | Missing-field behavior preserved; no imputation measurement |
| D06 | Trailing punctuation can remain; no stopword list | VERIFIED-CODE | Tokenizer copied unchanged |
| D07 | Department parameter/dead Python branch | INFERRED | Department route parameter is outside pure V1; dead Python branch not in JS baseline |
| D08 | Role/year-ahead eligibility | VERIFIED-CODE | 3,994 top-10 rows generated from 448 seekers |
| D09 | Needs and capabilities are merged | VERIFIED-CODE | Same merged sets feed Jaccard |
| D10 | Exact department match | VERIFIED-CODE | Cross-department top-10 share 9.89–11.22% |
| D11 | Hidden cluster bonus and typicality-like cluster fit | VERIFIED-CODE | Cluster metadata and 0.05 bonus emitted |
| D12 | Jaccard penalizes broad helpers | VERIFIED-CODE | Formula preserved |
| D13 | Skills are counted in both Jaccard and text similarity | VERIFIED-CODE | Same source fields feed both |
| D14 | Profile strength is scored | VERIFIED-CODE | Component emitted for every ranking |
| D15 | Cold start has no shrinkage | VERIFIED-CODE | Zero analytics defaults preserved |
| D16 | No mentee capacity term | VERIFIED-CODE | No capacity field or component |
| D17 | Availability mismatch is a fixed 0.6 | VERIFIED-CODE | Formula preserved |
| D18 | IDF depends on candidate pool | VERIFIED-CODE | TF-IDF corpus is seeker plus current pool |
| D19 | No calibrated evidence/confidence/exact contributions | VERIFIED-CODE | Evidence is explanatory text and tokens only |
| D20 | Fragmented vocabulary | VERIFIED-CODE | No alias normalization |
| D21 | K-Means depends on mentee candidate pool | VERIFIED-CODE | Features include seeker department and pool-derived vocabulary |
| D22 | No structured needs/offers/language/capacity data | VERIFIED-CODE | No such inputs in V1 |
| D23 | Rich-get-richer activity/profile effects | VERIFIED-CODE | Activity and profile terms remain additive |
| D24 | Hand-set weights are not validated | VERIFIED-CODE | No learned calibration or evaluation objective |

## 15. Version roadmap

| Version | Planned change | Defects addressed | Evidence target |
|---|---|---|---|
| V1 | Frozen historical baseline and descriptive runner | None; preserve D01–D24 | Reproducibility, descriptive distributions, stability |
| V2.0 | Transparent additive scorer | D02–D07, D09–D18 | Component-level ranking evidence |
| V2.1 | Dynamic peer-to-peer roles and structured needs/offers | D08, D16, D22, D23 | Consent-aware reciprocal matching |
| V2.2 | Vocabulary normalization and corpus controls | D06, D18, D20 | Holdout similarity and alias ablations |
| V2.3 | Capacity, availability, and missingness handling | D05, D15–D17 | Missingness-stratified metrics |
| V2.4 | Exposure-aware re-ranking and calibration | D03, D19, D24 | Fairness, calibration, and exposure reports |
| V3 | Unified mentor/peer engine with validated offline evaluation | D10–D14, D21 | NDCG, MRR, Hit@k, ablations |
| V4 | Offline learned ranker research track | Remaining hand-set/interaction defects | Latent-label simulation only; production approval required |

Dynamic peer-to-peer roles are planned for V2.1. Production authorization remains on `User.role` until a deliberate migration decision.

## 16. Datasets and evaluation design

| Dataset | Purpose | Rules |
|---|---|---|
| D1 | Descriptive snapshot of current engine-readable records | No live-document writes; pseudonymous IDs; counts and frequencies only in reports |
| D2 | Latent-variable simulation | Ground truth comes only from hidden latents; separate generation and evaluation seeds |
| D3 | Enriched synthetic profiles | Tests proposed structured fields without changing live documents |
| R | 16 real respondents | Owner-confirmed consent; the real form PDF contains names/emails and must never be committed or quoted |

All synthetic evaluations use 0%, 20%, and 40% missingness. `COMPS` and `CSE` are different branches and are not merged. No fabricated values may be written to live user documents.

### Dataset card D1

| Measure | Value |
|---|---:|
| Users | 448 |
| Interactions | 1,438 |
| Mentorships | 10 |
| Seekers evaluated | 448 |
| Ranking rows across top-10 runs | 3,994 |
| D1 provenance flag | unknown |
| Score range | 16–78 |
| Mean score range by seed | 47.76–48.27 |
| Top-10 tie rate range | 87.28%–87.72% |
| Cross-department top-10 range | 9.89%–11.22% |
| Explanation fields present | 100% |

V4 is an offline research track. Labels come from simulated latents; Python/xgboost would be a new dependency and requires owner approval.

## 17. V1 measurement log

| Measurement | Result |
|---|---|
| Seeds | 11, 23, 37, 41, 59 |
| Same-seed hash comparison | Identical (`true`) |
| Average Kendall tau across seed pairs | 0.7137184666 |
| Generated files | `research/data/d1_snapshot.json`; `research/out/v1-{11,23,37,41,59}.json` (gitignored) |
| Validation | `node --check` passed for all four new JavaScript files; pure smoke check passed |

### Evolution log entry — 2026-11-01 — V1 frozen baseline

- **What changed:** Added isolated frozen V1, seeded PRNG, read-only D1 exporter, five-seed runner, and V1 specification/defect/roadmap documentation.
- **Why:** Establish a reproducible research baseline without changing production ranking behavior.
- **Files touched:** New `recommender/` and `research/` files, `.gitignore`, and this documentation; no production source or database records changed.
- **Effect on rankings:** Production rankings unchanged; D1 V1 descriptive measurements are recorded above.
- **Evidence:** Baseline tag, historical extraction, syntax checks, D1 export, same-seed comparison, and five-seed runner completed.
