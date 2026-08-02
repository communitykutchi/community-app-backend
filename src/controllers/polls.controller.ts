import { Response } from "express";
import mongoose from "mongoose";
import Poll from "../models/Poll";
import { AuthRequest } from "../middlewares/auth.middleware";

export const listPolls = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId ? String(req.userId) : "";
    const polls = await Poll.find()
      .populate("createdBy", "fullName username profilePhotoUrl role")
      .sort({ createdAt: -1 })
      .lean();

    const formattedPolls = polls.map((poll: any) => {
      let totalVotes = 0;
      let userVotedOptionId: string | null = null;

      const formattedOptions = (poll.options || []).map((opt: any) => {
        const optionId = String(opt._id);
        const votesArr = Array.isArray(opt.votes) ? opt.votes.map((v: any) => String(v._id || v)) : [];
        const voteCount = votesArr.length;
        totalVotes += voteCount;

        if (userId && votesArr.includes(userId)) {
          userVotedOptionId = optionId;
        }

        return {
          _id: optionId,
          text: opt.text,
          voteCount,
        };
      });

      const optionsWithPercentage = formattedOptions.map((opt: any) => ({
        ...opt,
        percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0,
      }));

      const now = Date.now();
      const isExpired = Boolean(poll.expiresAt && new Date(poll.expiresAt).getTime() < now);

      return {
        _id: String(poll._id),
        question: poll.question,
        description: poll.description || "",
        category: poll.category || "General",
        options: optionsWithPercentage,
        totalVotes,
        userVotedOptionId,
        createdBy: poll.createdBy || { fullName: "Community Member" },
        isClosed: Boolean(poll.isClosed || isExpired),
        isExpired,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
      };
    });

    return res.json({ success: true, polls: formattedPolls });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load polls" });
  }
};

export const createPoll = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const requesterRole = String(req.user?.role || "");
    if (!["super_admin", "admin", "moderator"].includes(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: "Only community Admins and Moderators can create polls.",
      });
    }

    const { question, options, category, durationDays, description } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required." });
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 options are required." });
    }

    const cleanOptions = options
      .map((opt: any) => (typeof opt === "string" ? opt.trim() : String(opt?.text || "").trim()))
      .filter((text: string) => text.length > 0);

    if (cleanOptions.length < 2) {
      return res.status(400).json({ success: false, message: "Please provide at least 2 non-empty options." });
    }

    let expiresAt: Date | undefined = undefined;
    const days = Number(durationDays);
    if (!isNaN(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const poll = await Poll.create({
      question: question.trim(),
      description: description ? String(description).trim() : undefined,
      category: category ? String(category).trim() : "General",
      options: cleanOptions.map((text: string) => ({ text, votes: [] })),
      createdBy: req.userId,
      expiresAt,
    });

    await poll.populate("createdBy", "fullName username profilePhotoUrl role");

    return res.status(201).json({
      success: true,
      message: "Poll created successfully",
      poll: {
        _id: String(poll._id),
        question: poll.question,
        description: poll.description || "",
        category: poll.category || "General",
        options: poll.options.map((opt) => ({
          _id: String(opt._id),
          text: opt.text,
          voteCount: 0,
          percentage: 0,
        })),
        totalVotes: 0,
        userVotedOptionId: null,
        createdBy: poll.createdBy,
        isClosed: false,
        isExpired: false,
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to create poll" });
  }
};

export const votePoll = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { pollId } = req.params;
    const { optionId } = req.body;

    if (!mongoose.isObjectIdOrHexString(pollId)) {
      return res.status(400).json({ success: false, message: "Invalid poll id" });
    }

    if (!optionId) {
      return res.status(400).json({ success: false, message: "optionId is required" });
    }

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    const now = Date.now();
    if (poll.isClosed || (poll.expiresAt && new Date(poll.expiresAt).getTime() < now)) {
      return res.status(400).json({ success: false, message: "This poll is closed for voting." });
    }

    const userObjId = new mongoose.Types.ObjectId(req.userId);
    const userIdStr = String(req.userId);

    // Remove user vote from all options first
    poll.options.forEach((opt: any) => {
      opt.votes = opt.votes.filter((v: any) => String(v._id || v) !== userIdStr);
    });

    // If user tapped a different option (or first vote), add vote to optionId
    const targetOption = poll.options.find((opt: any) => String(opt._id) === String(optionId));
    if (targetOption) {
      targetOption.votes.push(userObjId as any);
    } else {
      return res.status(400).json({ success: false, message: "Option not found in poll" });
    }

    await poll.save();
    await poll.populate("createdBy", "fullName username profilePhotoUrl role");

    let totalVotes = 0;
    let userVotedOptionId: string | null = null;

    const formattedOptions = poll.options.map((opt: any) => {
      const optId = String(opt._id);
      const votesArr = Array.isArray(opt.votes) ? opt.votes.map((v: any) => String(v._id || v)) : [];
      const voteCount = votesArr.length;
      totalVotes += voteCount;

      if (votesArr.includes(userIdStr)) {
        userVotedOptionId = optId;
      }

      return {
        _id: optId,
        text: opt.text,
        voteCount,
      };
    });

    const optionsWithPercentage = formattedOptions.map((opt: any) => ({
      ...opt,
      percentage: totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0,
    }));

    return res.json({
      success: true,
      poll: {
        _id: String(poll._id),
        question: poll.question,
        description: poll.description || "",
        category: poll.category || "General",
        options: optionsWithPercentage,
        totalVotes,
        userVotedOptionId,
        createdBy: poll.createdBy,
        isClosed: Boolean(poll.isClosed),
        isExpired: Boolean(poll.expiresAt && new Date(poll.expiresAt).getTime() < now),
        expiresAt: poll.expiresAt,
        createdAt: poll.createdAt,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to submit vote" });
  }
};

export const deletePoll = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { pollId } = req.params;
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    const userRole = String(req.user?.role || "");
    const isCreator = String(poll.createdBy) === String(req.userId);
    const isAdmin = ["super_admin", "admin", "moderator"].includes(userRole);

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this poll" });
    }

    await Poll.findByIdAndDelete(pollId);
    return res.json({ success: true, message: "Poll deleted successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to delete poll" });
  }
};
