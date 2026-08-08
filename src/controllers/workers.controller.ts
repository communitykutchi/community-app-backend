import { Request, Response } from "express";
import Worker from "../models/Worker";

export const getAllWorkers = async (req: Request, res: Response) => {
  try {
    const workers = await Worker.find().sort({ createdAt: -1 });
    res.json({ success: true, jobs: workers, workers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch workers." });
  }
};

export const createWorker = async (req: Request, res: Response) => {
  try {
    const { title, company, category, jobType, location, salary, description, requirements, contactEmail, contactPhone, hasWhatsApp } = req.body;

    if (!title || !company || !location || !description) {
      return res.status(400).json({ success: false, message: "Title, company, location, and description are required." });
    }

    const reqArray = typeof requirements === "string" 
      ? requirements.split("\n").map(r => r.trim()).filter(Boolean)
      : Array.isArray(requirements) ? requirements : [];

    const newWorker = await Worker.create({
      title,
      company,
      category: category || "Other",
      jobType: jobType || "Services / Daily Wages",
      location,
      salary: salary || "",
      description,
      requirements: reqArray,
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || "",
      hasWhatsApp: typeof hasWhatsApp === "boolean" ? hasWhatsApp : true,
      postedBy: (req as any).user?._id,
    });

    res.status(201).json({ success: true, job: newWorker, worker: newWorker });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to create worker." });
  }
};

export const deleteWorker = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?._id;
    const userRole = (req as any).user?.role || "member";

    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({ success: false, message: "Worker listing not found." });
    }

    const isAdmin = ["super_admin", "admin", "moderator"].includes(userRole);
    const isOwner = worker.postedBy && String(worker.postedBy) === String(userId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "You are not authorized to delete this listing." });
    }

    await Worker.findByIdAndDelete(id);
    res.json({ success: true, message: "Worker listing deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete worker." });
  }
};

export const addWorkerReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user = (req as any).user;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5 stars." });
    }

    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Review comment is required." });
    }

    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({ success: false, message: "Worker listing not found." });
    }

    const newReview = {
      userId: user?._id,
      userName: user?.fullName || user?.username || "Community Member",
      userPhotoUrl: user?.profilePhotoUrl || "",
      rating: Number(rating),
      comment: comment.trim(),
      createdAt: new Date(),
    };

    if (!worker.reviews) worker.reviews = [];
    worker.reviews.unshift(newReview as any);

    const totalRatings = worker.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    worker.totalReviews = worker.reviews.length;
    worker.averageRating = Number((totalRatings / worker.reviews.length).toFixed(1));

    await worker.save();

    res.json({ success: true, job: worker, worker, message: "Review added successfully! رائے شامل ہو گئی۔" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to submit review." });
  }
};

export const getAllJobs = getAllWorkers;
export const createJob = createWorker;
export const deleteJob = deleteWorker;
