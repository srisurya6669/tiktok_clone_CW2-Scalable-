const express = require('express')

require('dotenv').config()

const mongoose = require('mongoose')

const authRoutes = require('./Routes/userRoutes')

const app = express()
const PORT = process.env.PORT || 3000

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in .env");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required in .env");
}

// Middleware to parse JSON requests
app.use(express.json({ limit: '10kb' }))

// Home Route
app.get('/', (req, res) => {
  res.send('Welcome to the Home Page!')
})

app.use('/api/auth', authRoutes)

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



