import mongoose from "mongoose";

const rentalDetailsSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalPlan" },
  planName: String,
  startDate: Date,
  endDate: Date,
  nextDueDate: Date,
  amount: Number,
  status: { type: String, enum: ["Active", "Inactive", "Pending", "Cancelled"], default: "Inactive" },
  paymentStatus: { type: String, enum: ["Paid", "Due", "Overdue"], default: "Paid" },
  machineModel: String,
  machineImage: String
});

const waterPurifierSchema = new mongoose.Schema({
  brand: String,
  model: String,
  type: {
    type: String,
    enum: ["RO", "UV", "UF", "RO+UV", "Other"],
    default: "RO",
  },
  installationDate: Date,
  warrantyStatus: {
    type: String,
    enum: ["Active", "Expired"],
    default: "Active",
  },
  amcStatus: {
    type: String,
    enum: ["Active", "Expired", "Not Taken"],
    default: "Not Taken",
  },
});

const serviceHistorySchema = new mongoose.Schema({
  date: Date,
  nextDueDate: Date,
  type: {
    type: String,
    enum: ["Installation", "Repair", "Regular Service", "Filter Change", "Other"],
  },
  technicianName: String,
  notes: String,
});

const complaintSchema = new mongoose.Schema({
  complaintId: String,
  type: {
    type: String,
    enum: ["No Water", "Bad Taste", "Leakage", "Noise", "Other", "General Maintenance", "Filter Replacement", "Water Quality Test", "Repair / Leakage", "AMC Inquiry", "Service Request", "Filter Change", "Installation", "Other Issue"],
  },
  description: String,
  date: { type: Date, default: Date.now },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved"],
    default: "Open",
  },
  assignedTechnician: String,
  resolutionNotes: String,
});

const amcDetailsSchema = new mongoose.Schema({
  amcId: { type: String, default: () => `AMC-${Date.now()}` },
  planName: String, // Display Name
  planType: { type: String, enum: ["Silver", "Gold", "Platinum", "Custom"], default: "Silver" },
  startDate: Date,
  endDate: Date,
  durationMonths: Number,
  servicesTotal: { type: Number, default: 3 },
  servicesUsed: { type: Number, default: 0 },
  partsIncluded: { type: Boolean, default: false },
  amount: Number,
  amountPaid: { type: Number, default: 0 },
  paymentMode: { type: String, enum: ["Cash", "UPI", "Card", "Transfer", "Other"] },
  paymentStatus: { type: String, enum: ["Paid", "Partial", "Pending"], default: "Pending" },
  status: { type: String, enum: ["Active", "Expired", "On Hold", "Cancelled"], default: "Active" },
  assignedTechnician: String,
  notes: String,
});

const partsHistorySchema = new mongoose.Schema({
  filterName: String,
  brand: String,
  replacementDate: Date,
  nextReplacementDue: Date,
  cost: Number,
});

const reminderSchema = new mongoose.Schema({
  date: Date,
  type: {
    type: String,
    enum: ["Service", "Payment", "AMC Renewal", "Other"],
  },
  remarks: String,
});

const customerSchema = new mongoose.Schema(
  {
    customerId: { type: String, unique: true }, // Auto-generated
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: String,
    address: {
      house: String,
      area: String,
      city: String,
      pincode: String,
      landmark: String,
    },
    type: {
      type: String,
      enum: ["New", "Existing", "AMC Customer"],
      default: "New",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Blacklisted"],
      default: "Active",
    },
    rating: { type: Number, min: 0, max: 5 },
    purifiers: [waterPurifierSchema],
    serviceHistory: [serviceHistorySchema],
    complaints: [complaintSchema],
    amcDetails: amcDetailsSchema,
    rentalDetails: rentalDetailsSchema,
    amcHistory: [amcDetailsSchema], // Archive of previous AMCs
    partsHistory: [partsHistorySchema],
    reminders: [reminderSchema],
  },
  { timestamps: true }
);

// Pre-save hook to generate Customer ID if not present
customerSchema.pre("save", async function (next) {
  if (!this.customerId) {
    // Generate a simple ID logic, e.g., CUST-timestamp-random
    const datePart = new Date().getFullYear().toString().substr(-2);
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.customerId = `CUST${datePart}${randomPart}`;
  }
  next();
});

export default mongoose.model("Customer", customerSchema);
