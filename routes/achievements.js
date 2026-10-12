const express = require('express');
const Achievement = require('../models/Achievement');
const Certificate = require('../models/Certificate');
const { verifyToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { getContributionStats, ACHIEVEMENTS } = require('../utils/contributionService');

const router = express.Router();

router.get('/me', verifyToken, apiLimiter, async (req, res) => {
  try {
    const [stats, achievements, certificates] = await Promise.all([
      getContributionStats(req.user._id),
      Achievement.find({ mentorId: req.user._id }).sort({ level: -1 }).lean(),
      Certificate.find({ mentorId: req.user._id, revokedAt: null }).sort({ issuedAt: -1 }).lean(),
    ]);
    const next = ACHIEVEMENTS.find((item) => item.threshold > stats.points);
    res.json({ success: true, stats, achievements, certificates, nextAchievement: next || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load contribution achievements', error: error.message });
  }
});

router.get('/certificates/:certificateId/download', verifyToken, apiLimiter, async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId }).populate('mentorId', 'name');
    if (!certificate || certificate.revokedAt) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (String(certificate.mentorId._id) !== String(req.user._id) && String(req.user.role).toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const recipientName = certificate.mentorId.name.replace(/[<&>"']/g, '');
    const title = certificate.title.replace(/[<&>"']/g, '');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Georgia,serif;background:#f3f4f6;padding:48px}.certificate{max-width:850px;margin:auto;padding:70px;text-align:center;background:#fff;border:12px double #17324d;color:#17324d}h1{font-size:42px;margin:12px}h2{font-weight:normal;color:#b07a22}.meta{margin:32px auto;line-height:1.8;font-family:Arial,sans-serif}.id{font-size:12px;color:#64748b}</style></head><body><main class="certificate"><div>MENTORLINK</div><h1>Certificate of Achievement</h1><p>This certificate is proudly presented to</p><h2>${recipientName}</h2><p>for earning the achievement</p><h2>${title}</h2><div class="meta">${certificate.pointsAtIssuance} verified contribution points<br>${certificate.confirmedInteractions} confirmed mentoring sessions<br>${certificate.uniqueMentees} mentees helped</div><p>Issued on ${new Date(certificate.issuedAt).toLocaleDateString()}</p><p class="id">Certificate ID: ${certificate.certificateId}</p></main></body></html>`;
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificate.certificateId}.html"` }).send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download certificate', error: error.message });
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
