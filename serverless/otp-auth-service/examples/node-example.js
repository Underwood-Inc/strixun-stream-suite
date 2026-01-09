/**
 * Node.js Example - OTP Authentication Integration
 * 
 * Example Express.js server using the OTP Auth Service
 */

const express = require('express');
const { OTPAuth } = require('@otpauth/sdk');

const app = express();
app.use(express.json());

const client = new OTPAuth({
  apiKey: process.env.OTP_API_KEY,
  baseUrl: process.env.OTP_BASE_URL || 'https://otp-auth-service.workers.dev'
});

// Request OTP endpoint
app.post('/api/auth/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const result = await client.requestOTP(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify OTP endpoint
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }
    
    const result = await client.verifyOTP(email, otp);
    
    // Set token in HTTP-only cookie
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 60 * 60 * 1000 // 7 hours
    });
    
    res.json({
      success: true,
      userId: result.userId,
      email: result.email
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Protected route example
app.get('/api/user/me', async (req, res) => {
  try {
    const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const customer = await client.getMe(token);
    res.json(user);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.cookies.auth_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      await client.logout(token);
    }
    
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

