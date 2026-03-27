import AmcPlan from "../models/AmcPlan.js";

const parseFeatures = (f) => Array.isArray(f) ? f : (f || "").split(",").map(x => x.trim()).filter(Boolean);

export const createPlan = async (req, res) => {
  try {
    const { name, amcType, servicesIncluded, features, color, isPopular, isActive, partsIncluded, productConfigs } = req.body;
    const configs = (productConfigs || []).map(c => ({
      productId: c.productId,
      rateOneYear: Number(c.rateOneYear) || 0,
      rateTwoYear: Number(c.rateTwoYear) || 0,
      rateThreeYear: Number(c.rateThreeYear) || 0,
      discount: Number(c.discount) || 0,
      serviceSchedule: { type: c.serviceSchedule?.type || "Half Yearly", intervalMonths: c.serviceSchedule?.type === "Quarterly" ? 3 : 6 },
    }));
    const plan = await AmcPlan.create({
      name, amcType, servicesIncluded, partsIncluded,
      price: configs[0]?.rateOneYear || 0,
      features: parseFeatures(features),
      color: color || "blue",
      isPopular: !!isPopular,
      isActive: isActive !== false,
      productConfigs: configs,
      productIds: configs.map(c => c.productId),
    });
    res.status(201).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ message: "Error creating plan", error: err.message });
  }
};

export const getPlans = async (req, res) => {
  try {
    const query = req.query.activeOnly === "true" ? { isActive: true } : {};
    const plans = await AmcPlan.find(query)
      .populate("productConfigs.productId", "name price mainImage")
      .populate("productIds", "name price")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ message: "Error fetching plans", error: err.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { productConfigs, features, ...rest } = req.body;
    const update = { ...rest };
    if (features) update.features = parseFeatures(features);
    if (productConfigs) {
      update.productConfigs = productConfigs.map(c => ({
        productId: c.productId,
        rateOneYear: Number(c.rateOneYear) || 0,
        rateTwoYear: Number(c.rateTwoYear) || 0,
        rateThreeYear: Number(c.rateThreeYear) || 0,
        discount: Number(c.discount) || 0,
        serviceSchedule: { type: c.serviceSchedule?.type || "Half Yearly", intervalMonths: c.serviceSchedule?.type === "Quarterly" ? 3 : 6 },
      }));
      update.productIds = update.productConfigs.map(c => c.productId);
      update.price = update.productConfigs[0]?.rateOneYear || 0;
    }
    const plan = await AmcPlan.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("productConfigs.productId", "name price mainImage");
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.status(200).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ message: "Error updating plan", error: err.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    await AmcPlan.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting plan", error: err.message });
  }
};

// legacy — kept for backward compat
export const assignProducts = async (req, res) => {
  try {
    const plan = await AmcPlan.findByIdAndUpdate(req.params.id, { productIds: req.body.productIds }, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.status(200).json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};

export const getAmcProducts = async (req, res) => {
  try {
    const plan = await AmcPlan.findById(req.params.id).populate("productIds");
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.status(200).json({ success: true, productIds: plan.productIds });
  } catch (err) {
    res.status(500).json({ message: "Error", error: err.message });
  }
};
