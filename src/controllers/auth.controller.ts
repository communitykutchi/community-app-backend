import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
    } = req.body;

    if (!fullName || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: "Full Name, Mobile & Password are required",
      });
    }

    const exists = await User.findOne({ mobile });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already registered",
      });
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
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
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

    const user = await User.findOne({
      $or: [{ mobile: loginValue }, { email: loginValue }],
    });
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
      user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
