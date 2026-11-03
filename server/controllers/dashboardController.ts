import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getDashboardSummary(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { query } = await getDb();

    // =========================================================
    // 1. Projects
    // =========================================================
    const [projectsCount] = await query(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(plan_amount), 0) AS total_amount
      FROM projects
    `);

    // =========================================================
    // 2. Project Requests
    // =========================================================
    const [requestsCount] = await query(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(approved_amount), 0) AS total_approved_amount
      FROM project_requests
    `);

    // =========================================================
    // 3. Bidding
    // =========================================================
    const [biddingCount] = await query(`
      SELECT
        COUNT(*) AS count
      FROM bidding_process
    `);

    // =========================================================
    // 4. Contracts
    // =========================================================
    const [contractsCount] = await query(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(contract_amount), 0) AS total_contracts_amount
      FROM contracts
    `);

    // =========================================================
    // 5. Active Projects
    // =========================================================
    const [activeContracts] = await query(`
      SELECT
        COUNT(*) AS count
      FROM contracts
      WHERE status = 'កំពុងអនុវត្ត'
         OR status = 'Active'
    `);

    // =========================================================
    // 6. Handovers
    // =========================================================
    const [handoversCount] = await query(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(handover_amount), 0) AS total_handovers_amount
      FROM handovers
    `);

    // =========================================================
    // 7. Warranties
    // =========================================================
    const [warrantiesCount] = await query(`
      SELECT
        COUNT(*) AS count
      FROM warranties
    `);

    // =========================================================
    // Warranty Status Breakdown
    // =========================================================

    // Active warranty: more than 30 days remaining
    const [activeWarranties] = await query(`
      SELECT
        COUNT(*) AS count
      FROM warranties
      WHERE expired_date >= CURDATE()
        AND DATEDIFF(expired_date, CURDATE()) > 30
    `);

    // Expiring soon: 1 - 30 days remaining
    const [expiringWarranties] = await query(`
      SELECT
        COUNT(*) AS count
      FROM warranties
      WHERE expired_date >= CURDATE()
        AND DATEDIFF(expired_date, CURDATE()) <= 30
    `);

    // Expired warranty
    const [expiredWarranties] = await query(`
      SELECT
        COUNT(*) AS count
      FROM warranties
      WHERE expired_date < CURDATE()
    `);

    // =========================================================
    // Response
    // =========================================================

    return res.json({
      success: true,
      data: {
        // Projects
        total_projects: Number(projectsCount?.count || 0),
        total_plan_amount: Number(projectsCount?.total_amount || 0),

        // Requests
        total_requests: Number(requestsCount?.count || 0),
        total_approved_amount: Number(
          requestsCount?.total_approved_amount || 0
        ),

        // Bidding
        total_bidding: Number(biddingCount?.count || 0),

        // Contracts
        total_contracts: Number(contractsCount?.count || 0),
        total_contracts_amount: Number(
          contractsCount?.total_contracts_amount || 0
        ),

        // Active projects
        active_projects: Number(activeContracts?.count || 0),

        // Handovers
        total_handovers: Number(handoversCount?.count || 0),
        total_handovers_amount: Number(
          handoversCount?.total_handovers_amount || 0
        ),

        // Warranties
        total_warranties: Number(warrantiesCount?.count || 0),
        active_warranties: Number(activeWarranties?.count || 0),
        expiring_soon_warranties: Number(
          expiringWarranties?.count || 0
        ),
        expired_warranties: Number(expiredWarranties?.count || 0),
      },
    });
  } catch (err: any) {
    console.error('Dashboard summary error:', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load dashboard summary',
    });
  }
}


// =============================================================
// Dashboard Charts
// =============================================================

export async function getDashboardCharts(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { query } = await getDb();

    // =========================================================
    // 1. Projects and Amount by Fiscal Year
    // =========================================================

    const byFiscalYear = await query(`
      SELECT
        CAST(fiscal_year AS CHAR) AS year,
        COUNT(*) AS count,
        COALESCE(SUM(plan_amount), 0) AS totalAmount
      FROM projects
      GROUP BY fiscal_year
      ORDER BY fiscal_year ASC
    `);

    // =========================================================
    // 2. Projects by Procurement Type
    // =========================================================

    const byProcurementTypeRows = await query(`
      SELECT
        procurement_type AS name,
        COUNT(*) AS value
      FROM projects
      GROUP BY procurement_type
      ORDER BY value DESC
    `);

    // =========================================================
    // 3. Project / Contract Status Breakdown
    // =========================================================

    const byStatusRows = await query(`
      SELECT
        status AS name,
        COUNT(*) AS value
      FROM contracts
      GROUP BY status
      ORDER BY value DESC
    `);

    // =========================================================
    // 4. Warranty Breakdown
    // =========================================================

    const [activeW] = await query(`
      SELECT
        COUNT(*) AS val
      FROM warranties
      WHERE expired_date >= CURDATE()
        AND DATEDIFF(expired_date, CURDATE()) > 30
    `);

    const [soonW] = await query(`
      SELECT
        COUNT(*) AS val
      FROM warranties
      WHERE expired_date >= CURDATE()
        AND DATEDIFF(expired_date, CURDATE()) <= 30
    `);

    const [expW] = await query(`
      SELECT
        COUNT(*) AS val
      FROM warranties
      WHERE expired_date < CURDATE()
    `);

    const byWarranty = [
      {
        name: 'កំពុងធានា',
        value: Number(activeW?.val || 0),
      },
      {
        name: 'ជិតផុតកំណត់',
        value: Number(soonW?.val || 0),
      },
      {
        name: 'ផុតកំណត់',
        value: Number(expW?.val || 0),
      },
    ];

    // =========================================================
    // Response
    // =========================================================

    return res.json({
      success: true,
      data: {
        byFiscalYear,
        byProcurementType: byProcurementTypeRows,
        byStatus: byStatusRows,
        byWarranty,
      },
    });
  } catch (err: any) {
    console.error('Dashboard charts error:', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to load dashboard charts',
    });
  }
}


// =============================================================
// Recent Activities + Alerts
// =============================================================

export async function getDashboardRecentActivities(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { query } = await getDb();

    // =========================================================
    // Recent Activities
    // =========================================================

    const recent = await query(`
      SELECT
        a.*,
        u.username,
        u.full_name
      FROM audit_logs a
      LEFT JOIN users u
        ON u.user_id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 8
    `);

    // =========================================================
    // Contract Alerts
    // =========================================================

    const contracts = await query(`
      SELECT
        c.*,
        p.title AS project_title,
        DATEDIFF(c.end_date, CURDATE()) AS diff
      FROM contracts c
      LEFT JOIN projects p
        ON p.project_id = c.project_id
      WHERE c.status != 'បានបញ្ចប់'
        AND c.end_date IS NOT NULL
    `);

    // =========================================================
    // Bidding Alerts
    // =========================================================

    const biddings = await query(`
      SELECT
        b.*,
        p.title AS project_title,
        DATEDIFF(b.valid_until, CURDATE()) AS diff
      FROM bidding_process b
      LEFT JOIN projects p
        ON p.project_id = b.project_id
      WHERE b.valid_until IS NOT NULL
        AND b.valid_until < CURDATE()
    `);

    // =========================================================
    // Warranty Alerts
    // =========================================================

    const warranties = await query(`
      SELECT
        w.*,
        p.title AS project_title,
        DATEDIFF(w.expired_date, CURDATE()) AS diff
      FROM warranties w
      LEFT JOIN projects p
        ON p.project_id = w.project_id
      WHERE w.expired_date IS NOT NULL
        AND DATEDIFF(w.expired_date, CURDATE()) BETWEEN 1 AND 60
    `);

    // =========================================================
    // Build Alerts
    // =========================================================

    const alerts: any[] = [];

    // ---------------------------------------------------------
    // Contract Alerts
    // ---------------------------------------------------------

    contracts.forEach((c: any) => {
      if (c.diff < 0) {
        alerts.push({
          type: 'danger',
          title: `កិច្ចសន្យាផុតកំណត់ (${c.project_id})`,
          message: `${
            c.project_title || c.project_id
          } - កិច្ចសន្យាហួសកាលកំណត់ ${Math.abs(c.diff)} ថ្ងៃ`,
          date: c.end_date,
        });
      } else if (c.diff <= 30) {
        alerts.push({
          type: 'warning',
          title: `កិច្ចសន្យាជិតផុតកំណត់ (${c.project_id})`,
          message: `${
            c.project_title || c.project_id
          } - សល់សុពលភាពត្រឹម ${c.diff} ថ្ងៃទៀត`,
          date: c.end_date,
        });
      }
    });

    // ---------------------------------------------------------
    // Bidding Alerts
    // ---------------------------------------------------------

    biddings.forEach((b: any) => {
      alerts.push({
        type: 'warning',
        title: `សុពលភាពដេញថ្លៃផុតកំណត់ (${b.project_id})`,
        message: `ដំណើរការដេញថ្លៃគម្រោង ${b.project_id} បានផុតសុពលភាព`,
        date: b.valid_until,
      });
    });

    // ---------------------------------------------------------
    // Warranty Alerts
    // ---------------------------------------------------------

    warranties.forEach((w: any) => {
      alerts.push({
        type: 'info',
        title: `ការធានាជិតផុតកំណត់ (${w.project_id})`,
        message: `រយៈពេលធានាសល់ ${w.diff} ថ្ងៃទៀត (${w.expired_date})`,
        date: w.expired_date,
      });
    });

    // =========================================================
    // Response
    // =========================================================

    return res.json({
      success: true,
      data: {
        recentActivities: recent,
        alerts,
      },
    });
  } catch (err: any) {
    console.error('Dashboard recent activities error:', err);

    return res.status(500).json({
      success: false,
      message:
        err.message || 'Failed to load dashboard activities',
    });
  }
}