import Brand from '../models/Brand.js';

export const listBrands = async (req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json({ brands });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createBrand = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Brand name is required' });
    const brand = await Brand.create({ name: name.trim(), isActive: isActive !== false });
    res.status(201).json({ message: 'Brand created', brand });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Brand already exists' });
    res.status(500).json({ message: err.message });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json({ message: 'Brand updated', brand });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Brand already exists' });
    res.status(500).json({ message: err.message });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json({ message: 'Brand deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
