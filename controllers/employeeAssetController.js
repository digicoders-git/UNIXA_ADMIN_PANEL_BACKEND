import EmployeeAsset from "../models/EmployeeAsset.js";
import Employee from "../models/Employee.js";

// Get All Assets
export const getAssets = async (req, res) => {
  try {
    const { status, type, search } = req.query;
    let query = {};

    if (status && status !== "All") query.status = status;
    if (type && type !== "All") query.assetType = type;
    if (search) {
      query.$or = [
        { assetName: { $regex: search, $options: "i" } },
        { uniqueId: { $regex: search, $options: "i" } },
        { modelNumber: { $regex: search, $options: "i" } },
      ];
    }

    const assets = await EmployeeAsset.find(query).populate("assignedTo", "name email phone");
    
    // Stats calculation
    const allAssets = await EmployeeAsset.find();
    const stats = {
        total: allAssets.length,
        assigned: allAssets.filter(a => a.status === 'Assigned').length,
        available: allAssets.filter(a => a.status === 'Available').length,
        repair: allAssets.filter(a => a.status === 'Under Repair').length,
        totalValue: allAssets.reduce((sum, a) => sum + (a.value || 0), 0)
    };

    res.json({ assets, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add New Asset
export const addAsset = async (req, res) => {
  try {
    const asset = new EmployeeAsset(req.body);
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update Asset
export const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await EmployeeAsset.findByIdAndUpdate(id, req.body, { new: true });
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Assign Asset to Employee
export const assignAsset = async (req, res) => {
  try {
    const { id } = req.params; // Asset ID
    const { employeeId, assignedDate, notes } = req.body;

    const asset = await EmployeeAsset.findById(id);
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (asset.status === "Assigned") return res.status(400).json({ message: "Asset already assigned" });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    asset.assignedTo = employeeId;
    asset.assignedDate = assignedDate || new Date();
    asset.status = "Assigned";
    asset.notes = notes;

    await asset.save();
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Return Asset
export const returnAsset = async (req, res) => {
  try {
    const { id } = req.params; // Asset ID
    const { returnDate, condition, remarks } = req.body;

    const asset = await EmployeeAsset.findById(id).populate("assignedTo");
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    
    // Add to history
    if (asset.assignedTo) {
        asset.assignmentHistory.push({
            employeeId: asset.assignedTo._id,
            employeeName: asset.assignedTo.name,
            assignedDate: asset.assignedDate,
            returnDate: returnDate || new Date(),
            conditionOnreturn: condition,
            remarks: remarks
        });
    }

    asset.assignedTo = null;
    asset.assignedDate = null;
    asset.status = condition === 'Damaged' || condition === 'Under Repair' ? 'Under Repair' : 'Available';
    asset.condition = condition || asset.condition; // Update condition

    await asset.save();
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAsset = async (req, res) => {
    try {
        await EmployeeAsset.findByIdAndDelete(req.params.id);
        res.json({ message: "Asset deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
