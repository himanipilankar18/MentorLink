require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('\n📧 Testing Email Configuration...\n');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n❌ SMTP NOT CONFIGURED!');
    console.log('Emails will be logged to console instead of being sent.\n');
    console.log('To fix:');
    console.log('1. Go to https://myaccount.google.com/apppasswords');
    console.log('2. Generate an App Password for "MentorLink"');
    console.log('3. Update SMTP_PASS in .env file\n');
    return;
  }

  if (process.env.SMTP_PASS === 'YOUR_APP_PASSWORD_HERE') {
    console.log('\n❌ SMTP_PASS is placeholder value!');
    console.log('Replace YOUR_APP_PASSWORD_HERE with your actual Gmail App Password\n');
    return;
  }

  console.log('\n✅ SMTP Configuration looks good!');
  console.log('\nTesting email send...\n');

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"MentorLink" <no-reply@mentorlink.local>',
      to: process.env.SMTP_USER, // Send test email to yourself
      subject: 'MentorLink Test Email',
      html: '<h2>✅ Success!</h2><p>Your MentorLink email configuration is working correctly.</p>',
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\nCheck your inbox:', process.env.SMTP_USER, '\n');
  } catch (error) {
    console.error('\n❌ Email send failed:');
    console.error('Error:', error.message);
    console.error('\nCommon issues:');
    console.error('- App Password incorrect');
    console.error('- 2-Step Verification not enabled on Gmail');
    console.error('- Less secure app access blocked\n');
  }
}

testEmail().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
