/**
 * MentorLink ML-Based Recommendation System
 * Fetches and renders intelligent mentor recommendations using:
 * - Clustering (K-Means++)
 * - Multi-factor compatibility scoring
 * - Skill matching (Jaccard similarity)
 * - Mentor quality analytics
 */

console.log('[MentorLink ML] recommendations.js loaded');

const RecommendationEngine = {
  async fetchMentorRecommendations(limit = 5) {
    try {
      const token = localStorage.getItem('mentorlink_token');
      if (!token) {
        console.warn('No authentication token found');
        return null;
      }

      const apiUrl = window.MENTORLINK_API_URL || (window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : 'http://localhost:5000');

      console.log('[MentorLink ML] Fetching recommendations', { apiUrl, limit });
      const response = await fetch(`${apiUrl}/api/recommendations/mentors?limit=${limit}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log('[MentorLink ML] Recommendation API response', {
        success: data?.success,
        count: Array.isArray(data?.recommendations) ? data.recommendations.length : 0,
      });

      return data.success ? data : null;
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      return null;
    }
  },

  getScoreExplanation(recommendation) {
    const resolvedScore = Number(
      recommendation?.score ?? recommendation?.compatibilityScore ?? recommendation?.matchScore ?? 0
    ) || 0;
    const components = recommendation?.compatibilityBreakdown?.components || recommendation?.scoreComponents;

    if (!components) {
      return `<strong>Score: ${resolvedScore}%</strong><br/>Click for more details`;
    }

    const c = components;
    return `
      <strong>Compatibility: ${resolvedScore}%</strong>
      <hr>
      <div class="ml-tooltip-body">
        <div class="ml-tooltip-metric"><span>Skill Match</span><span>${clampPercentage(c.skillAlignment)}%</span></div>
        <div class="ml-tooltip-metric"><span>Mentor Quality</span><span>${clampPercentage(c.mentorQuality)}%</span></div>
        <div class="ml-tooltip-metric"><span>Activity Level</span><span>${clampPercentage(c.activitySignal)}%</span></div>
        <div class="ml-tooltip-metric"><span>Profile</span><span>${clampPercentage(c.profileStrength)}%</span></div>
        <div class="ml-tooltip-metric"><span>Same Department</span><span>${clampPercentage(c.departmentMatch)}%</span></div>
        <div class="ml-tooltip-metric"><span>Schedule</span><span>${clampPercentage(c.availabilityMatch)}%</span></div>
      </div>
    `;
  },

  getScoreColor(score) {
    if (score >= 80) return '#6ee7b7';
    if (score >= 60) return '#fcd34d';
    return '#fca5a5';
  },

  getScoreBadgeBg(score) {
    if (score >= 80) return 'linear-gradient(135deg, rgba(110, 231, 183, 0.18), rgba(167, 139, 250, 0.09))';
    if (score >= 60) return 'linear-gradient(135deg, rgba(252, 211, 77, 0.2), rgba(167, 139, 250, 0.08))';
    return 'linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(167, 139, 250, 0.08))';
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampPercentage(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getRecommendationBreakdown(mentor) {
  return {
    ...(mentor?.breakdown || mentor?.scoreComponents || mentor?.compatibilityBreakdown?.components || {}),
  };
}

function getMentorRoleLine(mentor) {
  const role = mentor?.role || mentor?.user?.role || mentor?.mentor?.role || mentor?.profile?.role || '';
  const department = mentor?.department || mentor?.user?.department || mentor?.mentor?.department || mentor?.profile?.department || '';
  const year = mentor?.year || mentor?.user?.year || mentor?.mentor?.year || mentor?.profile?.year || '';

  const parts = [];
  if (role) parts.push(role.charAt(0).toUpperCase() + role.slice(1));
  if (department) parts.push(String(department).toUpperCase());
  if (year) parts.push(`Year ${year}`);
  return parts.join(' · ') || 'Recommended connection';
}

function buildMetricRow(icon, label, value) {
  return `
    <div class="ml-metric-row">
      <div class="ml-metric-label">
        <span class="ml-metric-icon" aria-hidden="true">${icon}</span>
        <span>${label}</span>
      </div>
      <span class="ml-metric-value">${clampPercentage(value)}%</span>
    </div>
  `;
}

function bindRecommendationCardInteractions(card) {
  if (!card) return;

  const showDetails = () => {
    card.classList.add('is-expanded');
    card.setAttribute('aria-expanded', 'true');
  };

  const hideDetails = () => {
    card.classList.remove('is-expanded');
    card.setAttribute('aria-expanded', 'false');
  };

  card.addEventListener('mouseenter', showDetails);
  card.addEventListener('mouseleave', hideDetails);
  card.addEventListener('focusin', showDetails);
  card.addEventListener('focusout', (event) => {
    if (!card.contains(event.relatedTarget)) {
      hideDetails();
    }
  });

  card.addEventListener('click', (event) => {
    if (!window.matchMedia('(hover: none)').matches) return;

    const interactiveTarget = event.target.closest('button, a, input, textarea, select');
    if (interactiveTarget && !interactiveTarget.classList.contains('ml-card-summary')) {
      return;
    }

    const nextExpanded = !card.classList.contains('is-expanded');
    card.classList.toggle('is-expanded', nextExpanded);
    card.setAttribute('aria-expanded', String(nextExpanded));
  });
}

function ensureRecommendationStyles() {
  if (document.getElementById('recommendations-styles')) return;

  const style = document.createElement('style');
  style.id = 'recommendations-styles';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes tooltipFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ml-tooltip hr {
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      margin: 8px 0;
    }
    .ml-suggestion-item {
      display: block;
      padding: 0;
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.76);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
      margin-bottom: 14px;
      overflow: visible;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }
    .ml-suggestion-item:hover,
    .ml-suggestion-item.is-expanded {
      transform: translateY(-1px);
      border-color: rgba(167, 139, 250, 0.34);
      box-shadow: 0 12px 26px rgba(0, 0, 0, 0.3);
      background: rgba(15, 23, 42, 0.9);
      z-index: 25;
    }
    .ml-card-summary {
      width: 100%;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 16px;
      color: inherit;
      cursor: pointer;
    }
    .ml-card-summary-avatar {
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      font-size: 0.86rem;
    }
    .ml-card-summary-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }
    .ml-card-summary-name {
      display: block;
      width: 100%;
      font-size: 0.94rem;
      font-weight: 700;
      line-height: 1.32;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      word-break: normal;
      overflow-wrap: normal;
    }
    .ml-card-summary-score {
      display: block;
      font-size: 0.82rem;
      line-height: 1.35;
      color: #d8c4ff;
      font-weight: 600;
      white-space: nowrap;
    }
    .ml-card-detail {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 8px);
      padding: 16px;
      border: 1px solid rgba(167, 139, 250, 0.22);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(8px) scale(0.98);
      transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
      z-index: 20;
    }
    .ml-suggestion-item.is-expanded .ml-card-detail {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    .ml-card-top {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
    }
    .ml-card-avatar {
      width: 52px;
      height: 52px;
      flex: 0 0 52px;
      font-size: 0.98rem;
    }
    .ml-card-info {
      min-width: 0;
    }
    .ml-card-name {
      font-size: 0.98rem;
      font-weight: 700;
      line-height: 1.25;
      color: var(--text-primary);
      white-space: normal;
      word-break: break-word;
    }
    .ml-card-role,
    .ml-status-text {
      font-size: 0.78rem;
      line-height: 1.35;
      color: var(--text-secondary);
    }
    .ml-card-role {
      margin-top: 3px;
    }
    .ml-status-text {
      margin-top: 4px;
    }
    .ml-follow-btn {
      align-self: start;
      min-width: 88px;
      justify-self: end;
      white-space: nowrap;
    }
    .ml-card-section {
      margin-top: 14px;
    }
    .ml-compat-section {
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
    .ml-section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 0.76rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--text-tertiary);
    }
    .ml-section-heading-secondary {
      margin-bottom: 10px;
    }
    .ml-progress-track {
      height: 9px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }
    .ml-progress-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--ml-progress-color), rgba(167, 139, 250, 0.92));
    }
    .ml-score-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .ml-score-badge {
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: var(--ml-score-bg);
      color: var(--ml-score-color);
      font-weight: 700;
      font-size: 0.88rem;
      padding: 6px 10px;
      border-radius: 999px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      cursor: help;
    }
    .ml-metrics-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .ml-metric-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 10px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(148, 163, 184, 0.08);
    }
    .ml-metric-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--text-secondary);
      font-size: 0.82rem;
      line-height: 1.3;
    }
    .ml-metric-icon {
      width: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 18px;
      font-size: 0.9rem;
    }
    .ml-metric-value {
      flex: 0 0 auto;
      color: var(--text-primary);
      font-size: 0.84rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .ml-tooltip {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: min(280px, 72vw);
      padding: 12px 13px;
      border-radius: 12px;
      border: 1px solid rgba(167, 139, 250, 0.28);
      background: rgba(2, 6, 23, 0.98);
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.42);
      color: var(--text-primary);
      font-size: 0.78rem;
      line-height: 1.45;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.16s ease, transform 0.16s ease;
      z-index: 30;
    }
    .ml-tooltip.is-visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
      animation: tooltipFadeIn 0.16s ease;
    }
    .ml-tooltip-body {
      display: grid;
      gap: 7px;
    }
    .ml-tooltip-metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    @media (max-width: 640px) {
      .ml-card-summary {
        grid-template-columns: auto minmax(0, 1fr);
        padding: 12px;
      }
      .ml-card-summary-score {
        grid-column: 2;
      }
      .ml-card-detail {
        position: relative;
        top: auto;
        left: auto;
        right: auto;
        margin: 0 10px 10px;
        width: auto;
      }
      .ml-card-top {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .ml-follow-btn {
        grid-column: 1 / -1;
        justify-self: stretch;
        width: 100%;
        margin-top: 2px;
      }
      .ml-section-heading {
        align-items: flex-start;
      }
      .ml-tooltip {
        right: auto;
        left: 0;
        width: min(280px, calc(100vw - 56px));
      }
    }
  `;
  document.head.appendChild(style);
}

async function initializeRecommendations() {
  if (window.__recommendationsInitialized) {
    return;
  }

  window.__recommendationsInitialized = true;
  console.log('[MentorLink ML] Initializing mentor recommendations');

  const container = document.getElementById('suggestions-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading" style="text-align:center;padding:20px;color:var(--text-secondary);font-size:0.85rem;">
      <div style="animation: spin 1s linear infinite; display:inline-block;">◈</div><br/>
      Loading AI recommendations...
    </div>
  `;

  const result = await RecommendationEngine.fetchMentorRecommendations(5);
  if (!result || !result.recommendations || result.recommendations.length === 0) {
    renderDefaultSuggestions(container);
    return;
  }

  renderMLRecommendations(container, result.recommendations);
}

function renderMLRecommendations(container, recommendations) {
  ensureRecommendationStyles();
  container.innerHTML = '';

  recommendations.forEach((mentor, index) => {
    const name =
      mentor?.name ||
      mentor?.user?.name ||
      mentor?.profile?.name ||
      mentor?.mentor?.name ||
      'Unknown';

    const score =
      mentor?.score ??
      mentor?.compatibilityScore ??
      mentor?.matchScore ??
      mentor?.mentor?.score ??
      0;

    const numericScore = Number(score) || 0;
    const scoreDisplay = numericScore ? `${numericScore}%` : '';
    const status =
      (mentor?.isOnline || mentor?.user?.isOnline || mentor?.mentor?.isOnline)
        ? 'Online'
        : (mentor?.lastActiveAt || mentor?.user?.lastActiveAt || mentor?.mentor?.lastActiveAt)
          ? 'Last seen recently'
          : (mentor?.status || mentor?.user?.status || mentor?.mentor?.status || 'N/A');

    const mentorId =
      mentor?._id ||
      mentor?.id ||
      mentor?.mentor?._id ||
      mentor?.mentor?.id ||
      mentor?.user?._id ||
      mentor?.user?.id ||
      '';

    const tooltipSource = {
      ...mentor,
      score: numericScore,
      compatibilityBreakdown: mentor?.compatibilityBreakdown || (mentor?.scoreComponents ? { components: mentor.scoreComponents } : undefined),
      scoreComponents: mentor?.scoreComponents || mentor?.compatibilityBreakdown?.components,
    };
    const breakdown = getRecommendationBreakdown(mentor);
    const roleLine = getMentorRoleLine(mentor);
    const compatibilityWidth = clampPercentage(numericScore);
    const scoreColor = RecommendationEngine.getScoreColor(numericScore);
    const scoreBg = RecommendationEngine.getScoreBadgeBg(numericScore);

    const mentorInitials = (name || 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item ml-suggestion-item';
    suggestionItem.style.position = 'relative';
    suggestionItem.setAttribute('aria-expanded', 'false');
    if (mentorId) {
      suggestionItem.setAttribute('data-user-id', String(mentorId));
    }

    suggestionItem.innerHTML = `
      <button type="button" class="ml-card-summary">
        <span class="avatar-sm ml-card-summary-avatar" style="background:var(--gradient-splash);">${mentorInitials}</span>
        <span class="ml-card-summary-main">
          <span class="ml-card-summary-name">${escapeHtml(name)}</span>
        </span>
        <span class="ml-card-summary-score">Match Score: ${scoreDisplay || '0%'}</span>
      </button>
      <div class="ml-card-detail">
        <div class="ml-card-top">
          <div class="avatar-sm ml-card-avatar" style="background:var(--gradient-splash);">${mentorInitials}</div>
          <div class="info ml-card-info">
            <div class="name ml-card-name">${escapeHtml(name)}</div>
            <div class="ml-card-role">${escapeHtml(roleLine)}</div>
            <div class="presence-label ml-status-text">${escapeHtml(status)}</div>
          </div>
          <button class="btn-follow ml-follow-btn" data-mentor-id="${mentorId}" type="button">Follow</button>
        </div>
        <div class="ml-card-section ml-compat-section">
          <div class="ml-section-heading">
            <span>Compatibility</span>
            <div class="ml-score-wrap">
              <button
                class="ml-score-badge"
                style="--ml-score-bg:${scoreBg};--ml-score-color:${scoreColor};"
                type="button"
              >${scoreDisplay || '0%'}</button>
              <div class="ml-tooltip"></div>
            </div>
          </div>
          <div class="ml-progress-track" aria-hidden="true">
            <div class="ml-progress-fill" style="width:${compatibilityWidth}%;--ml-progress-color:${scoreColor};"></div>
          </div>
        </div>
        <div class="ml-card-section">
          <div class="ml-section-heading ml-section-heading-secondary">Skills & metrics</div>
          <div class="ml-metrics-grid">
            ${buildMetricRow('🎯', 'Skill Match', breakdown.skillAlignment)}
            ${buildMetricRow('📊', 'Activity Level', breakdown.activitySignal)}
            ${buildMetricRow('👤', 'Profile', breakdown.profileStrength)}
            ${buildMetricRow('🏢', 'Same Department', breakdown.departmentMatch)}
            ${buildMetricRow('⏰', 'Schedule Match', breakdown.availabilityMatch)}
          </div>
        </div>
      </div>
    `;

    const badge = suggestionItem.querySelector('.ml-score-badge');
    const tooltipElement = suggestionItem.querySelector('.ml-tooltip');
    const scoreWrapElement = suggestionItem.querySelector('.ml-score-wrap');
    let tooltipHideTimeoutId = null;

    const showTooltip = () => {
      if (!tooltipElement) return;
      if (tooltipHideTimeoutId) {
        clearTimeout(tooltipHideTimeoutId);
        tooltipHideTimeoutId = null;
      }

      const hoverMentor = {
        ...tooltipSource,
        breakdown,
        scoreComponents: breakdown,
        compatibilityBreakdown: { components: breakdown },
      };

      tooltipElement.innerHTML = RecommendationEngine.getScoreExplanation(hoverMentor);
      container.querySelectorAll('.ml-tooltip.is-visible').forEach((el) => {
        if (el !== tooltipElement) {
          el.classList.remove('is-visible');
        }
      });
      tooltipElement.classList.add('is-visible');
    };

    const scheduleTooltipHide = () => {
      if (!tooltipElement) return;
      tooltipHideTimeoutId = setTimeout(() => {
        tooltipElement.classList.remove('is-visible');
      }, 90);
    };

    badge?.addEventListener('mouseenter', showTooltip);
    badge?.addEventListener('mouseleave', scheduleTooltipHide);
    scoreWrapElement?.addEventListener('mouseenter', showTooltip);
    scoreWrapElement?.addEventListener('mouseleave', scheduleTooltipHide);

    const followBtn = suggestionItem.querySelector('.ml-follow-btn');
    followBtn?.addEventListener('click', () => {
      handleFollowClick(mentorId, followBtn);
    });

    const avatarEl = suggestionItem.querySelector('.avatar-sm');
    const infoEl = suggestionItem.querySelector('.info');
    if (mentorId && typeof window.openUserProfilePage === 'function') {
      avatarEl?.addEventListener('click', () => window.openUserProfilePage(mentorId));
      infoEl?.addEventListener('click', () => window.openUserProfilePage(mentorId));
    }

    bindRecommendationCardInteractions(suggestionItem);
    container.appendChild(suggestionItem);
  });
}

function renderDefaultSuggestions(container) {
  ensureRecommendationStyles();
  container.innerHTML = `
    <div style="padding:16px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
        <strong>ML Recommendations Unavailable</strong><br/>
        Showing default suggestions instead. Try refreshing to load AI-powered recommendations.
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${generateDefaultMentorCards().map((mentor) => `
        <div class="suggestion-item ml-suggestion-item" aria-expanded="false">
          <button type="button" class="ml-card-summary">
            <span class="avatar-sm ml-card-summary-avatar" style="background:var(--gradient-splash);">${mentor.initials}</span>
            <span class="ml-card-summary-main">
              <span class="ml-card-summary-name">${escapeHtml(mentor.name)}</span>
            </span>
            <span class="ml-card-summary-score">Match Score: --</span>
          </button>
          <div class="ml-card-detail">
            <div class="ml-card-top">
              <div class="avatar-sm ml-card-avatar" style="background:var(--gradient-splash);">${mentor.initials}</div>
              <div class="info ml-card-info">
                <div class="name ml-card-name">${escapeHtml(mentor.name)}</div>
                <div class="ml-card-role">${escapeHtml(mentor.role)}</div>
                <div class="ml-status-text">Suggested connection</div>
              </div>
              <button class="btn-follow ml-follow-btn" type="button" onclick="handleFollowClick('${mentor.id}', this)">Follow</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.ml-suggestion-item').forEach((card) => {
    bindRecommendationCardInteractions(card);
  });
}

function generateDefaultMentorCards() {
  return [
    { id: '1', name: 'Alex Johnson', role: 'Senior · CS', initials: 'AJ' },
    { id: '2', name: 'Sarah Chen', role: 'Faculty · AI/ML', initials: 'SC' },
    { id: '3', name: 'Mike Patel', role: 'Senior · Web Dev', initials: 'MP' },
    { id: '4', name: 'Emma Wilson', role: 'Senior · DevOps', initials: 'EW' },
    { id: '5', name: 'David Kumar', role: 'Faculty · Data Science', initials: 'DK' },
  ];
}

function handleFollowClick(mentorId, button) {
  if (!button) return;

  if (button.classList.contains('joined')) {
    button.textContent = 'Follow';
    button.classList.remove('joined');
  } else {
    button.textContent = 'Following';
    button.classList.add('joined');
  }
}

window.MENTORLINK_API_URL = window.MENTORLINK_API_URL || 'http://localhost:5000';
window.RecommendationEngine = RecommendationEngine;
window.RecommendationEngine.initializeRecommendations = initializeRecommendations;
window.initializeMentorRecommendations = initializeRecommendations;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRecommendations);
} else {
  initializeRecommendations();
}
