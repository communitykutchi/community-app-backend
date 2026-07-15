import { Request, Response } from "express";
import User from "../models/User";
import CommunityGroup from "../models/CommunityGroup";
import CommunityProfile from "../models/CommunityProfile";
import Otp from "../models/Otp";
import Post from "../models/Post";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middlewares/auth.middleware";
import { sendOtpEmail } from "../services/email.service";
import { uploadBufferToCloudinary } from "../config/cloudinary";

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
    existingAdmin.username = existingAdmin.username || "admin";
    existingAdmin.email = "admin@communityhub.com";
    existingAdmin.mobile = "03000000000";
    existingAdmin.role = "super_admin";
    existingAdmin.password = await bcrypt.hash("Admin@123", 10);
    existingAdmin.fullName = existingAdmin.fullName || "Community Admin";
    await existingAdmin.save();
    return existingAdmin;
  }

  const adminMobile = "03000000000";
  const adminEmail = "admin@communityhub.com";
  const adminPassword = "Admin@123";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await User.create({
    fullName: "Community Admin",
    username: "admin",
    mobile: adminMobile,
    email: adminEmail,
    password: hashedPassword,
    role: "super_admin",
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
      username,
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

    const normalizedName = String(fullName || "").trim();
    const normalizedUsername = String(username || "").trim().toLowerCase();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedName || !normalizedUsername || !password || !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Username, Email & Password are required",
      });
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
      return res.status(400).json({ success: false, message: "Username must be 3 to 30 characters" });
    }

    if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      return res.status(400).json({ success: false, message: "Username format is invalid" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const verifiedOtp = await Otp.findOne({
      email: normalizedEmail,
      purpose: "register",
      used: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!verifiedOtp) {
      return res.status(400).json({ success: false, message: "Please verify your email first" });
    }

    const existingUsernameUser = await User.findOne({ username: normalizedUsername });
    if (existingUsernameUser) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName: normalizedName,
      username: normalizedUsername,
      dob,
      cnic,
      mobile: mobile ? String(mobile).trim() : undefined,
      email: normalizedEmail,
      password: hashedPassword,
      role: "member",
    });

    await newUser.save();

    await CommunityProfile.create({
      userId: newUser._id,
      fatherName: fatherName ? String(fatherName).trim() : undefined,
      motherName: motherName ? String(motherName).trim() : undefined,
      jamaat: jamaat ? String(jamaat).trim() : undefined,
      cast: cast ? String(cast).trim() : undefined,
      familyMembers: familyMembers === undefined || familyMembers === "" ? undefined : Number(familyMembers),
      homeStatus: homeStatus || "Owner",
      occupation: occupation || "Employee",
      businessName: businessName ? String(businessName).trim() : undefined,
    });

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

export const checkUsername = async (req: Request, res: Response) => {
  try {
    const rawUsername = req.query.username ?? req.body?.username;
    const username = String(rawUsername || "").trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required", available: false });
    }

    if (username.length < 3 || username.length > 30 || !/^[a-z0-9._-]+$/.test(username)) {
      return res.status(400).json({ success: false, message: "Invalid username", available: false });
    }

    const existing = await User.findOne({ username }).select("_id");
    return res.json({ success: true, available: !existing });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Unable to check username", available: false });
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret");

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

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const fullName = String(req.body.fullName || "").trim();
    if (!fullName) {
      return res.status(400).json({ success: false, message: "Full name is required" });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const mobile = String(req.body.mobile || "").trim();
    const homeStatus = String(req.body.homeStatus || "Owner");
    const occupation = String(req.body.occupation || "Employee");

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    if (!["Owner", "Rent"].includes(homeStatus)) {
      return res.status(400).json({ success: false, message: "Invalid home status" });
    }

    if (!["Employee", "Business Man"].includes(occupation)) {
      return res.status(400).json({ success: false, message: "Invalid occupation" });
    }

    if (email) {
      const existingEmailUser = await User.findOne({ email, _id: { $ne: req.userId } }).select("_id");
      if (existingEmailUser) {
        return res.status(400).json({ success: false, message: "Email is already used by another account" });
      }
    }

    if (mobile) {
      const existingMobileUser = await User.findOne({ mobile, _id: { $ne: req.userId } }).select("_id");
      if (existingMobileUser) {
        return res.status(400).json({ success: false, message: "Mobile is already used by another account" });
      }
    }

    user.fullName = fullName;
    user.dob = String(req.body.dob || "").trim();
    user.cnic = String(req.body.cnic || "").trim();
    user.mobile = mobile || undefined;
    user.email = email || undefined;

    await user.save();

    const communityProfile = await CommunityProfile.findOne({ userId: req.userId });
    if (communityProfile) {
      communityProfile.fatherName = String(req.body.fatherName || "").trim();
      communityProfile.motherName = String(req.body.motherName || "").trim();
      communityProfile.familyMembers = req.body.familyMembers === undefined || req.body.familyMembers === "" ? undefined : Number(req.body.familyMembers);
      communityProfile.cast = String(req.body.cast || "").trim();
      communityProfile.homeStatus = (homeStatus === "Rent" ? "Rent" : "Owner") as "Owner" | "Rent";
      communityProfile.occupation = (occupation === "Business Man" ? "Business Man" : "Employee") as "Employee" | "Business Man";
      communityProfile.businessName = String(req.body.businessName || "").trim();
      communityProfile.jamaat = String(req.body.jamaat || "").trim();
      await communityProfile.save();
    } else {
      await CommunityProfile.create({
        userId: req.userId,
        fatherName: String(req.body.fatherName || "").trim(),
        motherName: String(req.body.motherName || "").trim(),
        familyMembers: req.body.familyMembers === undefined || req.body.familyMembers === "" ? undefined : Number(req.body.familyMembers),
        cast: String(req.body.cast || "").trim(),
        homeStatus: (homeStatus === "Rent" ? "Rent" : "Owner") as "Owner" | "Rent",
        occupation: (occupation === "Business Man" ? "Business Man" : "Employee") as "Employee" | "Business Man",
        businessName: String(req.body.businessName || "").trim(),
        jamaat: String(req.body.jamaat || "").trim(),
      });
    }

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(400).json({ success: false, message: "Mobile or email is already used by another account" });
    }

    return res.status(500).json({ success: false, message: err.message || "Unable to update profile" });
  }
};

export const updateProfilePhoto = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ success: false, message: "Profile photo is required" });
    }

    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ success: false, message: "Only image files are allowed" });
    }

    const uploadResult = await uploadBufferToCloudinary(file, {
      folder: process.env.CLOUDINARY_PROFILE_FOLDER || "community-app/profile-photos",
      resourceType: "image",
    });

    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        profilePhotoUrl: uploadResult.secure_url,
        profilePhotoPublicId: uploadResult.public_id,
      },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user, profilePhotoUrl: uploadResult.secure_url });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to upload profile photo" });
  }
};

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const requester = req.user || (req.userId ? await User.findById(req.userId).select("-password") : null);
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    if (requester?.role === "super_admin") {
      return res.json({ success: true, users });
    }

    if (requester?.role === "moderator") {
      const requesterProfile = await CommunityProfile.findOne({ userId: requester?._id }).lean();
      const scopedJamaat = String(requesterProfile?.jamaat || "").trim();
      const visibleUsers = users.filter((user) => {
        if (isDefaultAdminUser(user) || user.role === "super_admin") {
          return false;
        }

        return false;
      });

      if (scopedJamaat) {
        const scopedProfiles = await CommunityProfile.find({ jamaat: scopedJamaat }).select("userId").lean();
        const scopedUserIds = new Set(scopedProfiles.map((profile) => String(profile.userId)));
        const filteredUsers = users.filter((user) => scopedUserIds.has(String(user._id)));
        return res.json({ success: true, users: filteredUsers });
      }

      return res.json({ success: true, users: [] });
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

    const userIdString = String(userId);

    await Post.deleteMany({ userId });
    await Post.updateMany(
      {},
      {
        $pull: {
          likes: userIdString,
          shareUserIds: { $regex: `^${userIdString}:` },
          comments: { userId: userIdString },
        },
      }
    );
    await Post.updateMany(
      {},
      {
        $pull: {
          "comments.$[].replies": { userId: userIdString },
        },
      }
    );
    await User.findByIdAndDelete(userId);

    return res.json({ success: true, message: "User, posts, and post activity removed" });
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
