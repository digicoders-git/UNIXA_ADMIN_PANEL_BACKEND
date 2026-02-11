// models/UserAmc.js
import mongoose from "mongoose";

const userAmcSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true 
    },
    
    orderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Order", 
      required: true 
    },
    
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true,
      refPath: 'productType'
    },
    
    productType: { 
      type: String, 
      required: true, 
      enum: ['Product', 'RoPart', 'RentalPlan'],
      default: 'Product'
    },
    
    productName: { type: String, required: true },
    productImage: { type: String },
    
    amcPlanId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "AmcPlan", 
      required: true 
    },
    
    amcPlanName: { type: String, required: true },
    amcPlanPrice: { type: Number, required: true },
    durationMonths: { type: Number, required: true, default: 12 },
    
    // Dates
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true },
    
    // Service tracking
    servicesTotal: { type: Number, default: 4 },
    servicesUsed: { type: Number, default: 0 },
    partsIncluded: { type: Boolean, default: false },
    
    // Status
    status: { 
      type: String, 
      enum: ["Active", "Expired", "Cancelled", "On Hold"], 
      default: "Active",
      index: true
    },
    
    // Payment
    paymentStatus: { 
      type: String, 
      enum: ["Paid", "Partial", "Pending"], 
      default: "Paid" 
    },
    amountPaid: { type: Number, default: 0 },
    
    // Additional info
    assignedTechnician: { type: String },
    notes: { type: String },
    
    // Service history for this AMC
    serviceHistory: [{
      date: { type: Date, default: Date.now },
      type: { 
        type: String, 
        enum: ["Installation", "Regular Service", "Repair", "Filter Change", "Other"],
        default: "Regular Service"
      },
      technicianName: { type: String },
      notes: { type: String },
      complaintId: { type: String }, // Linked to Customer.complaints
      nextDueDate: { type: Date }
    }]
  },
  { timestamps: true }
);

// Index for efficient queries
userAmcSchema.index({ userId: 1, status: 1 });
userAmcSchema.index({ endDate: 1 });

// Virtual for days remaining
userAmcSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'Active') return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual for isExpired
userAmcSchema.virtual('isExpired').get(function() {
  return new Date() > new Date(this.endDate);
});

// Pre-save hook to auto-update status based on endDate
userAmcSchema.pre('save', function(next) {
  if (this.isExpired && this.status === 'Active') {
    this.status = 'Expired';
  }
  next();
});

// Method to add service visit
userAmcSchema.methods.addServiceVisit = function(serviceData) {
  this.serviceHistory.push(serviceData);
  this.servicesUsed += 1;
  return this.save();
};

// Static method to get active AMCs for a user
userAmcSchema.statics.getActiveAmcs = function(userId) {
  return this.find({ userId, status: 'Active' })
    .populate('amcPlanId')
    .populate('productId')
    .sort({ endDate: 1 });
};

// Static method to check and update expired AMCs
userAmcSchema.statics.updateExpiredAmcs = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { endDate: { $lt: now }, status: 'Active' },
    { $set: { status: 'Expired' } }
  );
  return result;
};

export default mongoose.model("UserAmc", userAmcSchema);
