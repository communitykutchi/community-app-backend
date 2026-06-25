"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const User_1 = __importDefault(require("../models/User"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const register = async (req, res) => {
    try {
        const { fullName, fatherName, motherName, familyMembers, cast, dob, cnic, mobile, email, homeStatus, occupation, businessName, password, } = req.body;
        if (!fullName || !mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "Full Name, Mobile & Password are required",
            });
        }
        const exists = await User_1.default.findOne({ mobile });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Mobile number already registered",
            });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = new User_1.default({
            fullName,
            fatherName,
            motherName,
            familyMembers,
            cast,
            dob,
            cnic,
            mobile,
            email,
            homeStatus,
            occupation,
            businessName,
            password: hashedPassword,
        });
        await newUser.save();
        return res.json({
            success: true,
            message: "User registered successfully",
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { mobile, password } = req.body;
        if (!mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "Mobile & Password are required",
            });
        }
        const user = await User_1.default.findOne({ mobile });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile or password.",
            });
        }
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile or password.",
            });
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || "secret", {
            expiresIn: "7d",
        });
        return res.json({
            success: true,
            token,
            user,
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
exports.login = login;
