require('dotenv').config();
const sendEmail = require('../utils/sendEmail');

console.log('Testing email to SPIT address...\n');

const testEmail = async () => {
  try {
    await sendEmail({
      to: 'tithi.talele24@spit.ac.in',
      subject: 'Test Email from MentorLink',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email to verify that emails are reaching your SPIT email address.</p>
        <p>If you receive this, the email system is working correctly!</p>
      `
    });
    console.log('✅ Email sent successfully to tithi.talele24@spit.ac.in');
    console.log('Please check your inbox (and spam folder)');
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error(error);
  }
  process.exit(0);
};

testEmail();
