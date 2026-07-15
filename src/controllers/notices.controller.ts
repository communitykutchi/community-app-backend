import { Response } from "express";
import mongoose from "mongoose";
import Notice, { INotice, ReactionKind } from "../models/Notice";
import NoticeReadState from "../models/NoticeReadState";
import { AuthRequest } from "../middlewares/auth.middleware";

const reactionKinds: ReactionKind[] = ["heart", "thumbs_up", "correct", "wrong"];

function getReactionCounts(notice: INotice) {
  const counts: Record<ReactionKind, number> = {
    heart: 0,
    thumbs_up: 0,
    correct: 0,
    wrong: 0,
  };

  for (const reactionEntry of notice.reactionEntries || []) {
    if (reactionKinds.includes(reactionEntry.reaction)) {
      counts[reactionEntry.reaction] += 1;
    }
  }

  return counts;
}

function serializeNotice(notice: INotice, currentUserId?: string) {
  const counts = getReactionCounts(notice);
  const selectedReaction =
    currentUserId && notice.reactionEntries
      ? notice.reactionEntries.find((entry) => String(entry.userId) === currentUserId)?.reaction
      : undefined;
  const hasShared =
    currentUserId && notice.shareUserIds
      ? notice.shareUserIds.some((userId) => String(userId) === currentUserId)
      : false;

  return {
    id: String(notice._id),
    title: notice.title,
    body: notice.body,
    author: notice.author,
    createdAt: notice.createdAt,
    type: notice.type,
    mayyatDetails: notice.mayyatDetails,
    pinned: Boolean(notice.pinned),
    reactionCounts: counts,
    reactions: counts.heart + counts.thumbs_up + counts.correct + counts.wrong,
    shares: notice.shareUserIds?.length || 0,
    userReaction: selectedReaction,
    hasShared,
  };
}

const ensureLoggedIn = (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return false;
  }
  return true;
};

export const getNotices = async (req: AuthRequest, res: Response) => {
  try {
    const notices = await Notice.find().sort({ pinned: -1, createdAt: -1 }).exec();
    const payload = notices.map((notice) => serializeNotice(notice, req.userId));
    return res.json({ success: true, notices: payload });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to load notices" });
  }
};

export const createNotice = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    const { title, body, type, mayyatDetails, pinned } = req.body;
    const safeType = type === "mayyat" ? "mayyat" : "notice";

    if (!title || !String(title).trim() || !body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: "Title and body are required" });
    }

    const notice = await Notice.create({
      title: String(title).trim(),
      body: String(body).trim(),
      author: req.user?.fullName || "Admin",
      createdBy: new mongoose.Types.ObjectId(req.userId),
      type: safeType,
      mayyatDetails: safeType === "mayyat" ? mayyatDetails : undefined,
      pinned: Boolean(pinned),
      reactionEntries: [],
      shareUserIds: [],
    });

    return res.json({ success: true, notice: serializeNotice(notice, req.userId) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to create notice" });
  }
};

export const updateNotice = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    const { id } = req.params;
    const { title, body, type, pinned, mayyatDetails } = req.body;
    const safeType = type === "mayyat" ? "mayyat" : "notice";

    const notice = await Notice.findById(id).exec();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    if (!title || !String(title).trim() || !body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: "Title and body are required" });
    }

    notice.title = String(title).trim();
    notice.body = String(body).trim();
    notice.type = safeType;
    notice.pinned = Boolean(pinned);
    if (safeType === "mayyat") {
      notice.mayyatDetails = mayyatDetails || notice.mayyatDetails;
    } else {
      notice.mayyatDetails = undefined;
    }

    await notice.save();

    return res.json({ success: true, notice: serializeNotice(notice, req.userId) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to update notice" });
  }
};

export const deleteNotice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Notice.findByIdAndDelete(id).exec();

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    return res.json({ success: true, message: "Notice deleted" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to delete notice" });
  }
};

export const togglePinNotice = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    const { id } = req.params;
    const { pinned } = req.body;
    const notice = await Notice.findById(id).exec();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    notice.pinned = Boolean(pinned);
    await notice.save();

    return res.json({ success: true, notice: serializeNotice(notice, req.userId) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to update pinned state" });
  }
};

export const reactToNotice = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    const { id } = req.params;
    const { reaction } = req.body as { reaction?: ReactionKind };

    if (!reactionKinds.includes(reaction as ReactionKind)) {
      return res.status(400).json({ success: false, message: "Invalid reaction type" });
    }

    const notice = await Notice.findById(id).exec();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const entryIndex = notice.reactionEntries.findIndex((entry) => String(entry.userId) === req.userId);
    if (entryIndex >= 0) {
      notice.reactionEntries[entryIndex].reaction = reaction as ReactionKind;
    } else {
      notice.reactionEntries.push({ userId: new mongoose.Types.ObjectId(req.userId), reaction: reaction as ReactionKind });
    }

    await notice.save();

    return res.json({ success: true, notice: serializeNotice(notice, req.userId) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to react to notice" });
  }
};

export const shareNotice = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    const { id } = req.params;
    const notice = await Notice.findById(id).exec();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    const hasShared = notice.shareUserIds.some((userId) => String(userId) === req.userId);
    if (!hasShared) {
      notice.shareUserIds.push(new mongoose.Types.ObjectId(req.userId));
      await notice.save();
    }

    return res.json({ success: true, notice: serializeNotice(notice, req.userId) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to share notice" });
  }
};

export const markNoticesRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!ensureLoggedIn(req, res)) return;

    await NoticeReadState.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(req.userId) },
      { $set: { lastReadAt: new Date() } },
      { upsert: true, new: true }
    ).exec();

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to update read state" });
  }
};

export const getUnreadNoticeCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.json({ success: true, unreadCount: 0 });
    }

    const currentUserObjectId = new mongoose.Types.ObjectId(req.userId);
    const readState = await NoticeReadState.findOne({ userId: currentUserObjectId }).lean().exec();
    const lastReadAt = readState?.lastReadAt || new Date(0);
    const unreadCount = await Notice.countDocuments({
      createdAt: { $gt: lastReadAt },
      createdBy: { $ne: currentUserObjectId },
    }).exec();

    return res.json({ success: true, unreadCount });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to fetch unread notice count" });
  }
};
