import { Request, Response } from "express";
import User from "../models/User";
import CommunityGroup from "../models/CommunityGroup";
import Otp from "../models/Otp";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middlewares/auth.middleware";
import { sendOtpEmail } from "../services/email.service";

const sanitizeUser = (user: any) => {
  const userObject = user.toObject ? user.toObject() : user;
  delete userObject.password;
  return userObject;
};

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const ensureDefaultAdmin = async () => {
  const existingAdmin = await User.findOne({
    $or: [{ email: "admin@communityhub.com" }, { mobile: "03000000000" }, { role: "super_admin" }, { role: "admin" }],
  });

  if (existingAdmin) {
    existingAdmin.email = "admin@communityhub.com";
    existingAdmin.mobile = "03000000000";
    existingAdmin.role = "super_admin";
    existingAdmin.password = await bcrypt.hash("Admin@123", 10);
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
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await User.create({
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

export const sendOtp = async (req: Request, res: Response) => {
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
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "This email is already registered" });
      }
    } else {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (!existingUser) {
        return res.status(404).json({ success: false, message: "No account found for this email" });
      }
    }

    await Otp.deleteMany({ email: normalizedEmail, purpose });

    const code = generateOtpCode();
    await Otp.create({
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
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Resend is not configured") || err.message.includes("EMAIL_FROM is required"))) {
      return res.status(400).json({
        success: false,
        message: "Email service is not configured. Set RESEND_API_KEY and EMAIL_FROM in backend .env, then restart backend.",
      });
    }

    const errorMessage = err instanceof Error ? err.message : "Unable to send OTP";
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, code, purpose } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !code || !["register", "reset_password"].includes(purpose)) {
      return res.status(400).json({ success: false, message: "Email, OTP, and purpose are required" });
    }

    const otpRecord = await Otp.findOne({
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
  } catch (err) {
    return res.status(500).json({ success: false, message: "Unable to verify OTP" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, OTP, and new password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found for this email" });
    }

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      purpose: "reset_password",
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord || otpRecord.code !== String(otp)) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    otpRecord.used = true;
    await otpRecord.save();

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Unable to reset password" });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const {
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
      password,
      jamaat,
    } = req.body;

    if (!fullName || !mobile || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Mobile, Email & Password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const verifiedOtp = await Otp.findOne({
      email: normalizedEmail,
      purpose: "register",
      used: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!verifiedOtp) {
      return res.status(400).json({ success: false, message: "Please verify your email first" });
    }

    const exists = await User.findOne({ mobile });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered",
      });
    }

    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
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
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const defaultAdminMobile = (value: string) => value === "03000000000" || value === "0300-0000000";
const defaultAdminEmail = (value: string) => value === "admin@communityhub.com";
const isDefaultAdminUser = (user: any) => {
  const email = String(user?.email || "").toLowerCase();
  const mobile = String(user?.mobile || "");
  return email === "admin@communityhub.com" || mobile === "03000000000" || mobile === "0300-0000000";
};

export const login = async (req: Request, res: Response) => {
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

    let user = await User.findOne({
      $or: [{ mobile: loginValue }, { email: loginValue }],
    });

    if (user && (isDefaultAdminAttempt || user.role === "admin" || user.role === "super_admin")) {
      await ensureDefaultAdmin();
      user = await User.findOne({
        $or: [{ mobile: loginValue }, { email: loginValue }],
      });
    }

    if (!user && isDefaultAdminAttempt) {
      const defaultAdmin = await ensureDefaultAdmin();
      user = defaultAdmin;
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile/email or password.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile or password.",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const requester = req.user || (req.userId ? await User.findById(req.userId).select("-password") : null);
    const users = await User.find().select("-password").sort({ createdAt: -1 });

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
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params as any;
    const { role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ success: false, message: "userId and role are required" });
    }

    if (!["jamaat_admin", "member"].includes(role)) {
      return res.status(400).json({ success: false, message: "Super admin role cannot be assigned from this panel" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isDefaultAdminUser(user)) {
      return res.status(400).json({ success: false, message: "The default admin account cannot be modified" });
    }

    user.role = role;
    await user.save();

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const removeUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params as any;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isDefaultAdminUser(user)) {
      return res.status(400).json({ success: false, message: "The default admin account cannot be removed" });
    }

    await User.findByIdAndDelete(userId);

    return res.json({ success: true, message: "User removed" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const listCommunityGroups = async (req: Request, res: Response) => {
  try {
    const groups = await CommunityGroup.find().sort({ createdAt: -1 });
    return res.json({ success: true, groups });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createCommunityGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    const existingGroup = await CommunityGroup.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
    if (existingGroup) {
      return res.status(400).json({ success: false, message: "This group already exists" });
    }

    const group = await CommunityGroup.create({
      name: name.trim(),
      createdBy: req.userId,
    });

    return res.json({ success: true, group });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
