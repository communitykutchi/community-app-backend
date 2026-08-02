import { Router } from "express";
import { listPolls, createPoll, votePoll, deletePoll } from "../controllers/polls.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();

router.get("/all", listPolls);
router.post("/create", authMiddleware, createPoll);
router.post("/:pollId/vote", authMiddleware, votePoll);
router.delete("/:pollId", authMiddleware, deletePoll);

export default router;
