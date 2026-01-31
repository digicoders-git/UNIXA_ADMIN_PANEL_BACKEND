// controllers/offerController.js
import Offer from "../models/Offer.js";

export const createOffer = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      endDate,
    } = req.body;

    if (!code || !title || !discountType || !discountValue) {
      return res
        .status(400)
        .json({ message: "code, title, discountType, discountValue required" });
    }

    const exists = await Offer.findOne({ code });
    if (exists) return res.status(409).json({ message: "Code already exists" });

    const offer = await Offer.create({
      code: code.toUpperCase(),
      title,
      description,
      discountType,
      discountValue,
      minOrderAmount: Number(minOrderAmount || 0),
      maxDiscountAmount: Number(maxDiscountAmount || 0),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.status(201).json({ message: "Offer created", offer });
  } catch (err) {
    console.error("createOffer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listOffers = async (_req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json({ offers });
  } catch (err) {
    console.error("listOffers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getOfferByCode = async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const now = new Date();

    const offer = await Offer.findOne({ code, isActive: true });
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    if (offer.startDate && offer.startDate > now)
      return res.status(400).json({ message: "Offer not started" });
    if (offer.endDate && offer.endDate < now)
      return res.status(400).json({ message: "Offer expired" });

    res.json({ offer });
  } catch (err) {
    console.error("getOfferByCode error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    const {
      title,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      isActive,
    } = req.body;

    if (title) offer.title = title;
    if (description !== undefined) offer.description = description;
    if (discountType) offer.discountType = discountType;
    if (discountValue !== undefined)
      offer.discountValue = Number(discountValue);
    if (minOrderAmount !== undefined)
      offer.minOrderAmount = Number(minOrderAmount);
    if (maxDiscountAmount !== undefined)
      offer.maxDiscountAmount = Number(maxDiscountAmount);
    if (startDate) offer.startDate = new Date(startDate);
    if (endDate) offer.endDate = new Date(endDate);
    if (isActive !== undefined) offer.isActive = !!isActive;

    await offer.save();
    res.json({ message: "Offer updated", offer });
  } catch (err) {
    console.error("updateOffer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    await Offer.deleteOne({ _id: offer._id });
    res.json({ message: "Offer deleted" });
  } catch (err) {
    console.error("deleteOffer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
