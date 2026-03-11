import ServiceRequest from "../models/ServiceRequest.js";
import UserNotification from "../models/UserNotification.js";
import UserAmc from "../models/UserAmc.js";
import { v2 as cloudinary } from "cloudinary";

export const getAllServiceRequests = async (req, res) => {
  try {
    const requests = await ServiceRequest.find()
      .populate('userId', 'firstName lastName email phone addresses')
      .populate('amcId', 'amcPlanName productName')
      .select('ticketId customerName customerPhone customerEmail type description priority status date assignedTechnician address userId amcId')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.json(requests.map(req => ({
      ticketId: req.ticketId,
      complaintId: req.ticketId,
      customerName: req.customerName,
      customerPhone: req.customerPhone,
      customerMobile: req.customerPhone,
      customerEmail: req.customerEmail,
      type: req.type,
      description: req.description,
      priority: req.priority,
      status: req.status,
      date: req.date,
      assignedTechnician: req.assignedTechnician,
      address: req.address,
      userId: req.userId,
      amcId: req.amcId,
      _id: req._id
    })));
  } catch (err) {
    console.error("getAllServiceRequests error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateServiceRequest = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, resolutionNotes, assignedTechnician, priority, completionPhoto } = req.body;

    const request = await ServiceRequest.findOne({ ticketId })
      .populate('userId')
      .populate('amcId');

    if (!request) {
      return res.status(404).json({ message: "Service request not found" });
    }

    const oldStatus = request.status;

    if (status) request.status = status;
    if (resolutionNotes !== undefined) request.resolutionNotes = resolutionNotes;
    if (assignedTechnician !== undefined) request.assignedTechnician = assignedTechnician;
    if (priority) request.priority = priority;

    if (completionPhoto) {
      try {
        const uploadResult = await cloudinary.uploader.upload(completionPhoto, {
          folder: 'service-completions',
          resource_type: 'image'
        });
        request.completionPhoto = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error('Photo upload failed:', uploadErr);
      }
    }

    // Update AMC when job is completed (only once)
    if (status === "Resolved" && oldStatus !== "Resolved" && request.amcId) {
      try {
        console.log('Updating AMC:', request.amcId);
        const amc = await UserAmc.findById(request.amcId);
        if (amc) {
          console.log('AMC found. Current servicesUsed:', amc.servicesUsed, 'Total:', amc.servicesTotal);
          if (amc.servicesUsed < amc.servicesTotal) {
            amc.servicesUsed += 1;
            amc.serviceHistory.push({
              date: new Date(),
              type: 'Regular Service',
              technicianName: assignedTechnician || request.assignedTechnician,
              notes: `Completed: ${request.type}`,
              complaintId: ticketId
            });
            await amc.save();
            console.log('AMC updated successfully. New servicesUsed:', amc.servicesUsed);
          } else {
            console.log('All services already used');
          }
        } else {
          console.log('AMC not found');
        }
      } catch (amcErr) {
        console.error('AMC update failed:', amcErr);
      }
    }

    await request.save();

    try {
      if (request.userId) {
        let title = "Update on your service request";
        let message = `Your request ${ticketId} status is now ${status || 'updated'}.`;

        if (assignedTechnician) {
          title = "Technician Assigned";
          message = `Technician ${assignedTechnician} has been assigned to your request ${ticketId}.`;
        } else if (status === "Resolved") {
          title = "Request Resolved";
          message = `Your service request ${ticketId} has been marked as resolved.`;
        }

        await UserNotification.create({
          userId: request.userId._id,
          title,
          message,
          type: "Service",
          refId: ticketId
        });
      }
    } catch (notifErr) {
      console.error("Failed to create user notification:", notifErr);
    }

    res.json({ message: "Service request updated successfully", request });
  } catch (err) {
    console.error("updateServiceRequest error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteServiceRequest = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const request = await ServiceRequest.findOneAndDelete({ ticketId });
    if (!request) {
      return res.status(404).json({ message: "Service request not found" });
    }

    res.json({ message: "Service request deleted successfully" });
  } catch (err) {
    console.error("deleteServiceRequest error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
