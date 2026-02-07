import RentalPlan from "../models/RentalPlan.js";
import { cloudinary } from "../config/cloudinary.js";

// Create Rental Plan
export const createRentalPlan = async (req, res) => {
  try {
    const { planName, price, features, tag, installationCost, deposit, isActive, billingCycle } = req.body;

    if (!planName || !price) {
      return res.status(400).json({ message: "planName and price are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Parse features if it's a string (from FormData)
    let parsedFeatures = [];
    if (typeof features === "string") {
      try {
        parsedFeatures = JSON.parse(features);
      } catch (e) {
        parsedFeatures = features.split(",").map(f => f.trim());
      }
    } else if (Array.isArray(features)) {
      parsedFeatures = features;
    }

    const rentalPlan = await RentalPlan.create({
      planName,
      price: Number(price),
      features: parsedFeatures,
      tag: tag || "",
      installationCost: installationCost || "Free",
      deposit: deposit || "None", 
      billingCycle: billingCycle || "Monthly",
      isActive: isActive === "false" ? false : true,
      image: {
        url: req.file.path,
        publicId: req.file.filename,
      },
    });

    res.status(201).json({ message: "Rental Plan created", rentalPlan });
  } catch (error) {
    console.error("createRentalPlan error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// List Rental Plans
export const getRentalPlans = async (req, res) => {
  try {
    // Optionally filter by isActive if needed, but admin might want to see all
    // For now, return all sorted by price
    const plans = await RentalPlan.find().sort({ price: 1 });
    res.status(200).json({ plans });
  } catch (error) {
    console.error("getRentalPlans error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Single Plan
export const getRentalPlan = async (req, res) => {
  try {
    const plan = await RentalPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.status(200).json({ plan });
  } catch (error) {
    console.error("getPlan error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Rental Plan
export const updateRentalPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planName, price, features, tag, installationCost, deposit, isActive, billingCycle } = req.body;

    const plan = await RentalPlan.findById(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // Handle Image Update
    if (req.file) {
      // Delete old image
      if (plan.image && plan.image.publicId) {
        await cloudinary.uploader.destroy(plan.image.publicId);
      }
      plan.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    if (planName) plan.planName = planName;
    if (price) plan.price = Number(price);
    
    if (features) {
       if (typeof features === "string") {
          try {
            plan.features = JSON.parse(features);
          } catch (e) {
            plan.features = features.split(",").map(f => f.trim());
          }
        } else if (Array.isArray(features)) {
          plan.features = features;
        }
    }

    if (tag !== undefined) plan.tag = tag;
    if (installationCost !== undefined) plan.installationCost = installationCost;
    if (deposit !== undefined) plan.deposit = deposit;
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (isActive !== undefined) plan.isActive = isActive === "true" || isActive === true;

    await plan.save();
    res.status(200).json({ message: "Plan updated", plan });
  } catch (error) {
    console.error("updatePlan error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete Rental Plan
export const deleteRentalPlan = async (req, res) => {
  try {
    const plan = await RentalPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    if (plan.image && plan.image.publicId) {
      await cloudinary.uploader.destroy(plan.image.publicId);
    }

    await plan.deleteOne();
    res.status(200).json({ message: "Plan deleted" });
  } catch (error) {
    console.error("deletePlan error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
