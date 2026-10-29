const express = require('express');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { getContributionStats, ACHIEVEMENTS } = require('../utils/contributionService');

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function certificateMarkup(certificate) {
  const recipientName = escapeHtml(certificate.mentorId?.name || 'Mentor');
  const title = escapeHtml(certificate.title);
  const certificateId = escapeHtml(certificate.certificateId);
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString();
  const verificationUrl = `/api/achievements/certificates/verify/${encodeURIComponent(certificate.certificateId)}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | MentorLink Certificate</title><style>
  :root{--ink:#172a3a;--gold:#b77a32;--paper:#fffdf8;--muted:#647484}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#eef1f4;color:var(--ink);font-family:Arial,sans-serif;display:grid;place-items:center;padding:28px}.certificate{position:relative;width:min(100%,1050px);min-height:700px;padding:72px 80px;background:var(--paper);border:2px solid var(--gold);box-shadow:0 18px 60px rgba(23,42,58,.18);text-align:center}.certificate:before,.certificate:after{content:"";position:absolute;inset:14px;border:1px solid rgba(183,122,50,.55);pointer-events:none}.certificate:after{inset:24px;border-color:rgba(23,42,58,.18)}.content{position:relative;z-index:1}.brand{font-weight:700;letter-spacing:.28em;color:var(--gold);font-size:13px}.kicker{margin-top:54px;color:var(--muted);text-transform:uppercase;letter-spacing:.22em;font-size:12px}.title{font-family:Georgia,serif;font-size:clamp(34px,6vw,66px);font-weight:400;margin:18px 0;color:var(--ink)}.presented{color:var(--muted);font-family:Georgia,serif;font-size:20px}.recipient{font-family:Georgia,serif;font-size:42px;font-weight:400;color:var(--gold);margin:24px 0 10px}.achievement{font-family:Georgia,serif;font-size:25px;margin:0}.evidence{display:flex;justify-content:center;gap:32px;margin:44px auto 30px;padding:18px 0;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);max-width:720px}.evidence strong{display:block;font:700 22px Georgia,serif}.evidence span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:5px}.footer{display:flex;justify-content:space-between;gap:20px;margin-top:52px;color:var(--muted);font-size:11px;text-align:left}.verify{color:var(--muted);font-size:11px;margin-top:28px}.verify a{color:var(--ink)}@media print{body{padding:0;background:white}.certificate{box-shadow:none;width:100%;min-height:100vh}}@media(max-width:650px){body{padding:10px}.certificate{padding:55px 28px;min-height:620px}.evidence{gap:14px;flex-wrap:wrap}.recipient{font-size:32px}.footer{display:block;line-height:1.8}}
  </style></head><body><main class="certificate"><div class="content"><div class="brand">MENTORLINK</div><div class="kicker">Certificate of mentoring achievement</div><h1 class="title">Certificate of Recognition</h1><p class="presented">This certificate is proudly presented to</p><div class="recipient">${recipientName}</div><p class="achievement">for earning the <strong>${title}</strong> distinction</p><div class="evidence"><div><strong>${certificate.pointsAtIssuance}</strong><span>verified points</span></div><div><strong>${certificate.confirmedInteractions}</strong><span>confirmed sessions</span></div><div><strong>${certificate.uniqueMentees}</strong><span>mentees helped</span></div><div><strong>${certificate.averageRating ? `${Number(certificate.averageRating).toFixed(1)}/5` : '--'}</strong><span>average rating</span></div></div><div class="footer"><span>Issued ${issuedDate}</span><span>Certificate ID: ${certificateId}</span></div><div class="verify">Verify this certificate at <a href="${verificationUrl}">${verificationUrl}</a></div></div></main></body></html>`;
}

router.get('/me', verifyToken, apiLimiter, async (req, res) => {
  try {
    if (String(req.user.userType || '').toUpperCase() === 'EXTERNAL') {
      return res.status(403).json({ success: false, message: 'Achievements are available to Institute Members only' });
    }
    const [stats, achievements, certificates] = await Promise.all([
      getContributionStats(req.user._id),
      Achievement.find({ mentorId: req.user._id }).sort({ level: -1 }).lean(),
      Certificate.find({ mentorId: req.user._id, revokedAt: null }).populate('achievementId', 'level').sort({ issuedAt: -1 }).lean(),
    ]);
    const next = ACHIEVEMENTS.find((item) => item.threshold > stats.points);
    res.json({ success: true, stats, achievements, certificates, nextAchievement: next || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load contribution achievements', error: error.message });
  }
});

router.get('/certificates/:certificateId/download', verifyToken, apiLimiter, async (req, res) => {
  try {
    if (String(req.user.userType || '').toUpperCase() === 'EXTERNAL') {
      return res.status(403).json({ success: false, message: 'Certificates are available to Institute Members only' });
    }
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId }).populate('mentorId', 'name');
    if (!certificate || certificate.revokedAt) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (String(certificate.mentorId._id) !== String(req.user._id) && String(req.user.role).toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificate.certificateId}.html"` }).send(certificateMarkup(certificate));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download certificate', error: error.message });
  }
});

router.get('/certificates/:certificateId/view', apiLimiter, async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId }).populate('mentorId', 'name');
    if (!certificate || certificate.revokedAt) return res.status(404).json({ success: false, message: 'Certificate not found' });
    res.type('html').send(certificateMarkup(certificate));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to view certificate', error: error.message });
  }
});

router.get('/certificates/verify/:certificateId', apiLimiter, async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId }).populate('mentorId', 'name');
    if (!certificate) return res.status(404).json({ success: false, valid: false, message: 'Certificate not found' });
    res.json({ success: true, valid: !certificate.revokedAt, certificate: { certificateId: certificate.certificateId, recipientName: certificate.mentorId.name, title: certificate.title, issuedAt: certificate.issuedAt, revokedAt: certificate.revokedAt } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify certificate', error: error.message });
  }
});

module.exports = router;
