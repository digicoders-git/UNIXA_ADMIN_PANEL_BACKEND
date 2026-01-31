// controllers/userController.js
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

const signJwt = (user) =>
  jwt.sign(
    { sub: String(user._id), email: user.email, tv: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

// Register User
export const registerUser = async (req, res) => {
  try {
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

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ 
      firstName, 
      lastName, 
      email, 
      phone, 
      password: hash,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender
    });

    const token = signJwt(user);

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
    console.error("registerUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email, isActive: true }).select("+password +tokenVersion");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = signJwt(user);

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
    console.error("loginUser error:", err);
    res.status(500).json({ message: "Server error" });
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