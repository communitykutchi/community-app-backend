import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import user from "../models/User";
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/users", async (req, res) => {
  try {
    const users = await user.find(); 
    res.json(users);}  
    catch (error) {
    res.status(500).json({ message: "Server Error" });
  }       
})

export default router;