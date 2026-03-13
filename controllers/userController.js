// controllers/userController.js
import "dotenv/config";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signJwt = (user) => {
  const secret = process.env.JWT_SECRET || "fallback_secret";
  return jwt.sign(
    { sub: String(user._id), email: user.email, phone: user.phone, tv: user.tokenVersion || 0 },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// Generate OTP
const generateOTP = () => {
  return "123456"; // Fixed OTP for development
};

// Send OTP (Mock function - replace with real SMS/Email service)
const sendOTP = async (identifier, otp) => {
  console.log(`Sending OTP ${otp} to ${identifier}`);
  // TODO: Integrate with SMS/Email service
  return true;
};

// Register User
export const registerUser = async (req, res) => {
  try {
    console.log("Registering user:", req.body.phone);
    const { firstName, lastName, email, phone, gender, address, city, state, pincode } = req.body;
    
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ message: "First name, last name and phone are required" });
    }

    // Check phone exists
    const phoneExists = await User.findOne({ phone }).lean();
    if (phoneExists) {
      console.log("Phone already exists:", phone, "Found:", phoneExists.phone);
      return res.status(409).json({ message: "User already exists with this phone number" });
    }

    // Check email exists if provided (case-insensitive)
    if (email) {
      const emailExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).lean();
      if (emailExists) {
        console.log("Email already exists:", email, "Found:", emailExists.email);
        return res.status(409).json({ message: "User already exists with this email" });
      }
    }

    console.log("No existing user found. Proceeding with registration...");
    
    console.log("Creating user document...");
    const user = await User.create({ 
      firstName, 
      lastName, 
      email: email || undefined,
      phone, 
      gender: gender ? gender.toLowerCase() : undefined,
      address,
      city,
      state,
      pincode,
      isActive: true,
      tokenVersion: 0
    });

    console.log("Signing JWT...");
    const token = signJwt(user);

    console.log("User registered successfully:", user.phone);
    res.status(201).json({
      message: "Registration successful",
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email, 
        phone: user.phone,
        gender: user.gender,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode
      },
      token
    });
  } catch (err) {
    console.error("CRITICAL registerUser error:", err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ 
      message: "Server error during registration", 
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined 
    });
  }
};

// Send OTP for Login
export const sendLoginOTP = async (req, res) => {
  try {
    const { identifier } = req.body; // phone or email
    
    if (!identifier) {
      return res.status(400).json({ message: "Phone number or email is required" });
    }

    // Check if identifier is email or phone
    const isEmail = /\S+@\S+\.\S+/.test(identifier);
    const isPhone = /^[6-9]\d{9}$/.test(identifier);
    
    if (!isEmail && !isPhone) {
      return res.status(400).json({ message: "Please enter a valid phone number or email" });
    }

    // Find user by phone or email
    let user;
    if (isEmail) {
      user = await User.findOne({ email: { $regex: new RegExp(`^${identifier}$`, 'i') } });
    } else {
      user = await User.findOne({ phone: identifier });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is inactive" });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to user
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP
    await sendOTP(identifier, otp);

    console.log(`Fixed OTP sent to ${identifier}: 123456`);
    res.json({ 
      message: "OTP sent successfully",
      identifier: identifier,
      otp: "123456" // Show OTP in response for development
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Verify OTP and Login
export const verifyOTPAndLogin = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    
    if (!identifier || !otp) {
      return res.status(400).json({ message: "Phone/email and OTP are required" });
    }

    // Find user by phone or email
    const isEmail = /\S+@\S+\.\S+/.test(identifier);
    let user;
    
    if (isEmail) {
      user = await User.findOne({ email: { $regex: new RegExp(`^${identifier}$`, 'i') } }).select("+otp +otpExpiry");
    } else {
      user = await User.findOne({ phone: identifier }).select("+otp +otpExpiry");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ message: "No OTP found. Please request a new OTP." });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = signJwt(user);

    console.log(`Login successful for: ${identifier}`);
    res.json({
      message: "Login successful",
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        address: user.address,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        lastLogin: user.lastLogin
      },
      token
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get Profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("getProfile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, gender, address, city, state, pincode, preferences, profilePicture } = req.body;
    const user = await User.findById(req.user.sub);
    
    if (!user) return res.status(404).json({ message: "User not found" });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) {
      // Check if phone already exists for another user
      const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } }).lean();
      if (phoneExists) {
        return res.status(409).json({ message: "Phone number already exists" });
      }
      user.phone = phone;
    }
    if (gender) user.gender = gender;
    if (address) user.address = address;
    if (city) user.city = city;
    if (state) user.state = state;
    if (pincode) user.pincode = pincode;
    if (profilePicture) user.profilePicture = profilePicture;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();
    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// Get All Addresses
export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ addresses: user.addresses });
  } catch (err) {
    console.error("getAddresses error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add Address
export const addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine1, addressLine2, city, state, pincode, addressType, isDefault } = req.body;
    
    if (!name || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ message: "Required address fields missing" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({ 
      name, 
      phone, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      pincode, 
      addressType: addressType || "home",
      isDefault 
    });
    await user.save();

    res.json({ message: "Address added", addresses: user.addresses });
  } catch (err) {
    console.error("addAddress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Address
export const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = user.addresses.id(addressId);
    if (!address) return res.status(404).json({ message: "Address not found" });

    if (updates.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(address, updates);
    await user.save();

    res.json({ message: "Address updated", addresses: user.addresses });
  } catch (err) {
    console.error("updateAddress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Address
export const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const user = await User.findById(req.user.sub);
    
    if (!user) return res.status(404).json({ message: "User not found" });

    user.addresses.pull(addressId);
    await user.save();

    res.json({ message: "Address deleted", addresses: user.addresses });
  } catch (err) {
    console.error("deleteAddress error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload Profile Picture
export const uploadUserProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user with new profile picture URL
    user.profilePicture = req.file.path;
    await user.save();

    res.json({
      message: "Profile picture updated successfully",
      profilePicture: req.file.path
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({ message: "Error uploading profile picture", error: error.message });
  }
};

// Admin: Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};