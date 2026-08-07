import { Router } from "express";
import { getAllJobs, createJob, deleteJob } from "../controllers/jobs.controller";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/all", getAllJobs);
router.get("/", getAllJobs);
router.post("/create", authMiddleware, adminMiddleware, createJob);
router.post("/", authMiddleware, adminMiddleware, createJob);
router.delete("/:id", authMiddleware, adminMiddleware, deleteJob);

export default router;
