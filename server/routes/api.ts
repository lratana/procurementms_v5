import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, requireEditorOrAdmin } from '../middleware/role.js';

// Controllers
import * as authCtrl from '../controllers/authController.js';
import * as projectCtrl from '../controllers/projectController.js';
import * as requestCtrl from '../controllers/projectRequestController.js';
import * as biddingCtrl from '../controllers/biddingController.js';
import * as bidderCtrl from '../controllers/bidderController.js';
import * as contractCtrl from '../controllers/contractController.js';
import * as handoverCtrl from '../controllers/handoverController.js';
import * as warrantyCtrl from '../controllers/warrantyController.js';
import * as userCtrl from '../controllers/userController.js';
import * as deviceCtrl from '../controllers/deviceController.js';
import * as auditCtrl from '../controllers/auditController.js';
import * as dashboardCtrl from '../controllers/dashboardController.js';
import * as reportCtrl from '../controllers/reportController.js';

import { testConnection, getDbInfo } from '../config/database.js';

const router = Router();

// --- Health Check Endpoint ---
router.get('/health', async (req, res) => {
  try {
    await testConnection();
    const info = getDbInfo();
    return res.json({ status: 'ok', ...info });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      error: err.message || String(err),
    });
  }
});

// --- Auth Routes ---
router.post('/auth/login', authCtrl.login);
router.post('/auth/logout', authenticateToken, authCtrl.logout);
router.get('/auth/me', authenticateToken, authCtrl.me);

// --- Dashboard Routes ---
router.get('/dashboard/summary', authenticateToken, dashboardCtrl.getDashboardSummary);
router.get('/dashboard/charts', authenticateToken, dashboardCtrl.getDashboardCharts);
router.get('/dashboard/recent-activities', authenticateToken, dashboardCtrl.getDashboardRecentActivities);

// --- Projects Routes ---
router.get('/projects', authenticateToken, projectCtrl.getProjects);
router.get('/projects/:id', authenticateToken, projectCtrl.getProjectById);
router.post('/projects', authenticateToken, requireEditorOrAdmin, projectCtrl.createProject);
router.put('/projects/:id', authenticateToken, requireEditorOrAdmin, projectCtrl.updateProject);
router.delete('/projects/:id', authenticateToken, requireAdmin, projectCtrl.deleteProject);

// --- Project Requests Routes ---
router.get('/project-requests', authenticateToken, requestCtrl.getProjectRequests);
router.get('/project-requests/:id', authenticateToken, requestCtrl.getProjectRequestById);
router.post('/project-requests', authenticateToken, requireEditorOrAdmin, requestCtrl.createProjectRequest);
router.put('/project-requests/:id', authenticateToken, requireEditorOrAdmin, requestCtrl.updateProjectRequest);
router.delete('/project-requests/:id', authenticateToken, requireAdmin, requestCtrl.deleteProjectRequest);

// --- Bidding Routes ---
router.get('/bidding', authenticateToken, biddingCtrl.getBiddingProcesses);
router.get('/bidding/:id', authenticateToken, biddingCtrl.getBiddingById);
router.post('/bidding', authenticateToken, requireEditorOrAdmin, biddingCtrl.createBidding);
router.put('/bidding/:id', authenticateToken, requireEditorOrAdmin, biddingCtrl.updateBidding);
router.delete('/bidding/:id', authenticateToken, requireAdmin, biddingCtrl.deleteBidding);

// --- Bidders Routes ---
router.get('/bidders', authenticateToken, bidderCtrl.getBidders);
router.get('/bidders/:id', authenticateToken, bidderCtrl.getBidderById);
router.post('/bidders', authenticateToken, requireEditorOrAdmin, bidderCtrl.createBidder);
router.put('/bidders/:id', authenticateToken, requireEditorOrAdmin, bidderCtrl.updateBidder);
router.delete('/bidders/:id', authenticateToken, requireAdmin, bidderCtrl.deleteBidder);

// --- Contracts Routes ---
router.get('/contracts', authenticateToken, contractCtrl.getContracts);
router.get('/contracts/:id', authenticateToken, contractCtrl.getContractById);
router.post('/contracts', authenticateToken, requireEditorOrAdmin, contractCtrl.createContract);
router.put('/contracts/:id', authenticateToken, requireEditorOrAdmin, contractCtrl.updateContract);
router.delete('/contracts/:id', authenticateToken, requireAdmin, contractCtrl.deleteContract);

// --- Handovers Routes ---
router.get('/handovers', authenticateToken, handoverCtrl.getHandovers);
router.get('/handovers/:id', authenticateToken, handoverCtrl.getHandoverById);
router.post('/handovers', authenticateToken, requireEditorOrAdmin, handoverCtrl.createHandover);
router.put('/handovers/:id', authenticateToken, requireEditorOrAdmin, handoverCtrl.updateHandover);
router.delete('/handovers/:id', authenticateToken, requireAdmin, handoverCtrl.deleteHandover);

// --- Warranties Routes ---
router.get('/warranties', authenticateToken, warrantyCtrl.getWarranties);
router.get('/warranties/:id', authenticateToken, warrantyCtrl.getWarrantyById);
router.post('/warranties', authenticateToken, requireEditorOrAdmin, warrantyCtrl.createWarranty);
router.put('/warranties/:id', authenticateToken, requireEditorOrAdmin, warrantyCtrl.updateWarranty);
router.delete('/warranties/:id', authenticateToken, requireAdmin, warrantyCtrl.deleteWarranty);

// --- Users Routes (Admin only for mutations) ---
router.get('/users', authenticateToken, requireAdmin, userCtrl.getUsers);
router.get('/users/:id', authenticateToken, requireAdmin, userCtrl.getUserById);
router.post('/users', authenticateToken, requireAdmin, userCtrl.createUser);
router.put('/users/:id', authenticateToken, requireAdmin, userCtrl.updateUser);
router.patch('/users/:id/status', authenticateToken, requireAdmin, userCtrl.toggleUserStatus);
router.patch('/users/:id/reset-password', authenticateToken, requireAdmin, userCtrl.resetUserPassword);

// --- Devices Routes ---
router.get('/devices', authenticateToken, requireAdmin, deviceCtrl.getDevices);
router.patch('/devices/:id/status', authenticateToken, requireAdmin, deviceCtrl.toggleDeviceStatus);
router.delete('/devices/:id', authenticateToken, requireAdmin, deviceCtrl.deleteDevice);
router.get('/sessions', authenticateToken, requireAdmin, deviceCtrl.getSessions);

// --- Audit Logs Routes ---
router.get('/audit-logs', authenticateToken, requireAdmin, auditCtrl.getAuditLogs);
router.get('/audit-logs/:id', authenticateToken, requireAdmin, auditCtrl.getAuditLogById);

// --- Reports Routes ---
router.get('/reports/:type', authenticateToken, reportCtrl.getReport);

export default router;
