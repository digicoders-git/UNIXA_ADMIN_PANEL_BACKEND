import express from 'express';
import { listBrands, createBrand, updateBrand, deleteBrand } from '../controllers/brandController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listBrands);
router.post('/', requireAuth, createBrand);
router.put('/:id', requireAuth, updateBrand);
router.delete('/:id', requireAuth, deleteBrand);

export default router;
