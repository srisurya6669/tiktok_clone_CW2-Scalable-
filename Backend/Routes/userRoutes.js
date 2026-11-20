const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, me } = require('../Controllers/userController');
const authenticateToken = require('../Middleware/authMiddleware');
const router = express.Router();

// Slow down password guessing and mass sign-ups from one address.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authenticateToken, me);

module.exports = router;
