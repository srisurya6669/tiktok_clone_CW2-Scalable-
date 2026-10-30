const express = require('express')

require('dotenv').config()

const mongoose = require('mongoose')

const path = require('path')

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

const cors = require('cors');
app.use(cors({origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'}))

// Middleware to parse JSON requests
app.use(express.json({ limit: '10kb' }))

// Home Route
app.get('/', (req, res) => {
  res.send('Welcome to the Home Page!')
})

app.use('/api/auth', authRoutes)
app.use('/api/videos', videoRoutes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

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



