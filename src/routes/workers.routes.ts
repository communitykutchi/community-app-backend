import { Router } from "express";
import { getAllWorkers, createWorker, deleteWorker, addWorkerReview } from "../controllers/workers.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/all", getAllWorkers);
router.get("/", getAllWorkers);
router.post("/create", authMiddleware, createWorker);
router.post("/", authMiddleware, createWorker);
router.post("/:id/reviews", authMiddleware, addWorkerReview);
router.delete("/:id", authMiddleware, deleteWorker);

export default router;
