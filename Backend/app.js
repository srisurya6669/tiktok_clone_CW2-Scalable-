// The Express app on its own, so tests can use it without a database connection or open port.
const express = require('express')
const mongoose = require('mongoose')
const helmet = require('helmet')
const cors = require('cors')

const authRoutes = require('./Routes/userRoutes')
const videoRoutes = require('./Routes/videoRoutes')

const app = express()

// Azure puts a proxy in front of the app; trust it so client IPs are read correctly.
app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))

// Middleware to parse JSON requests
app.use(express.json({ limit: '10kb' }))

// Health check used by Azure and Docker to see whether the app is up.
app.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1
  res.status(dbReady ? 200 : 503).json({ status: dbReady ? 'ok' : 'database unavailable' })
})

// Home Route
app.get('/', (req, res) => {
  res.send('Welcome to the Home Page!')
})

app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

module.exports = app
