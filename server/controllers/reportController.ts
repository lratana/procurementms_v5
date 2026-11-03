import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { type } = req.params;
    const { from_date, to_date, fiscal_year, procurement_type } = req.query;
    const { query } = await getDb();

    let data: any[] = [];
    let title = '';
    let summary: Record<string, any> = {};

    switch (type) {
      case 'projects':
      case 'procurement-plan': {
        title = type === 'projects' ? 'របាយការណ៍គម្រោងលទ្ធកម្មទូទៅ' : 'របាយការណ៍ផែនការលទ្ធកម្មប្រចាំឆ្នាំ';

        let whereClauses: string[] = [];
        let params: any[] = [];

        if (fiscal_year) {
          whereClauses.push('p.fiscal_year = ?');
          params.push(fiscal_year);
        }
        if (procurement_type) {
          whereClauses.push('p.procurement_type = ?');
          params.push(procurement_type);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const rows = await query(
          `SELECT p.*,
            COALESCE(c.status, 'រៀបចំផែនការ') as contract_status,
            COALESCE(h.progress_percent, 0) as progress_percent
           FROM projects p
           LEFT JOIN contracts c ON c.project_id = p.project_id
           LEFT JOIN handovers h ON h.project_id = p.project_id
           ${whereSql}
           ORDER BY p.project_id ASC`,
          params
        );

        data = rows.map((p, idx) => ({
          no: idx + 1,
          project_id: p.project_id,
          title: p.title,
          fiscal_year: p.fiscal_year,
          procurement_type: p.procurement_type,
          budget_type: p.budget_type || '-',
          procurement_method: p.procurement_method,
          plan_date: p.plan_date,
          plan_amount: Number(p.plan_amount) || 0,
          status: p.progress_percent === 100 ? 'បានបញ្ចប់' : p.contract_status || 'រៀបចំផែនការ',
          progress: `${p.progress_percent}%`,
        }));

        const totalAmount = data.reduce((acc, row) => acc + row.plan_amount, 0);
        summary = {
          total_items: data.length,
          total_amount: totalAmount,
          average_amount: data.length ? totalAmount / data.length : 0,
        };
        break;
      }

      case 'project-requests': {
        title = 'របាយការណ៍សំណើគម្រោងលទ្ធកម្ម';
        let whereSql = '';
        let params: any[] = [];

        if (fiscal_year) {
          whereSql = 'WHERE r.fiscal_year = ?';
          params.push(fiscal_year);
        }

        const rows = await query(
          `SELECT r.*, p.title as project_title,
            (COALESCE(r.request_amount, 0) - COALESCE(r.approved_amount, 0)) as difference
           FROM project_requests r
           LEFT JOIN projects p ON p.project_id = r.project_id
           ${whereSql}
           ORDER BY r.request_id ASC`,
          params
        );

        data = rows.map((r, idx) => ({
          no: idx + 1,
          project_id: r.project_id,
          project_title: r.project_title || r.project_id,
          request_date: r.request_date,
          fiscal_year: r.fiscal_year,
          request_amount: Number(r.request_amount) || 0,
          approval_date: r.approval_date || '-',
          approved_amount: Number(r.approved_amount) || 0,
          difference: Number(r.difference) || 0,
        }));

        summary = {
          total_items: data.length,
          total_requested: data.reduce((acc, row) => acc + row.request_amount, 0),
          total_approved: data.reduce((acc, row) => acc + row.approved_amount, 0),
        };
        break;
      }

      case 'bidding': {
        title = 'របាយការណ៍ដំណើរការដេញថ្លៃលទ្ធកម្ម';
        const rows = await query(
          `SELECT b.*, p.title as project_title
           FROM bidding_process b
           LEFT JOIN projects p ON p.project_id = b.project_id
           ORDER BY b.bid_process_id ASC`
        );

        data = rows.map((b, idx) => ({
          no: idx + 1,
          project_id: b.project_id,
          project_title: b.project_title || b.project_id,
          prepare_bid: b.prepare_bid || '-',
          moh_approval: b.moh_approval || '-',
          mef_approval: b.mef_approval || '-',
          advertise_date: b.advertise_date || '-',
          bid_opening: b.bid_opening || '-',
          valid_until: b.valid_until || '-',
          status: b.status || 'កំពុងមានសុពលភាព',
        }));

        summary = {
          total_items: data.length,
          active_biddings: data.filter((d) => d.status === 'កំពុងមានសុពលភាព').length,
          expired_biddings: data.filter((d) => d.status === 'ផុតកំណត់').length,
        };
        break;
      }

      case 'bidders': {
        title = 'របាយការណ៍បញ្ជីក្រុមហ៊ុនដេញថ្លៃ';
        const rows = await query('SELECT * FROM bidders ORDER BY bidder_id ASC');
        data = rows.map((b, idx) => ({
          no: idx + 1,
          bidder_id: b.bidder_id,
          company_name: b.company_name,
          company_director: b.company_director || '-',
          phone_number: b.phone_number || '-',
          tax_number: b.tax_identification_number || '-',
          address: b.address || '-',
          status: b.status,
        }));
        summary = {
          total_companies: data.length,
        };
        break;
      }

      case 'contracts': {
        title = 'របាយការណ៍កិច្ចសន្យាលទ្ធកម្ម';
        const rows = await query(
          `SELECT c.*, p.title as project_title
           FROM contracts c
           LEFT JOIN projects p ON p.project_id = c.project_id
           ORDER BY c.contract_id ASC`
        );

        data = rows.map((c, idx) => ({
          no: idx + 1,
          contract_id: c.contract_id,
          project_id: c.project_id,
          project_title: c.project_title || c.project_id,
          contract_amount: Number(c.contract_amount) || 0,
          approval_date: c.approval_date || '-',
          end_date: c.end_date || '-',
          validity_days: c.contract_validity || 0,
          status: c.status || 'កំពុងអនុវត្ត',
          handover: c.handover || '-',
        }));

        summary = {
          total_items: data.length,
          total_amount: data.reduce((acc, row) => acc + row.contract_amount, 0),
          completed: data.filter((d) => d.status === 'បានបញ្ចប់').length,
          in_progress: data.filter((d) => d.status === 'កំពុងអនុវត្ត').length,
        };
        break;
      }

      case 'handovers': {
        title = 'របាយការណ៍ប្រគល់-ទទួលគម្រោង';
        const rows = await query(
          `SELECT h.*, p.title as project_title
           FROM handovers h
           LEFT JOIN projects p ON p.project_id = h.project_id
           ORDER BY h.handover_id ASC`
        );

        data = rows.map((h, idx) => ({
          no: idx + 1,
          handover_id: h.handover_id,
          project_id: h.project_id,
          project_title: h.project_title || h.project_id,
          contract_amount: Number(h.contract_amount) || 0,
          handover_amount: Number(h.handover_amount) || 0,
          stage_1: Number(h.stage_1) || 0,
          stage_2: Number(h.stage_2) || 0,
          stage_3: Number(h.stage_3) || 0,
          stage_4: Number(h.stage_4) || 0,
          progress: `${h.progress_percent}%`,
          status: h.handover_status,
        }));

        summary = {
          total_items: data.length,
          total_handover_value: data.reduce((acc, row) => acc + row.handover_amount, 0),
        };
        break;
      }

      case 'warranties': {
        title = 'របាយការណ៍ការធានាគម្រោង';
        const rows = await query(
          `SELECT w.*, p.title as project_title
           FROM warranties w
           LEFT JOIN projects p ON p.project_id = w.project_id
           ORDER BY w.warranty_id ASC`
        );

        data = rows.map((w, idx) => ({
          no: idx + 1,
          warranty_id: w.warranty_id,
          project_id: w.project_id,
          project_title: w.project_title || w.project_id,
          handover_date: w.handover_date || '-',
          period_days: w.warranty_period_days || 0,
          expired_date: w.expired_date || '-',
          remaining_days: w.warranty_remaining_days || 0,
          status: w.status,
        }));

        summary = {
          total_items: data.length,
          active: data.filter((d) => d.status === 'កំពុងធានា').length,
          expired: data.filter((d) => d.status === 'ផុតកំណត់').length,
        };
        break;
      }

      case 'audit-logs':
      case 'user-activity': {
        title = 'របាយការណ៍ប្រវត្តិសកម្មភាព និងការចូលប្រើប្រាស់';
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (from_date) {
          whereClauses.push('a.created_at >= ?');
          params.push(from_date);
        }
        if (to_date) {
          whereClauses.push('a.created_at <= ?');
          params.push(`${to_date} 23:59:59`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const rows = await query(
          `SELECT a.*, u.username, u.full_name
           FROM audit_logs a
           LEFT JOIN users u ON u.user_id = a.user_id
           ${whereSql}
           ORDER BY a.created_at DESC`,
          params
        );

        data = rows.map((l, idx) => ({
          no: idx + 1,
          date_time: l.created_at,
          user: l.full_name || l.username || 'System',
          action: l.action,
          module: l.module || '-',
          table: l.table_name || '-',
          record_id: l.record_id || '-',
          ip: l.ip_address || '-',
        }));

        summary = {
          total_actions: data.length,
        };
        break;
      }

      case 'procurement-method':
      case 'procurement-methods': {
        title = 'របាយការណ៍សរុបស្តីពីការអនុវត្តកិច្ចលទ្ធកម្មតាមវិធីសាស្ត្រលទ្ធកម្ម';

        let whereClauses: string[] = [];
        let params: any[] = [];

        if (fiscal_year) {
          const yearCheck = await query(
            'SELECT COUNT(*) as cnt FROM projects WHERE fiscal_year = ?',
            [fiscal_year]
          );
          if (Number(yearCheck[0]?.cnt || 0) > 0 || String(fiscal_year) !== '2024') {
            whereClauses.push('p.fiscal_year = ?');
            params.push(fiscal_year);
          }
        }

        if (procurement_type) {
          whereClauses.push('p.procurement_type = ?');
          params.push(procurement_type);
        }

        if (from_date) {
          whereClauses.push('p.plan_date >= ?');
          params.push(from_date);
        }

        if (to_date) {
          whereClauses.push('p.plan_date <= ?');
          params.push(to_date);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const rows = await query(
          `SELECT
             CASE
               WHEN p.procurement_method LIKE '%អន្តរជាតិ%'
                 OR LOWER(p.procurement_method) LIKE '%icb%'
                 OR LOWER(p.procurement_method) LIKE '%international%'
                 THEN 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ'
               WHEN p.procurement_method LIKE '%ក្នុងស្រុក%'
                 OR LOWER(p.procurement_method) LIKE '%ncb%'
                 OR LOWER(p.procurement_method) LIKE '%national%'
                 THEN 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក'
               WHEN p.procurement_method LIKE '%មានកម្រិត%'
                 OR LOWER(p.procurement_method) LIKE '%limited%'
                 OR LOWER(p.procurement_method) LIKE '%qcbs%'
                 OR p.procurement_method LIKE '%គុណភាព%'
                 THEN 'ការដេញថ្លៃមានកម្រិត'
               WHEN p.procurement_method LIKE '%ពិគ្រោះថ្លៃ%'
                 OR LOWER(p.procurement_method) LIKE '%quotation%'
                 OR LOWER(p.procurement_method) LIKE '%rfq%'
                 OR p.procurement_method LIKE '%ប្រកួតប្រជែងតម្លៃ%'
                 THEN 'ការពិគ្រោះថ្លៃ'
               WHEN p.procurement_method LIKE '%ស្ទង់តម្លៃ%'
                 OR LOWER(p.procurement_method) LIKE '%survey%'
                 THEN 'ការស្ទង់តម្លៃ'
               WHEN p.procurement_method LIKE '%ដោយឡែក%'
                 OR p.procurement_method LIKE '%ដោយផ្ទាល់%'
                 OR LOWER(p.procurement_method) LIKE '%direct%'
                 THEN 'លទ្ធកម្មដោយឡែក'
               ELSE COALESCE(p.procurement_method, '')
             END AS normalized_method,
             COUNT(p.project_id) AS project_count,
             COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(p.plan_amount, 0) ELSE 0 END), 0) AS plan_current,
             COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(p.plan_amount, 0) ELSE 0 END), 0) AS plan_capital,
             COUNT(r.request_id) AS commitment_count,
             COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(r.approved_amount, 0) ELSE 0 END), 0) AS commitment_current,
             COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(r.approved_amount, 0) ELSE 0 END), 0) AS commitment_capital,
             COALESCE(SUM(COALESCE(r.approved_amount, 0)), 0) AS commitment_amount,
             COUNT(c.contract_id) AS contract_count,
             COALESCE(SUM(CASE WHEN p.budget_type = 'ចរន្ត' THEN COALESCE(c.contract_amount, 0) ELSE 0 END), 0) AS contract_current,
             COALESCE(SUM(CASE WHEN p.budget_type = 'មូលធន' THEN COALESCE(c.contract_amount, 0) ELSE 0 END), 0) AS contract_capital,
             COALESCE(SUM(COALESCE(c.contract_amount, 0)), 0) AS contract_amount
           FROM projects p
           LEFT JOIN project_requests r ON r.project_id = p.project_id
           LEFT JOIN contracts c ON c.project_id = p.project_id
           ${whereSql}
           GROUP BY normalized_method`,
          params
        );

        const methodDefs = [
          {
            no: 1,
            key: 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ',
            label: 'ការដេញថ្លៃដោយប្រកួតប្រជែងជាលក្ខណៈអន្តរជាតិ',
          },
          {
            no: 2,
            key: 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក',
            label: 'ការដេញថ្លៃដោយប្រកួតប្រជែងក្នុងស្រុក',
          },
          {
            no: 3,
            key: 'ការដេញថ្លៃមានកម្រិត',
            label: 'ការដេញថ្លៃមានកម្រិត',
          },
          {
            no: 4,
            key: 'ការពិគ្រោះថ្លៃ',
            label: 'ការពិគ្រោះថ្លៃ',
          },
          {
            no: 5,
            key: 'ការស្ទង់តម្លៃ',
            label: 'ការស្ទង់តម្លៃ',
          },
          {
            no: 6,
            key: 'លទ្ធកម្មដោយឡែក',
            label: 'លទ្ធកម្មដោយឡែក',
          },
        ];

        const rowMap = new Map<string, any>();
        for (const r of rows) {
          rowMap.set(String(r.normalized_method || ''), r);
        }

        const formatPct = (numerator: number, denominator: number): string => {
          if (!denominator || denominator === 0 || !Number.isFinite(denominator) || !Number.isFinite(numerator)) {
            return '0.00%';
          }
          const pct = (numerator / denominator) * 100;
          if (!Number.isFinite(pct) || isNaN(pct)) {
            return '0.00%';
          }
          const normalized = Math.abs(pct) < 0.000001 ? 0 : pct;
          return `${normalized.toFixed(2)}%`;
        };

        let sumPlanCurrent = 0;
        let sumPlanCapital = 0;
        let sumCommitmentCount = 0;
        let sumCommitmentCurrent = 0;
        let sumCommitmentCapital = 0;
        let sumCommitmentAmount = 0;
        let sumContractCount = 0;
        let sumContractCurrent = 0;
        let sumContractCapital = 0;
        let sumContractAmount = 0;

        data = methodDefs.map((m) => {
          const dbRow = rowMap.get(m.key);
          const planCurrent = Number(dbRow?.plan_current || 0);
          const planCapital = Number(dbRow?.plan_capital || 0);
          const commitmentCount = Number(dbRow?.commitment_count || 0);
          const commitmentCurrent = Number(dbRow?.commitment_current || 0);
          const commitmentCapital = Number(dbRow?.commitment_capital || 0);
          const commitmentAmount = Number(
            dbRow?.commitment_amount !== undefined
              ? dbRow.commitment_amount
              : commitmentCurrent + commitmentCapital
          );
          const contractCount = Number(dbRow?.contract_count || 0);
          const contractCurrent = Number(dbRow?.contract_current || 0);
          const contractCapital = Number(dbRow?.contract_capital || 0);
          const contractAmount = Number(dbRow?.contract_amount || 0);

          sumPlanCurrent += planCurrent;
          sumPlanCapital += planCapital;
          sumCommitmentCount += commitmentCount;
          sumCommitmentCurrent += commitmentCurrent;
          sumCommitmentCapital += commitmentCapital;
          sumCommitmentAmount += commitmentAmount;
          sumContractCount += contractCount;
          sumContractCurrent += contractCurrent;
          sumContractCapital += contractCapital;
          sumContractAmount += contractAmount;

          const totalPlan = planCurrent + planCapital;
          const totalCommitment = commitmentCurrent + commitmentCapital;
          const totalContract = contractAmount;

          const contractVsCommitmentAmount =
            totalCommitment === 0 ? 0 : totalCommitment - totalContract;
          const contractVsCommitmentPercent = formatPct(
            contractVsCommitmentAmount,
            totalCommitment
          );

          const contractVsPlanAmount =
            totalPlan === 0 ? 0 : totalPlan - totalContract;
          const contractVsPlanPercent = formatPct(
            contractVsPlanAmount,
            totalPlan
          );

          return {
            no: m.no,
            procurement_method: m.label,
            plan_current_amount: planCurrent,
            plan_capital_amount: planCapital,
            commitment_current_amount: commitmentCurrent,
            commitment_capital_amount: commitmentCapital,
            contract_count: contractCount,
            contract_total_amount: contractAmount,
            contract_vs_commitment_amount: contractVsCommitmentAmount,
            contract_vs_commitment_percent: contractVsCommitmentPercent,
            contract_vs_plan_amount: contractVsPlanAmount,
            contract_vs_plan_percent: contractVsPlanPercent,
          };
        });

        const grandTotalPlan = sumPlanCurrent + sumPlanCapital;
        const grandTotalCommitment = sumCommitmentCurrent + sumCommitmentCapital;
        const grandTotalContract = sumContractAmount;

        const grandContractVsCommitmentAmount =
          grandTotalCommitment === 0 ? 0 : grandTotalCommitment - grandTotalContract;
        const grandContractVsCommitmentPercent = formatPct(
          grandContractVsCommitmentAmount,
          grandTotalCommitment
        );

        const grandContractVsPlanAmount =
          grandTotalPlan === 0 ? 0 : grandTotalPlan - grandTotalContract;
        const grandContractVsPlanPercent = formatPct(
          grandContractVsPlanAmount,
          grandTotalPlan
        );

        data.push({
          no: 'សរុប',
          procurement_method: 'ចំនួនគម្រោង I+II+III (សរុប)',
          plan_current_amount: sumPlanCurrent,
          plan_capital_amount: sumPlanCapital,
          commitment_current_amount: sumCommitmentCurrent,
          commitment_capital_amount: sumCommitmentCapital,
          contract_count: sumContractCount,
          contract_total_amount: sumContractAmount,
          contract_vs_commitment_amount: grandContractVsCommitmentAmount,
          contract_vs_commitment_percent: grandContractVsCommitmentPercent,
          contract_vs_plan_amount: grandContractVsPlanAmount,
          contract_vs_plan_percent: grandContractVsPlanPercent,
        });

        summary = {
          total_plan_amount: grandTotalPlan,
          total_commitment_amount: grandTotalCommitment,
          total_contract_count: sumContractCount,
          total_contract_amount: grandTotalContract,
          contract_vs_commitment_amount: grandContractVsCommitmentAmount,
          contract_vs_commitment_percent: grandContractVsCommitmentPercent,
          contract_vs_plan_amount: grandContractVsPlanAmount,
          contract_vs_plan_percent: grandContractVsPlanPercent,
        };
        break;
      }

      default:
        return res.status(400).json({ success: false, message: 'ប្រភេទរបាយការណ៍មិនត្រឹមត្រូវ' });
    }

    return res.json({
      success: true,
      title,
      summary,
      data,
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: req.user?.full_name || req.user?.username || 'Admin',
        organization: 'ក្រសួងសុខាភិបាល - នាយកដ្ឋានលទ្ធកម្មសាធារណៈ (Ministry of Health)',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
