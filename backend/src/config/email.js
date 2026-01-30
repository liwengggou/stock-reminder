import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qcloudmail.com',
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendAlertEmail = async (to, alertData) => {
  const { symbol, stockName, alertType, targetPrice, currentPrice, triggeredAt } = alertData;
  
  const direction = alertType === 'above' ? 'risen above' : 'dropped below';
  const action = alertType === 'above' ? 'consider taking profits' : 'review your position';
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'alerts@stocktracker.com',
    to,
    subject: `🔔 Stock Alert: ${symbol} has ${direction} $${targetPrice}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Stock Price Alert Triggered</h2>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px;">${symbol} - ${stockName}</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Alert Type:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">${alertType.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Target Price:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;">$${targetPrice}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Current Price:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #ddd; color: ${alertType === 'above' ? '#22c55e' : '#ef4444'};">
                <strong>$${currentPrice}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Triggered At:</strong></td>
              <td style="padding: 8px 0;">${new Date(triggeredAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td>
            </tr>
          </table>
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
          <p style="margin: 0; color: #856404;">
            <strong>⚠️ Recommendation:</strong> The stock has ${direction} your target price. You may want to ${action}.
          </p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          This is an automated alert from Stock Tracker. Please do not reply to this email.
        </p>
      </div>
    `
  };

  let retries = 3;
  while (retries > 0) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Alert email sent to ${to} for ${symbol}`);
      return true;
    } catch (error) {
      retries--;
      console.error(`Email send failed (${3 - retries}/3):`, error.message);
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

const sendPasswordResetEmail = async (to, resetToken, frontendUrl = 'http://localhost:5173') => {
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'alerts@stocktracker.com',
    to,
    subject: '🔐 Reset Your Stock Tracker Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Password Reset Request</h2>
        <p>You requested to reset your password for Stock Tracker.</p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}"
             style="background: #4f46e5; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666;">Or copy this link: <br/>${resetLink}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This link expires in 1 hour. If you didn't request this, please ignore this email.
        </p>
      </div>
    `
  };

  let retries = 3;
  while (retries > 0) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${to}`);
      return true;
    } catch (error) {
      retries--;
      console.error(`Password reset email failed (${3 - retries}/3):`, error.message);
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

const sendVerificationEmail = async (to, verificationToken, frontendUrl = 'http://localhost:5173') => {
  const verifyLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'alerts@stocktracker.com',
    to,
    subject: '✅ Verify Your Stock Tracker Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Welcome to Stock Tracker!</h2>
        <p>Please verify your email address to start using your account.</p>
        <div style="margin: 30px 0;">
          <a href="${verifyLink}"
             style="background: #22c55e; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p style="color: #666;">Or copy this link: <br/>${verifyLink}</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you didn't create an account, please ignore this email.
        </p>
      </div>
    `
  };

  let retries = 3;
  while (retries > 0) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${to}`);
      return true;
    } catch (error) {
      retries--;
      console.error(`Verification email failed (${3 - retries}/3):`, error.message);
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

export { sendAlertEmail, sendPasswordResetEmail, sendVerificationEmail };
