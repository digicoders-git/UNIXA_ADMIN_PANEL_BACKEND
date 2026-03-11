import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Login Employee
export const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the employee
    const employee = await Employee.findOne({ email });

    if (!employee) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 2. Check if active
    if (employee.status === false) {
      return res.status(403).json({ message: "Account is inactive. Please contact admin." });
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4. Generate Token
    const token = jwt.sign(
      {
        id: employee._id,
        role: employee.role,
        email: employee.email,
        name: employee.name
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 5. Send Response
    res.json({
      token,
      user: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        designation: employee.designation,
        phone: employee.phone,
        location: employee.location,
        workingArea: employee.workingArea,
        employeeId: employee.employeeId,
        address: employee.address,
        joiningDate: employee.joiningDate
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all employees
export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find()
      .select('name email phone role designation status employeeId joiningDate createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching employees", error: error.message });
  }
};

// Create new employee
export const createEmployee = async (req, res) => {
  try {
    const { name, email, phone, password, role, designation, address, joiningDate, location, workingArea, employeeId } = req.body;

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({ message: "Employee with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newEmployee = new Employee({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      designation,
      address,
      joiningDate,
      location,
      workingArea,
      employeeId,
    });

    await newEmployee.save();
    res.status(201).json({ message: "Employee created successfully", employee: newEmployee });
  } catch (error) {
    res.status(500).json({ message: "Error creating employee", error: error.message });
  }
};

// Update employee
export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, designation, status, address, joiningDate, password, location, workingArea, employeeId } = req.body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.name = name || employee.name;
    employee.email = email || employee.email;
    employee.phone = phone || employee.phone;
    employee.role = role || employee.role;
    employee.designation = designation || employee.designation;
    if (status !== undefined) employee.status = status;
    employee.address = address || employee.address;
    employee.joiningDate = joiningDate || employee.joiningDate;
    employee.location = location || employee.location;
    employee.workingArea = workingArea || employee.workingArea;
    employee.employeeId = employeeId || employee.employeeId;

    if (password) {
      employee.password = await bcrypt.hash(password, 10);
    }

    await employee.save();
    res.json({ message: "Employee updated successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Error updating employee", error: error.message });
  }
};

// Delete employee
export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting employee", error: error.message });
  }
};

// Get Employee Stats (Dynamic Placeholder)
export const getEmployeeStats = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // TODO: Replace with real aggregation from Task/Attendance models when available
    // For now, generating dynamic but simulated data based on employee ID to ensure consistency

    // Simulate productivity (70-95%)
    const productivity = Math.floor(Math.random() * (95 - 70 + 1)) + 70;

    // Simulate tasks (20-60)
    const tasksCompleted = Math.floor(Math.random() * (60 - 20 + 1)) + 20;

    // Simulate work hours (30-50)
    const workHours = Math.floor(Math.random() * (50 - 30 + 1)) + 30;

    // Simulate last 7 days chart data
    const performanceChart = Array.from({ length: 7 }, () => Math.floor(Math.random() * (100 - 40 + 1)) + 40);

    res.json({
      employeeId: employee._id,
      name: employee.name,
      stats: {
        productivity: productivity,
        tasksCompleted: tasksCompleted,
        workHours: workHours,
        performanceChart: performanceChart
      }
    });

  } catch (error) {
    console.error("Error fetching employee stats:", error);
    res.status(500).json({ message: "Error fetching stats" });
  }
};
