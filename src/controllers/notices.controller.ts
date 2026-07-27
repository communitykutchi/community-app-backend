import { Response } from "express";
import mongoose from "mongoose";
import Notice, { INotice, ReactionKind } from "../models/Notice";
import NoticeReadState from "../models/NoticeReadState";
import { AuthRequest } from "../middlewares/auth.middleware";

const reactionKinds: ReactionKind[] = ["heart", "thumbs_up", "correct", "wrong"];

function buildMayyatNotices(details: Record<string, any> | undefined) {
  const deceasedName = String(details?.deceasedName || details?.deceasedNameRoman || details?.deceasedNameUrdu || "").trim().toUpperCase();
  const fatherName = String(details?.fatherName || details?.fatherNameRoman || details?.fatherNameUrdu || "").trim();
  const relation = String(details?.relation || details?.relationRoman || details?.relationUrdu || "").trim();
  const relationName = String(details?.relationName || "").trim();
  const dayPart = String(details?.funeralPrayerDayPart || details?.dayPartRoman || details?.dayPartUrdu || "").trim();
  const time = String(details?.funeralPrayerTime || details?.time || details?.funeralPrayerAt || "").trim();
  const place = String(details?.funeralPrayerPlace || details?.janazaLocation || "").trim();
  const notes = String(details?.notes || "").trim();

  const romanLines: string[] = [];
  romanLines.push("**إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ**");

  let line2 = "Humein nihayat afsos ke saath ittila di jaati hai ke";
  if (deceasedName) {
    line2 += ` **${deceasedName}**`;
  }
  if (fatherName && relation) {
    line2 += `, **${fatherName}** ke **${relation}** ka`;
  } else if (fatherName && !relation) {
    line2 += `, **${fatherName}** ka`;
  } else if (!fatherName && relation) {
    line2 += ` ke **${relation}** ka`;
  } else if (relationName) {
    line2 += `, **${relationName}** ka`;
  } else {
    line2 += " ka";
  }
  line2 += " **raza-e-ilahi se inteqal ho gaya hai.**";
  romanLines.push(line2);

  let dayPartStr = dayPart;
  if (dayPartStr && !/^aaj\b/i.test(dayPartStr)) {
    dayPartStr = `Aaj ${dayPartStr}`;
  } else if (!dayPartStr) {
    dayPartStr = "Aaj";
  }

  let timeStr = time;
  if (timeStr && !/baje/i.test(timeStr)) {
    timeStr = `${timeStr} baje`;
  }

  const placeStr = place || "{Namaz-e-Janaza Ka Muqam (Masjid + Address)}";

  let line3 = `**Namaz-e-Janaza ${dayPartStr}`;
  if (timeStr) {
    line3 += ` ${timeStr}`;
  }
  line3 += ` ${placeStr} mein ada ki jaaye gi.**`;
  romanLines.push(line3);

  romanLines.push("Allah Ta'ala marhoom ki maghfirat farmaaye, un ki qabar ko roshan farmaaye, unhein Jannat-ul-Firdous mein aala maqam ata farmaaye aur tamam lawaheqeen ko sabr-e-jameel ata farmaaye.");
  romanLines.push("**Ameen.**");

  if (notes) {
    romanLines.push(`**Note:** ${notes}`);
  }

  const romanNotice = romanLines.join("\n");

  const urduLines: string[] = [];
  urduLines.push("إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ");

  let urduAnnounce = "ہمیں نہایت افسوس کے ساتھ اطلاع دی جاتی ہے کہ";
  if (deceasedName) urduAnnounce += ` ${deceasedName}`;
  if (fatherName || relation || relationName) {
    urduAnnounce += ` (${[fatherName, relation, relationName].filter(Boolean).join(" - ")})`;
  }
  urduAnnounce += " کا رضائے الٰہی سے انتقال ہو گیا ہے۔";
  urduLines.push(urduAnnounce);

  if (timeStr || place) {
    urduLines.push(`نمازِ جنازہ: ${[dayPartStr, timeStr, place].filter(Boolean).join(" - ")} میں ادا کی جائے گی۔`);
  }
  if (notes) urduLines.push(`نوٹ: ${notes}`);

  urduLines.push("اللہ تعالیٰ مرحوم کی مغفرت فرمائے، ان کی قبر کو روشن فرمائے، انہیں جنت الفردوس میں اعلیٰ مقام عطا فرمائے اور تمام لواحقین کو صبرِ جمیل عطا فرمائے۔");
  urduLines.push("آمین۔");

  const urduNotice = urduLines.join("\n\n");

  return { romanNotice, urduNotice };
}

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
    romanNotice: notice.romanNotice,
    urduNotice: notice.urduNotice,
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
    const safeBody = String(body || "").trim();

    if (!title || !String(title).trim() || (!safeBody && safeType !== "mayyat")) {
      return res.status(400).json({ success: false, message: "Title and body are required" });
    }

    const mayyatContent = safeType === "mayyat" ? buildMayyatNotices(mayyatDetails) : undefined;
    const notice = await Notice.create({
      title: String(title).trim(),
      body: safeType === "mayyat" ? mayyatContent?.romanNotice || safeBody : safeBody,
      author: req.user?.fullName || "Admin",
      createdBy: new mongoose.Types.ObjectId(req.userId),
      type: safeType,
      mayyatDetails: safeType === "mayyat" ? mayyatDetails : undefined,
      romanNotice: mayyatContent?.romanNotice || "",
      urduNotice: mayyatContent?.urduNotice || "",
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
    const safeBody = String(body || "").trim();

    const notice = await Notice.findById(id).exec();
    if (!notice) {
      return res.status(404).json({ success: false, message: "Notice not found" });
    }

    if (!title || !String(title).trim() || (!safeBody && safeType !== "mayyat")) {
      return res.status(400).json({ success: false, message: "Title and body are required" });
    }

    notice.title = String(title).trim();
    notice.body = safeType === "mayyat" ? (buildMayyatNotices(mayyatDetails).romanNotice || safeBody) : safeBody;
    notice.type = safeType;
    notice.pinned = Boolean(pinned);
    if (safeType === "mayyat") {
      notice.mayyatDetails = mayyatDetails || notice.mayyatDetails;
      const mayyatContent = buildMayyatNotices(notice.mayyatDetails);
      notice.romanNotice = mayyatContent.romanNotice;
      notice.urduNotice = mayyatContent.urduNotice;
    } else {
      notice.mayyatDetails = undefined;
      notice.romanNotice = "";
      notice.urduNotice = "";
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
