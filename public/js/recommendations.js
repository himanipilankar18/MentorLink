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
  /**
   * Fetch recommended mentors from backend ML engine
   * @param {number} limit - Number of recommendations to fetch (default: 5)
   * @returns {Promise<Object>} Response with recommendations array and clustering metadata
   */
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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log('Recommendations API Response:', data);
      console.log('[MentorLink ML] Recommendation API response', {
        success: data?.success,
        count: Array.isArray(data?.recommendations) ? data.recommendations.length : 0
      });
      return data.success ? data : null;
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      return null;
    }
  },

  /**
   * Get score explanation breakdown
   * @param {Object} recommendation - Recommendation object with components
   * @returns {string} HTML tooltip content
   */
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
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.16);margin:8px 0 9px;">
      <div class="ml-tooltip-body">
        <div class="ml-tooltip-metric"><span>🎯 Skill Match</span><span>${c.skillAlignment || 0}%</span></div>
        <div class="ml-tooltip-metric"><span>⭐ Mentor Quality</span><span>${c.mentorQuality || 0}%</span></div>
        <div class="ml-tooltip-metric"><span>📊 Activity Level</span><span>${c.activitySignal || 0}%</span></div>
        <div class="ml-tooltip-metric"><span>👤 Profile</span><span>${c.profileStrength || 0}%</span></div>
        ${c.departmentMatch ? `<div class="ml-tooltip-metric"><span>🏢 Same Dept</span><span>${c.departmentMatch}%</span></div>` : ''}
        ${c.availabilityMatch ? `<div class="ml-tooltip-metric"><span>⏰ Schedule</span><span>${c.availabilityMatch}%</span></div>` : ''}
      </div>
    `;
  },

  /**
   * Get score color based on value
   * @param {number} score - Score 0-100
   * @returns {string} CSS color
   */
  getScoreColor(score) {
    if (score >= 80) return '#6ee7b7'; // Soft green
    if (score >= 60) return '#fcd34d'; // Soft amber
    return '#fca5a5'; // Soft red
  },

  /**
   * Get score badge background
   * @param {number} score - Score 0-100
   * @returns {string} CSS background
   */
  getScoreBadgeBg(score) {
    if (score >= 80) return 'linear-gradient(135deg, rgba(110, 231, 183, 0.18), rgba(167, 139, 250, 0.09))';
    if (score >= 60) return 'linear-gradient(135deg, rgba(252, 211, 77, 0.2), rgba(167, 139, 250, 0.08))';
    return 'linear-gradient(135deg, rgba(252, 165, 165, 0.2), rgba(167, 139, 250, 0.08))';
  }
};

/**
 * Initialize recommendations in the sidebar
 * Fetches and renders mentor recommendations with hover tooltips
 */
async function initializeRecommendations() {
  if (window.__recommendationsInitialized) {
    return;
  }

  window.__recommendationsInitialized = true;
  console.log('[MentorLink ML] Initializing mentor recommendations');

  const container = document.getElementById('suggestions-container');
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div class="loading" style="text-align:center;padding:20px;color:var(--text-secondary);font-size:0.85rem;">
      <div style="animation: spin 1s linear infinite; display:inline-block;">◈</div><br/>
      Loading AI recommendations...
    </div>
  `;

  // Fetch recommendations
  const result = await RecommendationEngine.fetchMentorRecommendations(5);

  if (!result || !result.recommendations || result.recommendations.length === 0) {
    // Fallback to default suggestions if API fails
    renderDefaultSuggestions(container);
    return;
  }

  // Render ML recommendations
  renderMLRecommendations(container, result.recommendations);
}

/**
 * Render ML-powered recommendations
 */
function renderMLRecommendations(container, recommendations) {
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

    const scoreColor = RecommendationEngine.getScoreColor(numericScore);
    const scoreBg = RecommendationEngine.getScoreBadgeBg(numericScore);
    const tooltipData = {
      name,
      score: numericScore,
      source: tooltipSource,
    };

    const mentorInitials = (name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item ml-suggestion-item';
    suggestionItem.style.position = 'relative';
    if (mentorId) {
      suggestionItem.setAttribute('data-user-id', String(mentorId));
    }
    suggestionItem.innerHTML = `
      <div class="avatar-sm" style="background:var(--gradient-splash);">
        ${mentorInitials}
      </div>
      <div class="info">
        <div class="name">${name}</div>
        <div class="presence-label ml-status-text">
          ${status}
        </div>
      </div>
      <div class="ml-score-wrap">
        <div 
          class="ml-score-badge" 
          style="--ml-score-bg:${scoreBg};--ml-score-color:${scoreColor};"
          data-tooltip="${mentorInitials}-${index}"
        >
          ${scoreDisplay}
        </div>
        <div 
          id="tooltip-${mentorInitials}-${index}"
          class="ml-tooltip"
        >
          
        </div>
      </div>
      <button 
        class="btn-follow"
        data-mentor-id="${mentorId}"
        style="cursor:pointer;"
      >
        Follow
      </button>
    `;

    // Add hover tooltip behavior
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

      // Build a fresh isolated snapshot on every hover to prevent stale/mixed fields.
      const breakdown = {
        ...(mentor?.breakdown || mentor?.scoreComponents || mentor?.compatibilityBreakdown?.components || {}),
      };
      const hoverMentor = {
        ...tooltipData.source,
        breakdown,
        scoreComponents: breakdown,
        compatibilityBreakdown: { components: breakdown },
      };

      // Full rerender for this hovered mentor only.
      tooltipElement.innerHTML = RecommendationEngine.getScoreExplanation(hoverMentor);
      console.log('Tooltip Data:', tooltipData.name, breakdown);

      // Ensure only one tooltip remains visible to avoid data crossover perception.
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

    badge?.addEventListener('mouseenter', () => {
      showTooltip();
    });

    badge?.addEventListener('mouseleave', () => {
      scheduleTooltipHide();
    });

    scoreWrapElement?.addEventListener('mouseenter', showTooltip);
    scoreWrapElement?.addEventListener('mouseleave', scheduleTooltipHide);

    // Add follow button handler
    const followBtn = suggestionItem.querySelector('.btn-follow');
    followBtn?.addEventListener('click', () => {
      handleFollowClick(mentorId, followBtn);
    });

    // Keep existing UX: clicking avatar/name opens that user's profile
    const avatarEl = suggestionItem.querySelector('.avatar-sm');
    const infoEl = suggestionItem.querySelector('.info');
    if (mentorId && typeof window.openUserProfilePage === 'function') {
      avatarEl?.addEventListener('click', () => window.openUserProfilePage(mentorId));
      infoEl?.addEventListener('click', () => window.openUserProfilePage(mentorId));
    }

    container.appendChild(suggestionItem);
  });

  // Add animation keyframes if not already present
  if (!document.getElementById('recommendations-styles')) {
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
    `;
    document.head.appendChild(style);
  }
}

/**
 * Render default/fallback suggestions if API fails
 */
function renderDefaultSuggestions(container) {
  container.innerHTML = `
    <div style="padding:16px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;margin-bottom:16px;">
      <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.5;">
        <strong>⚡ ML Recommendations Unavailable</strong><br/>
        Showing default suggestions instead. Try refreshing to load AI-powered recommendations.
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${generateDefaultMentorCards().map(mentor => `
        <div class="suggestion-item">
          <div class="avatar-sm" style="background:var(--gradient-splash);">
            ${mentor.initials}
          </div>
          <div class="info">
            <div class="name">${mentor.name}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">${mentor.role}</div>
          </div>
          <button class="btn-follow" onclick="handleFollowClick('${mentor.id}', this)">
            Follow
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Generate default mentor suggestions
 */
function generateDefaultMentorCards() {
  return [
    { id: '1', name: 'Alex Johnson', role: 'Senior • CS', initials: 'AJ' },
    { id: '2', name: 'Sarah Chen', role: 'Faculty • AI/ML', initials: 'SC' },
    { id: '3', name: 'Mike Patel', role: 'Senior • Web Dev', initials: 'MP' },
    { id: '4', name: 'Emma Wilson', role: 'Senior • DevOps', initials: 'EW' },
    { id: '5', name: 'David Kumar', role: 'Faculty • Data Science', initials: 'DK' }
  ];
}

/**
 * Handle follow button click
 */
function handleFollowClick(mentorId, button) {
  if (!button) return;

  if (button.classList.contains('joined')) {
    button.textContent = 'Follow';
    button.classList.remove('joined');
  } else {
    button.textContent = 'Following';
    button.classList.add('joined');
  }

  // Optionally send API request to create/update mentorship request
  // For now, just update UI
}

window.MENTORLINK_API_URL = window.MENTORLINK_API_URL || 'http://localhost:5000';
window.RecommendationEngine = RecommendationEngine;
window.RecommendationEngine.initializeRecommendations = initializeRecommendations;
window.initializeMentorRecommendations = initializeRecommendations;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRecommendations);
} else {
  initializeRecommendations();
}
