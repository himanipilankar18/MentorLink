require('dotenv').config();
const sendEmail = require('../utils/sendEmail');

console.log('🔍 Simulating registration OTP email...\n');

// Simulate what happens during registration
const testRegistrationEmail = async () => {
  try {
    const user = {
      name: 'Tithi Talele',
      email: 'tithi.talele24@spit.ac.in'
    };
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Generated OTP: ${otp}\n`);
    
    const html = `
      <h2>Verify your PingMe account</h2>
      <p>Hello ${user.name || ''},</p>
      <p>Thank you for registering on PingMe. Please verify that this is your official SPIT email by entering the OTP below:</p>
      <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
      <p><strong>This OTP will expire in 15 minutes.</strong></p>
      <p>If you did not request this, please ignore this email.</p>
    `;

    console.log('Sending OTP email...');
    await sendEmail({ 
      to: user.email, 
      subject: 'Verify your PingMe email', 
      html 
    });
    
    console.log('✅ OTP email sent successfully!');
    console.log(`Check inbox: ${user.email}`);
    console.log(`OTP code: ${otp}`);
  } catch (error) {
    console.error('❌ Error sending OTP email:');
    console.error(error);
  }
  process.exit(0);
};

testRegistrationEmail();
