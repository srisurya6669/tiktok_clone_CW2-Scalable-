require('dotenv').config()

const mongoose = require('mongoose')

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in .env");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required in .env");
}

const app = require('./app')
const PORT = process.env.PORT

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
