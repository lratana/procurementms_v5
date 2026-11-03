import { Response } from 'express';
import { getDb } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

const VALID_BUDGET_TYPES = ['ចរន្ត', 'មូលធន'];

export async function getProjects(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = await getDb();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);

    const search = ((req.query.search as string) || '').trim();
    const fiscal_year = req.query.fiscal_year
      ? String(req.query.fiscal_year)
      : '';

    const procurement_type = req.query.procurement_type
      ? String(req.query.procurement_type)
      : '';

    const procurement_method = req.query.procurement_method
      ? String(req.query.procurement_method)
      : '';

    const budget_type = req.query.budget_type
      ? String(req.query.budget_type)
      : '';

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search) {
      whereClauses.push(
        '(p.project_id LIKE ? OR p.title LIKE ? OR p.description LIKE ?)'
      );

      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );
    }

    if (fiscal_year) {
      whereClauses.push('p.fiscal_year = ?');
      params.push(fiscal_year);
    }

    if (procurement_type) {
      whereClauses.push('p.procurement_type = ?');
      params.push(procurement_type);
    }

    if (procurement_method) {
      whereClauses.push('p.procurement_method = ?');
      params.push(procurement_method);
    }

    if (budget_type) {
      whereClauses.push('p.budget_type = ?');
      params.push(budget_type);
    }

    const whereSql =
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '';

    const countRows = await query(
      `SELECT COUNT(*) as total
       FROM projects p
       ${whereSql}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT
        p.*,
        COALESCE(c.status, 'រៀបចំផែនការ') AS contract_status,
        COALESCE(h.progress_percent, 0) AS progress_percent
      FROM projects p

      LEFT JOIN contracts c
        ON c.project_id = p.project_id

      LEFT JOIN handovers h
        ON h.project_id = p.project_id

      ${whereSql}

      ORDER BY p.project_id ASC

      LIMIT ? OFFSET ?
    `;

    const projects = await query(
      listSql,
      [...params, limit, offset]
    );

    const enriched = projects.map((p: any) => {
      let status = 'រៀបចំផែនការ';

      if (Number(p.progress_percent) === 100) {
        status = 'បានបញ្ចប់';
      } else if (p.contract_status) {
        status = p.contract_status;
      }

      return {
        ...p,
        status,
      };
    });

    return res.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function getProjectById(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;
    const { query } = await getDb();

    const projects = await query(
      'SELECT * FROM projects WHERE project_id = ? LIMIT 1',
      [id]
    );

    const project = projects[0];

    if (!project) {
      return res.status(404).json({
        success: false,
        message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ (Project not found)`,
      });
    }

    const requests = await query(
      'SELECT * FROM project_requests WHERE project_id = ? LIMIT 1',
      [id]
    );

    const biddings = await query(
      'SELECT * FROM bidding_process WHERE project_id = ? LIMIT 1',
      [id]
    );

    const contracts = await query(
      'SELECT * FROM contracts WHERE project_id = ? LIMIT 1',
      [id]
    );

    const handovers = await query(
      'SELECT * FROM handovers WHERE project_id = ? LIMIT 1',
      [id]
    );

    const warranties = await query(
      'SELECT * FROM warranties WHERE project_id = ? LIMIT 1',
      [id]
    );

    const auditLogs = await query(
      `SELECT *
       FROM audit_logs
       WHERE record_id = ?
          OR module = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [id, 'គម្រោង']
    );

    return res.json({
      success: true,
      data: {
        ...project,
        request: requests[0] || null,
        bidding: biddings[0] || null,
        contract: contracts[0] || null,
        handover: handovers[0] || null,
        warranty: warranties[0] || null,
        auditLogs,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function createProject(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const {
      project_id,
      title,
      description,
      fiscal_year,
      procurement_type,
      budget_type,
      procurement_method,
      plan_date,
      plan_amount,
    } = req.body;

    if (!project_id || !project_id.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'សូមបញ្ចូលលេខសម្គាល់គម្រោង (Project ID is required)',
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'សូមបញ្ចូលចំណងជើងគម្រោង (Project title is required)',
      });
    }

    if (!VALID_BUDGET_TYPES.includes(budget_type)) {
      return res.status(400).json({
        success: false,
        message:
          'សូមជ្រើសរើសប្រភេទថវិកា៖ ចរន្ត ឬ មូលធន',
      });
    }

    const { query, execute } = await getDb();

    const existing = await query(
      'SELECT project_id FROM projects WHERE project_id = ? LIMIT 1',
      [project_id.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `លេខសម្គាល់គម្រោង "${project_id}" មានរួចហើយក្នុងប្រព័ន្ធ (Project ID already exists)`,
      });
    }

    const cleanProjectId = project_id.trim().toUpperCase();

    const newProject = {
      project_id: cleanProjectId,
      title: title.trim(),
      description: description
        ? description.trim()
        : null,

      fiscal_year: fiscal_year
        ? Number(fiscal_year)
        : new Date().getFullYear(),

      procurement_type:
        procurement_type || 'សំណង់',

      budget_type,

      procurement_method:
        procurement_method || 'ក្នុងស្រុក',

      plan_date:
        plan_date ||
        new Date().toISOString().substring(0, 10),

      plan_amount:
        plan_amount !== undefined &&
        plan_amount !== ''
          ? Number(plan_amount)
          : 0,
    };

    await execute(
      `INSERT INTO projects
      (
        project_id,
        title,
        description,
        fiscal_year,
        procurement_type,
        budget_type,
        procurement_method,
        plan_date,
        plan_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newProject.project_id,
        newProject.title,
        newProject.description,
        newProject.fiscal_year,
        newProject.procurement_type,
        newProject.budget_type,
        newProject.procurement_method,
        newProject.plan_date,
        newProject.plan_amount,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'CREATE',
      module: 'គម្រោង',
      tableName: 'projects',
      recordId: newProject.project_id,
      newData: newProject,
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress,
    });

    return res.status(201).json({
      success: true,
      message: 'បានបង្កើតគម្រោងថ្មីដោយជោគជ័យ',
      data: newProject,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function updateProject(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    const {
      title,
      description,
      fiscal_year,
      procurement_type,
      budget_type,
      procurement_method,
      plan_date,
      plan_amount,
    } = req.body;

    if (
      budget_type !== undefined &&
      !VALID_BUDGET_TYPES.includes(budget_type)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'ប្រភេទថវិកាត្រូវតែជា ចរន្ត ឬ មូលធន',
      });
    }

    const { query, execute } = await getDb();

    const existing = await query(
      'SELECT * FROM projects WHERE project_id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ`,
      });
    }

    const oldData = existing[0];

    const updated = {
      title:
        title !== undefined
          ? title.trim()
          : oldData.title,

      description:
        description !== undefined
          ? description.trim()
          : oldData.description,

      fiscal_year:
        fiscal_year !== undefined
          ? Number(fiscal_year)
          : oldData.fiscal_year,

      procurement_type:
        procurement_type !== undefined
          ? procurement_type
          : oldData.procurement_type,

      budget_type:
        budget_type !== undefined
          ? budget_type
          : oldData.budget_type,

      procurement_method:
        procurement_method !== undefined
          ? procurement_method
          : oldData.procurement_method,

      plan_date:
        plan_date !== undefined
          ? plan_date
          : oldData.plan_date,

      plan_amount:
        plan_amount !== undefined &&
        plan_amount !== ''
          ? Number(plan_amount)
          : oldData.plan_amount,
    };

    await execute(
      `UPDATE projects
       SET
         title = ?,
         description = ?,
         fiscal_year = ?,
         procurement_type = ?,
         budget_type = ?,
         procurement_method = ?,
         plan_date = ?,
         plan_amount = ?
       WHERE project_id = ?`,
      [
        updated.title,
        updated.description,
        updated.fiscal_year,
        updated.procurement_type,
        updated.budget_type,
        updated.procurement_method,
        updated.plan_date,
        updated.plan_amount,
        id,
      ]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'UPDATE',
      module: 'គម្រោង',
      tableName: 'projects',
      recordId: id,
      oldData,
      newData: updated,
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress,
    });

    return res.json({
      success: true,
      message: 'បានកែប្រែទិន្នន័យគម្រោងដោយជោគជ័យ',
      data: {
        project_id: id,
        ...updated,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

export async function deleteProject(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { id } = req.params;

    const { query, execute } = await getDb();

    const existing = await query(
      'SELECT * FROM projects WHERE project_id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `រកមិនឃើញគម្រោងលេខ ${id} ទេ`,
      });
    }

    const oldData = existing[0];

    await execute(
      'DELETE FROM projects WHERE project_id = ?',
      [id]
    );

    await createAuditLog({
      userId: req.user?.user_id,
      action: 'DELETE',
      module: 'គម្រោង',
      tableName: 'projects',
      recordId: id,
      oldData,
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress,
    });

    return res.json({
      success: true,
      message:
        'បានលុបគម្រោង និងទិន្នន័យពាក់ព័ន្ធដោយជោគជ័យ',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}