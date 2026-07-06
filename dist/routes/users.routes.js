"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = __importDefault(require("../models/User"));
const auth_controller_1 = require("../controllers/auth.controller");
const router = express_1.default.Router();
router.get("/users", async (req, res) => {
    try {
        const users = await User_1.default.find();
        res.status(200).json(users);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
});
router.post("/register", auth_controller_1.register);
router.post("/login", auth_controller_1.login);
exports.default = router;
