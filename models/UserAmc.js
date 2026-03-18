// models/UserAmc.js
import mongoose from "mongoose";

const userAmcSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      index: true 
    },
    
    orderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Order"
    },

    // For offline/unregistered customers - store phone for lookup
    customerPhone: { type: String, index: true },

    amcId: { type: String }, // Reference identity for the AMC
    
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
    
    // Service schedule
    serviceSchedule: {
      intervalMonths: { type: Number, default: 4 },
      serviceType: { 
        type: String, 
        enum: ["Installation", "Regular Service", "Repair", "Filter Change", "Other"],
        default: "Regular Service"
      },
      description: { type: String, default: "Scheduled maintenance service" }
    },
    
    // Next service due date
    nextServiceDueDate: { type: Date },
    
    // Status
    status: { 
      type: String, 
      enum: ["Active", "Expired", "Cancelled", "On Hold", "Renewed"], 
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
        enum: ["Installation", "Regular Service", "Repair", "Filter Change", "Other", "AMC Service"],
        default: "Regular Service"
      },
      technicianName: { type: String },
      notes: { type: String },
      complaintId: { type: String }, // Linked to Customer.complaints
      nextDueDate: { type: Date }
    }],
    
    // 4-month reminder tracking
    reminderSent: { type: Boolean, default: false, index: true },
    
    // Reminder history
    reminderHistory: [{
      reminderNumber: { type: Number },
      reminderDate: { type: Date, default: Date.now },
      ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignedTicket' },
      assignedTo: { type: String },
      assignedByRole: { type: String, enum: ['Admin', 'Manager'] },
      employeeFeedback: { type: String },
      visitPhotos: [{ type: String }],
      customerFeedback: { type: String },
      completedAt: { type: Date },
      status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' }
    }]
  },
  { timestamps: true }
);

// Index for efficient queries
userAmcSchema.index({ userId: 1, status: 1 });
userAmcSchema.index({ endDate: 1 });
userAmcSchema.index({ nextServiceDueDate: 1 });

// Virtual for days remaining
userAmcSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'Active') return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual for days until next service
userAmcSchema.virtual('daysUntilNextService').get(function() {
  if (!this.nextServiceDueDate) return null;
  const now = new Date();
  const dueDate = new Date(this.nextServiceDueDate);
  const diff = dueDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for isExpired
userAmcSchema.virtual('isExpired').get(function() {
  const dateExpired = new Date() > new Date(this.endDate);
  const servicesExhausted = this.servicesUsed >= this.servicesTotal;
  return dateExpired || servicesExhausted;
});

// Pre-save hook to auto-update status based on endDate or services used
userAmcSchema.pre('save', function(next) {
  // Only auto-expire if currently Active and conditions are met
  if (this.status === 'Active' && this.isExpired) {
    this.status = 'Expired';
  }

  // Initialize nextServiceDueDate only if not already set
  if (!this.nextServiceDueDate && this.startDate) {
    const interval = this.serviceSchedule?.intervalMonths || 4;
    const nextDue = new Date(this.startDate);
    nextDue.setMonth(nextDue.getMonth() + interval);
    this.nextServiceDueDate = nextDue;
  }
  
  next();
});

// Method to add service visit
userAmcSchema.methods.addServiceVisit = function(serviceData) {
  this.serviceHistory.push(serviceData);
  this.servicesUsed += 1;
  
  // Calculate next service due date
  if (this.serviceSchedule && this.serviceSchedule.intervalMonths) {
    const nextDue = new Date(serviceData.date);
    nextDue.setMonth(nextDue.getMonth() + this.serviceSchedule.intervalMonths);
    this.nextServiceDueDate = nextDue;
  }
  
  return this.save();
};

// Static method to get active AMCs for a user
userAmcSchema.statics.getActiveAmcs = function(userId) {
  return this.find({ userId, status: 'Active' })
    .populate('amcPlanId')
    .populate('productId')
    .sort({ endDate: 1 });
};

// Static method to get upcoming service jobs (due within 7 days)
userAmcSchema.statics.getUpcomingServiceJobs = function() {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return this.find({
    status: 'Active',
    nextServiceDueDate: { $lte: sevenDaysLater }
  })
    .populate('userId', 'firstName lastName email phone addresses city state')
    .populate('amcPlanId')
    .populate('productId')
    .sort({ nextServiceDueDate: 1 });
};

// Static method to check and update expired AMCs
userAmcSchema.statics.updateExpiredAmcs = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { 
      status: 'Active',
      $or: [
        { endDate: { $lt: now } },
        { $expr: { $gte: ['$servicesUsed', '$servicesTotal'] } }
      ]
    },
    { $set: { status: 'Expired' } }
  );
  return result;
};

export default mongoose.model("UserAmc", userAmcSchema);
