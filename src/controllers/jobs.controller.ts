import { Request, Response } from "express";
import Job from "../models/Job";

export const getAllJobs = async (req: Request, res: Response) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch jobs." });
  }
};

export const createJob = async (req: Request, res: Response) => {
  try {
    const { title, company, category, jobType, location, salary, description, requirements, contactEmail, contactPhone } = req.body;

    if (!title || !company || !location || !description) {
      return res.status(400).json({ success: false, message: "Title, company, location, and description are required." });
    }

    const reqArray = typeof requirements === "string" 
      ? requirements.split("\n").map(r => r.trim()).filter(Boolean)
      : Array.isArray(requirements) ? requirements : [];

    const newJob = await Job.create({
      title,
      company,
      category: category || "Software & IT",
      jobType: jobType || "Full-time",
      location,
      salary: salary || "",
      description,
      requirements: reqArray,
      contactEmail: contactEmail || "",
      contactPhone: contactPhone || "",
      postedBy: (req as any).user?._id,
    });

    res.status(201).json({ success: true, job: newJob });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to create job." });
  }
};

export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const job = await Job.findByIdAndDelete(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }
    res.json({ success: true, message: "Job deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete job." });
  }
};
