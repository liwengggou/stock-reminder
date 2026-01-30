import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../config/email.js';
import rateLimit from '../middleware/rateLimit.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Rate limit auth endpoints (higher limit for testing)
router.use(rateLimit(100, 60000));

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password and create user with verification token
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, verification_token, email_verified) VALUES (?, ?, ?, FALSE)',
      [email, passwordHash, verificationToken]
    );

    // Send verification email (don't block signup if email fails)
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ 
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user (don't reveal if email exists for security)
    const [users] = await pool.execute(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    await pool.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, expires.toISOString(), users[0].id]
    );

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError.message);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find user with valid token
    const [users] = await pool.execute(
      'SELECT id, email, password_reset_expires FROM users WHERE password_reset_token = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = users[0];

    // Check if token expired
    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Update password and clear reset token
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify email with token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this verification token
    const [users] = await pool.execute(
      'SELECT id, email, email_verified FROM users WHERE verification_token = ?',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    // Mark email as verified
    await pool.execute(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = ?',
      [user.id]
    );

    res.json({ message: 'Email verified successfully. You can now use all features.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, email, email_verified FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    if (user.email_verified) {
      return res.json({ message: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await pool.execute(
      'UPDATE users SET verification_token = ? WHERE id = ?',
      [verificationToken, user.id]
    );

    await sendVerificationEmail(user.email, verificationToken);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
