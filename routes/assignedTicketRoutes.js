import express from 'express';
import { createTicket, getAllTickets, getTicketsByEmployee, updateTicket, completeTicket, deleteTicket } from '../controllers/assignedTicketController.js';

const router = express.Router();

router.post('/', createTicket);
router.get('/', getAllTickets);
router.get('/employee/:employeeName', getTicketsByEmployee);
router.put('/:id', updateTicket);
router.put('/:id/complete', completeTicket);
router.delete('/:id', deleteTicket);

export default router;
