import mongoose from "mongoose";

const assetHistorySchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  employeeName: String,
  assignedDate: Date,
  returnDate: Date,
  conditionOnreturn: String,
  remarks: String,
});

const employeeAssetSchema = new mongoose.Schema(
  {
    assetName: { type: String, required: true },
    assetType: { 
      type: String, 
      enum: ["Electronics", "Vehicle", "Tools", "Stationery", "Sim Card", "Uniform", "Other"],
      required: true 
    },
    uniqueId: { type: String, unique: true, required: true }, // Serial No / Tag ID
    modelNumber: String,
    value: Number,
    purchaseDate: Date,
    condition: { 
        type: String, 
        enum: ["New", "Good", "Fair", "Damaged", "Under Repair"], 
        default: "New" 
    },
    status: {
      type: String,
      enum: ["Available", "Assigned", "Lost", "Scrapped", "Under Repair"],
      default: "Available",
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    assignedDate: Date,
    assignmentHistory: [assetHistorySchema],
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.model("EmployeeAsset", employeeAssetSchema);
