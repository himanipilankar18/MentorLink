const nodemailer = require('nodemailer');

/**
 * Send an email using environment-based SMTP config.
 * Falls back to console.log of the link in dev if SMTP is not configured.
 */
async function sendEmail({ to, subject, html }) {
  // If SMTP is not configured, just log for local testing
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n[sendEmail] SMTP not configured. Email would be:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML:\n', html);
    console.log('[sendEmail] Configure SMTP_* env vars to actually send emails.\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"MentorLink" <no-reply@mentorlink.local>`,
    to,
    subject,
    html,
  });
}

module.exports = sendEmail;

