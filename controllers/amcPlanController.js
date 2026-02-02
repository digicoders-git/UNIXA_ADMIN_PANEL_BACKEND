import AmcPlan from "../models/AmcPlan.js";

// Create a new Plan
export const createPlan = async (req, res) => {
  try {
    const { name, price, durationMonths, features, color, isPopular, servicesIncluded, partsIncluded } = req.body;
    
    const newPlan = new AmcPlan({
      name,
      price,
      durationMonths,
      features,
      color,
      isPopular,
      servicesIncluded,
      partsIncluded
    });

    await newPlan.save();
    res.status(201).json({ success: true, plan: newPlan });
  } catch (error) {
    res.status(500).json({ message: "Error creating plan", error: error.message });
  }
};

// Get All Plans (Public/Admin)
export const getPlans = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = {};
    if (activeOnly === 'true') query.isActive = true;

    const plans = await AmcPlan.find(query).sort({ price: 1 });
    res.status(200).json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ message: "Error fetching plans", error: error.message });
  }
};

// Update Plan
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await AmcPlan.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    res.status(200).json({ success: true, plan });
  } catch (error) {
    res.status(500).json({ message: "Error updating plan", error: error.message });
  }
};

// Delete Plan
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await AmcPlan.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting plan", error: error.message });
  }
};
