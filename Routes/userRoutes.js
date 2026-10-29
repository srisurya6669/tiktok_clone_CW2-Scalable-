const express = require('express');
const { register, login, me } = require('../Controllers/userController');
const authenticateToken = require('../Middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, me);

module.exports = router;
