const jwt = require("jsonwebtoken");
const User = require("../Models/userModel")

const signToken = (userId) => {
    return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
}

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const user = await User.create({ name, email, password });
        res.status(201).json({ token: signToken(user._id) });
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "email already exists" });
        }
        res.status(400).json({ message: error.message });
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select("+password");

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        res.json({ token: signToken(user._id) });
    } catch (error) {
        res.status(500).json({ message: "server error" });
    }
}

exports.me = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: "server error" });
    }
}
