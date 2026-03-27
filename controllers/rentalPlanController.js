import fs from "fs";
import RentalPlan from "../models/RentalPlan.js";
import { fileToUrl } from "../config/cloudinary.js";

const deleteLocalFile = (p) => { if (p && fs.existsSync(p)) fs.unlinkSync(p); };

// Create Rental Plan
export const createRentalPlan = async (req, res) => {
  try {
    const { planName, price, features, tag, installationCost, deposit, securityMoney, discount, freeUses, freeParts, isActive, billingCycle, amcPlans, productId, description } = req.body;

    if (!planName) {
      return res.status(400).json({ message: "planName is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const parseStringArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return val.split(",").map(f => f.trim()).filter(Boolean); }
    };

    const rentalPlan = await RentalPlan.create({
      planName,
      price: Number(price) || 0,
      features: parseStringArray(features),
      tag: tag || "",
      installationCost: installationCost || "Free",
      deposit: deposit || "None",
      securityMoney: securityMoney || "None",
      discount: Number(discount) || 0,
      freeUses: parseStringArray(freeUses),
      freeParts: parseStringArray(freeParts),
      billingCycle: billingCycle || "Monthly",
      isActive: isActive === "false" ? false : true,
      image: { url: fileToUrl(req.file), publicId: req.file.path },
      amcPlans: typeof amcPlans === "string" ? JSON.parse(amcPlans) : amcPlans || [],
      productId: productId || null,
      description: description || "",
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
    // Populate product and its category, and amcPlans
    const plans = await RentalPlan.find({ showOnWebsite: true })
      .populate({
        path: "productId",
        populate: { path: "category" }
      })
      .populate("amcPlans")
      .sort({ price: 1 });
    res.status(200).json({ plans });
  } catch (error) {
    console.error("getRentalPlans error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get Single Plan
export const getRentalPlan = async (req, res) => {
  try {
    const plan = await RentalPlan.findById(req.params.id)
      .populate({
        path: "productId",
        populate: { path: "category" }
      })
      .populate("amcPlans");
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
    const { planName, price, features, tag, installationCost, deposit, securityMoney, discount, freeUses, freeParts, isActive, billingCycle, amcPlans, productId, description } = req.body;

    const plan = await RentalPlan.findById(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const parseStringArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try { return JSON.parse(val); } catch { return val.split(",").map(f => f.trim()).filter(Boolean); }
    };

    // Handle Image Update
    if (req.file) {
      deleteLocalFile(plan.image?.publicId);
      plan.image = { url: fileToUrl(req.file), publicId: req.file.path };
    }

    if (planName) plan.planName = planName;
    if (price) plan.price = Number(price);
    if (features) plan.features = parseStringArray(features);
    if (tag !== undefined) plan.tag = tag;
    if (installationCost !== undefined) plan.installationCost = installationCost;
    if (deposit !== undefined) plan.deposit = deposit;
    if (securityMoney !== undefined) plan.securityMoney = securityMoney;
    if (discount !== undefined) plan.discount = Number(discount) || 0;
    if (freeUses !== undefined) plan.freeUses = parseStringArray(freeUses);
    if (freeParts !== undefined) plan.freeParts = parseStringArray(freeParts);
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (amcPlans !== undefined) {
      try { plan.amcPlans = typeof amcPlans === "string" ? JSON.parse(amcPlans) : amcPlans; } catch { plan.amcPlans = amcPlans; }
    }
    if (isActive !== undefined) plan.isActive = isActive === "true" || isActive === true;
    if (req.body.showOnWebsite !== undefined) plan.showOnWebsite = req.body.showOnWebsite === "true" || req.body.showOnWebsite === true;
    if (productId !== undefined) plan.productId = productId || null;
    if (description !== undefined) plan.description = description;

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

    deleteLocalFile(plan.image?.publicId);
    await plan.deleteOne();
    res.status(200).json({ message: "Plan deleted" });
  } catch (error) {
    console.error("deletePlan error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
