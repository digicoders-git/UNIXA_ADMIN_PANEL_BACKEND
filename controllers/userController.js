// controllers/userController.js
import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";

const signJwt = (user) => {
  const secret = process.env.JWT_SECRET || "fallback_secret";
  return jwt.sign(
    { sub: String(user._id), email: user.email, tv: user.tokenVersion || 0 },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

// Register User
export const registerUser = async (req, res) => {
  try {
    console.log("Registering user:", req.body.email);
    const { firstName, lastName, email, phone, password, dateOfBirth, gender } = req.body;
    
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ message: "First name, last name, email, phone and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check email exists
    const emailExists = await User.findOne({ email }).lean();
    if (emailExists) {
      return res.status(409).json({ message: "User already exists with this email" });
    }

    // Check phone exists
    const phoneExists = await User.findOne({ phone }).lean();
    if (phoneExists) {
      return res.status(409).json({ message: "User already exists with this phone number" });
    }

    console.log("Hashing password...");
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    console.log("Creating user document...");
    const user = await User.create({ 
      firstName, 
      lastName, 
      email, 
      phone, 
      password: hash,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender ? gender.toLowerCase() : undefined,
      isActive: true,
      tokenVersion: 0
    });

    console.log("Signing JWT...");
    const token = signJwt(user);

    console.log("User registered successfully:", user.email);
    res.status(201).json({
      message: "Registration successful",
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email, 
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender
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

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", email);
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Attempt to find user (older users might not have isActive: true set explicitly)
    const user = await User.findOne({ email }).select("+password +tokenVersion");
    
    if (!user) {
      console.log("Login failed: User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      console.log("Login failed: User inactive");
      return res.status(401).json({ message: "Account is inactive" });
    }

    console.log("Comparing password...");
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.log("Login failed: Password mismatch");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    console.log("Signing JWT...");
    const token = signJwt(user);

    console.log("Login successful:", email);
    res.json({
      message: "Login successful",
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email, 
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        lastLogin: user.lastLogin
      },
      token
    });
  } catch (err) {
    console.error("CRITICAL loginUser error:", err);
    res.status(500).json({ 
      message: "Server error during login",
      error: err.message 
    });
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
    const { firstName, lastName, phone, dateOfBirth, gender, preferences, profilePicture } = req.body;
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
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.gender = gender;
    if (profilePicture) user.profilePicture = profilePicture;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();
    res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Change Password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.sub).select("+password");
    
    if (!user) return res.status(404).json({ message: "User not found" });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Invalidate old tokens by incrementing version
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
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