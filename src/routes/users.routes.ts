import express, { Request, Response } from "express";
import User from "../models/User";
import { login, register } from "../controllers/auth.controller";

const router = express.Router();

router.get("/users", async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

router.post("/register", register);
router.post("/login", login);

export default router;