"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommunityGroup = exports.listCommunityGroups = exports.removeUser = exports.updateUserRole = exports.listUsers = exports.getMe = exports.login = exports.register = exports.resetPassword = exports.verifyOtp = exports.sendOtp = exports.ensureDefaultAdmin = void 0;
const User_1 = __importDefault(require("../models/User"));
const CommunityGroup_1 = __importDefault(require("../models/CommunityGroup"));
const Otp_1 = __importDefault(require("../models/Otp"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const sanitizeUser = (user) => {
    const userObject = user.toObject ? user.toObject() : user;
    delete userObject.password;
    return userObject;
};
const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));
const getEmailTransport = () => {
    const emailUser = process.env.EMAIL_USER;
    const rawEmailPass = process.env.EMAIL_PASS;
    const emailService = String(process.env.EMAIL_SERVICE || "").toLowerCase();
    const host = process.env.EMAIL_HOST;
    const emailPass = rawEmailPass?.trim();
    if (!emailUser || !emailPass) {
        return null;
    }
    const normalizedEmailPass = emailService === "gmail" ? emailPass.replace(/\s+/g, "") : emailPass;
    if (emailService === "gmail" || (!host && emailUser.toLowerCase().endsWith("@gmail.com"))) {
        return nodemailer_1.default.createTransport({
            service: "gmail",
            auth: { user: emailUser, pass: normalizedEmailPass },
        });
    }
    if (!host) {
        return null;
    }
    return nodemailer_1.default.createTransport({
        host,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: (process.env.EMAIL_SECURE || "false") === "true",
        auth: { user: emailUser, pass: emailPass },
    });
};
const sendOtpEmail = async (email, code, purpose) => {
    const transport = getEmailTransport();
    if (!transport) {
        throw new Error("Email transport is not configured. Set Gmail SMTP values in .env using EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS, and EMAIL_FROM. For Gmail, use an App Password, not your normal password.");
    }
    const subject = purpose === "register" ? "Verify your email address" : "Reset your password";
    const text = `Your verification code is ${code}. It expires in 10 minutes.`;
    await transport.sendMail({
        from: process.env.EMAIL_FROM || "no-reply@communityhub.com",
        to: email,
        subject,
        text,
    });
    return { delivered: true };
};
const ensureDefaultAdmin = async () => {
    const existingAdmin = await User_1.default.findOne({
        $or: [{ email: "admin@communityhub.com" }, { mobile: "03000000000" }, { role: "super_admin" }, { role: "admin" }],
    });
    if (existingAdmin) {
        existingAdmin.email = "admin@communityhub.com";
        existingAdmin.mobile = "03000000000";
        existingAdmin.role = "super_admin";
        existingAdmin.password = await bcryptjs_1.default.hash("Admin@123", 10);
        existingAdmin.fullName = existingAdmin.fullName || "Community Admin";
        existingAdmin.homeStatus = existingAdmin.homeStatus || "Owner";
        existingAdmin.occupation = existingAdmin.occupation || "Employee";
        existingAdmin.jamaat = undefined;
        await existingAdmin.save();
        return existingAdmin;
    }
    const adminMobile = "03000000000";
    const adminEmail = "admin@communityhub.com";
    const adminPassword = "Admin@123";
    const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 10);
    const adminUser = await User_1.default.create({
        fullName: "Community Admin",
        mobile: adminMobile,
        email: adminEmail,
        password: hashedPassword,
        role: "super_admin",
        homeStatus: "Owner",
        occupation: "Employee",
    });
    return adminUser;
};
exports.ensureDefaultAdmin = ensureDefaultAdmin;
const sendOtp = async (req, res) => {
    try {
        const { email, purpose } = req.body;
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !["register", "reset_password"].includes(purpose)) {
            return res.status(400).json({ success: false, message: "Valid email and purpose are required" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address" });
        }
        if (purpose === "register") {
            const existingUser = await User_1.default.findOne({ email: normalizedEmail });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "This email is already registered" });
            }
        }
        else {
            const existingUser = await User_1.default.findOne({ email: normalizedEmail });
            if (!existingUser) {
                return res.status(404).json({ success: false, message: "No account found for this email" });
            }
        }
        await Otp_1.default.deleteMany({ email: normalizedEmail, purpose });
        const code = generateOtpCode();
        await Otp_1.default.create({
            email: normalizedEmail,
            code,
            purpose,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
        await sendOtpEmail(normalizedEmail, code, purpose);
        return res.json({
            success: true,
            message: "OTP sent to your email address",
        });
    }
    catch (err) {
        const isAuthError = typeof err === "object" && err !== null && "code" in err && err.code === "EAUTH";
        if (isAuthError) {
            return res.status(400).json({
                success: false,
                message: "Gmail authentication failed. Please set EMAIL_PASS to a valid Google App Password and restart backend.",
            });
        }
        if (err instanceof Error && err.message.includes("Email transport is not configured")) {
            return res.status(400).json({
                success: false,
                message: "Email service is not configured. Set EMAIL_USER, EMAIL_PASS, and EMAIL_FROM in backend .env, then restart backend.",
            });
        }
        const errorMessage = err instanceof Error ? err.message : "Unable to send OTP";
        return res.status(500).json({ success: false, message: errorMessage });
    }
};
exports.sendOtp = sendOtp;
const verifyOtp = async (req, res) => {
    try {
        const { email, code, purpose } = req.body;
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !code || !["register", "reset_password"].includes(purpose)) {
            return res.status(400).json({ success: false, message: "Email, OTP, and purpose are required" });
        }
        const otpRecord = await Otp_1.default.findOne({
            email: normalizedEmail,
            purpose,
            used: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!otpRecord || otpRecord.code !== String(code)) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        otpRecord.used = true;
        await otpRecord.save();
        return res.json({ success: true, message: "Email verified successfully" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Unable to verify OTP" });
    }
};
exports.verifyOtp = verifyOtp;
const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "Email, OTP, and new password are required" });
        }
        const user = await User_1.default.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ success: false, message: "No account found for this email" });
        }
        const otpRecord = await Otp_1.default.findOne({
            email: normalizedEmail,
            purpose: "reset_password",
            used: false,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!otpRecord || otpRecord.code !== String(otp)) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }
        user.password = await bcryptjs_1.default.hash(newPassword, 10);
        await user.save();
        otpRecord.used = true;
        await otpRecord.save();
        return res.json({ success: true, message: "Password changed successfully" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Unable to reset password" });
    }
};
exports.resetPassword = resetPassword;
const register = async (req, res) => {
    try {
        const { fullName, fatherName, motherName, familyMembers, cast, dob, cnic, mobile, email, homeStatus, occupation, businessName, password, jamaat, } = req.body;
        if (!fullName || !mobile || !password || !email) {
            return res.status(400).json({
                success: false,
                message: "Full Name, Mobile, Email & Password are required",
            });
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const verifiedOtp = await Otp_1.default.findOne({
            email: normalizedEmail,
            purpose: "register",
            used: true,
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });
        if (!verifiedOtp) {
            return res.status(400).json({ success: false, message: "Please verify your email first" });
        }
        const exists = await User_1.default.findOne({ mobile });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Mobile number already registered",
            });
        }
        const existingEmailUser = await User_1.default.findOne({ email: normalizedEmail });
        if (existingEmailUser) {
            return res.status(400).json({ success: false, message: "Email already registered" });
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
            email: normalizedEmail,
            homeStatus,
            occupation,
            businessName,
            password: hashedPassword,
            jamaat,
            role: "member",
        });
        await newUser.save();
        return res.json({
            success: true,
            message: "User registered successfully",
            user: sanitizeUser(newUser),
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
const defaultAdminMobile = (value) => value === "03000000000" || value === "0300-0000000";
const defaultAdminEmail = (value) => value === "admin@communityhub.com";
const isDefaultAdminUser = (user) => {
    const email = String(user?.email || "").toLowerCase();
    const mobile = String(user?.mobile || "");
    return email === "admin@communityhub.com" || mobile === "03000000000" || mobile === "0300-0000000";
};
const login = async (req, res) => {
    try {
        const { mobile, email, identifier, password } = req.body;
        const loginValue = identifier ?? mobile ?? email;
        if (!loginValue || !password) {
            return res.status(400).json({
                success: false,
                message: "Mobile or Email and Password are required",
            });
        }
        const normalizedLoginValue = String(loginValue).trim().toLowerCase();
        const isDefaultAdminAttempt = defaultAdminMobile(normalizedLoginValue) || defaultAdminEmail(normalizedLoginValue);
        let user = await User_1.default.findOne({
            $or: [{ mobile: loginValue }, { email: loginValue }],
        });
        if (user && (isDefaultAdminAttempt || user.role === "admin" || user.role === "super_admin")) {
            await (0, exports.ensureDefaultAdmin)();
            user = await User_1.default.findOne({
                $or: [{ mobile: loginValue }, { email: loginValue }],
            });
        }
        if (!user && isDefaultAdminAttempt) {
            const defaultAdmin = await (0, exports.ensureDefaultAdmin)();
            user = defaultAdmin;
        }
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid mobile/email or password.",
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
            user: sanitizeUser(user),
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
const getMe = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }
        const user = await User_1.default.findById(req.userId).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, user });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.getMe = getMe;
const listUsers = async (req, res) => {
    try {
        const requester = req.user || (req.userId ? await User_1.default.findById(req.userId).select("-password") : null);
        const users = await User_1.default.find().select("-password").sort({ createdAt: -1 });
        if (requester?.role === "super_admin") {
            return res.json({ success: true, users });
        }
        if (requester?.role === "jamaat_admin") {
            const scopedJamaat = String(requester?.jamaat || "").trim();
            const visibleUsers = users.filter((user) => {
                if (isDefaultAdminUser(user) || user.role === "super_admin") {
                    return false;
                }
                return String(user.jamaat || "").trim() === scopedJamaat;
            });
            return res.json({ success: true, users: visibleUsers });
        }
        const visibleUsers = users.filter((user) => !isDefaultAdminUser(user) && user.role !== "super_admin");
        return res.json({ success: true, users: visibleUsers });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.listUsers = listUsers;
const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        if (!userId || !role) {
            return res.status(400).json({ success: false, message: "userId and role are required" });
        }
        if (!["jamaat_admin", "member"].includes(role)) {
            return res.status(400).json({ success: false, message: "Super admin role cannot be assigned from this panel" });
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (isDefaultAdminUser(user)) {
            return res.status(400).json({ success: false, message: "The default admin account cannot be modified" });
        }
        user.role = role;
        await user.save();
        return res.json({ success: true, user: sanitizeUser(user) });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.updateUserRole = updateUserRole;
const removeUser = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required" });
        }
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (isDefaultAdminUser(user)) {
            return res.status(400).json({ success: false, message: "The default admin account cannot be removed" });
        }
        await User_1.default.findByIdAndDelete(userId);
        return res.json({ success: true, message: "User removed" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.removeUser = removeUser;
const listCommunityGroups = async (req, res) => {
    try {
        const groups = await CommunityGroup_1.default.find().sort({ createdAt: -1 });
        return res.json({ success: true, groups });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.listCommunityGroups = listCommunityGroups;
const createCommunityGroup = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: "Group name is required" });
        }
        const existingGroup = await CommunityGroup_1.default.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
        if (existingGroup) {
            return res.status(400).json({ success: false, message: "This group already exists" });
        }
        const group = await CommunityGroup_1.default.create({
            name: name.trim(),
            createdBy: req.userId,
        });
        return res.json({ success: true, group });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.createCommunityGroup = createCommunityGroup;
