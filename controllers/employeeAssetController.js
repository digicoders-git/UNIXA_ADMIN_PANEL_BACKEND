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

// Get My Assets (for employee)
export const getMyAssets = async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log("Fetching assets for employeeId:", employeeId);
    const assets = await EmployeeAsset.find({ assignedTo: employeeId });
    console.log("Found assets:", assets.length);
    res.json({ assets });
  } catch (error) {
    console.error("Error in getMyAssets:", error);
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
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: `Asset with Unique ID "${req.body.uniqueId}" already exists. Please use a different Unique ID.` 
      });
    }
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
    if (asset.status === "Assigned") {
      return res.status(400).json({ 
        message: `This asset is already assigned to ${asset.assignedTo ? 'an employee' : 'someone'}. Please return it first before assigning to another employee.` 
      });
    }

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

// Re-assign Asset (Employee to Employee or Employee to Admin)
export const reassignAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { newEmployeeId, remarks } = req.body;

    const asset = await EmployeeAsset.findById(id).populate("assignedTo");
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    if (!asset.assignedTo) return res.status(400).json({ message: "Asset is not assigned" });

    const oldEmployee = asset.assignedTo;

    // Add to history
    asset.assignmentHistory.push({
      employeeId: oldEmployee._id,
      employeeName: oldEmployee.name,
      assignedDate: asset.assignedDate,
      returnDate: new Date(),
      conditionOnreturn: asset.condition,
      remarks: remarks || `Re-assigned to ${newEmployeeId ? 'another employee' : 'admin'}`
    });

    if (newEmployeeId) {
      const newEmployee = await Employee.findById(newEmployeeId);
      if (!newEmployee) return res.status(404).json({ message: "New employee not found" });
      
      asset.assignedTo = newEmployeeId;
      asset.assignedDate = new Date();
      asset.status = "Assigned";
    } else {
      // Return to admin
      asset.assignedTo = null;
      asset.assignedDate = null;
      asset.status = "Available";
    }

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

// Get Assets History
export const getAssetsHistory = async (req, res) => {
  try {
    const { period, status } = req.query;
    
    const assets = await EmployeeAsset.find().populate("assignedTo", "name email");
    
    let allHistory = [];
    assets.forEach(asset => {
      asset.assignmentHistory.forEach(history => {
        allHistory.push({
          ...history.toObject(),
          assetName: asset.assetName,
          assetId: asset.uniqueId,
          assetType: asset.assetType
        });
      });
      
      // Add current assignment
      if (asset.assignedTo && asset.status === 'Assigned') {
        allHistory.push({
          employeeName: asset.assignedTo.name,
          assignedDate: asset.assignedDate,
          returnDate: null,
          conditionOnreturn: asset.condition,
          remarks: 'Currently Assigned',
          assetName: asset.assetName,
          assetId: asset.uniqueId,
          assetType: asset.assetType,
          status: 'Assigned'
        });
      }
    });
    
    // Filter by period
    if (period && period !== 'All') {
      const now = new Date();
      let startDate;
      
      if (period === 'Today') {
        startDate = new Date(now.setHours(0, 0, 0, 0));
      } else if (period === 'Week') {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (period === 'Month') {
        startDate = new Date(now.setMonth(now.getMonth() - 1));
      } else if (period === 'Year') {
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      }
      
      allHistory = allHistory.filter(h => new Date(h.assignedDate) >= startDate);
    }
    
    // Filter by status
    if (status && status !== 'All') {
      if (status === 'Assigned') {
        allHistory = allHistory.filter(h => !h.returnDate);
      } else if (status === 'Returned') {
        allHistory = allHistory.filter(h => h.returnDate);
      }
    }
    
    // Sort by date
    allHistory.sort((a, b) => new Date(b.assignedDate) - new Date(a.assignedDate));
    
    res.json({ history: allHistory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
