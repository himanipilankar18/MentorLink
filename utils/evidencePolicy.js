// Which confirmed sessions count as mentoring evidence (rankings, contribution points, certificates).
// A confirmation only counts when the mentee is a verified current student with an institute email,
// so a mentor cannot create outside accounts to confirm their own sessions.

const INSTITUTE_DOMAINS = String(process.env.ALLOWED_DOMAINS || 'spit.ac.in')
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

function canVouchForMentoring(user) {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase();
  return String(user.userType || '').toUpperCase() === 'INSTITUTE_MEMBER'
    && user.instituteRole === 'CURRENT_STUDENT'
    && user.isVerified === true
    && INSTITUTE_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

// Older records have no flag and keep counting; records confirmed by other accounts are flagged false.
const COUNTED_EVIDENCE = { confirmationStatus: 'confirmed', evidenceEligible: { $ne: false } };

const NOT_COUNTED_NOTE = 'It is saved in your history, but only sessions confirmed by verified institute students count toward mentor rankings and certificates.';

module.exports = { canVouchForMentoring, COUNTED_EVIDENCE, NOT_COUNTED_NOTE };
