import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    productInterest: { type: String, default: "" },
    selectedItem: { type: mongoose.Schema.Types.ObjectId, default: null },
    leadStatus: { type: String, enum: ["Hot", "Warm", "Cold"], default: "Warm" },
    notes: { type: String, default: "" },
    followUpDate: { type: Date },
    source: { type: String, default: "Field Visit" },
    createdBy: { type: String, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    status: { type: String, enum: ["Pending", "Completed"], default: "Pending" },
    verified: { type: Boolean, default: false },
    serviceSchedule: {
      scheduledDate: { type: Date, default: null },
      scheduleStatus: { type: String, enum: ["Upcoming", "Completed", "Cancelled"], default: "Upcoming" },
      scheduleNote: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

leadSchema.methods.isAssigned = function() {
  return this.assignedTo !== null && this.assignedTo !== undefined;
};

export default mongoose.model("Lead", leadSchema);
