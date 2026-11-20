const express = require('express')

require('dotenv').config()

const mongoose = require('mongoose')
const helmet = require('helmet')

const authRoutes = require('./Routes/userRoutes')
const videoRoutes = require('./Routes/videoRoutes')

const app = express()
const PORT = process.env.PORT

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in .env");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required in .env");
}

// Azure puts a proxy in front of the app; trust it so client IPs are read correctly.
app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

const cors = require('cors');
app.use(cors({origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'}))

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

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        app.listen(PORT, ()=>{
            console.log(`Server is running on port ${PORT}`)
})
    }
    catch (error) {
        console.error('Error connecting to DataBase:', error);
        process.exit(1); // Exit the process with an error code
    }

}

connectToDatabase();



