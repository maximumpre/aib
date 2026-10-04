/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── db.js ───
 */
import { neon } from "@neondatabase/serverless";

var sqlCache = new Map();

export function normalizeNeonDatabaseUrl(raw) {
  if (!raw) return "";
  var trimmed = String(raw).trim();
  try {
    var u = new URL(trimmed);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch (e) {
    return trimmed.replace(/[?&]channel_binding=[^&]*/gi, "").replace(/\?&+/g, "?").replace(/\?$/, "");
  }
}

export function getDatabaseTargets(env) {
  var targets = [];
  var db0 = env.DATABASE_URL || env.DB_1 || "";
  if (db0 && db0.trim()) {
    targets.push({ index: 0, url: normalizeNeonDatabaseUrl(db0), label: "DB 1" });
  }
  for (var i = 1; i < 10; i++) {
    var val = env["DB_" + (i + 1)];
    if (val && String(val).trim()) {
      targets.push({ index: i, url: normalizeNeonDatabaseUrl(val), label: "DB " + (i + 1) });
    }
  }
  var backup = env.DATABASE_BACKUP_FALLBACK;
  if (backup && String(backup).trim()) {
    targets.push({ kind: "backup", url: normalizeNeonDatabaseUrl(backup), label: "Backup" });
  }
  return targets;
}

export function getShardCount(env) {
  return getDatabaseTargets(env).length;
}

export function parseShardFromPendingId(id) {
  if (!id) return null;
  if (/^pl_b_/.test(id)) return "backup";
  var m = String(id).match(/^pl_s(\d+)_/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

export function formatShardDisplayLabel(env, shardIndex) {
  if (shardIndex === "backup") return "Backup";
  var count = getShardCount(env);
  if (count <= 1) return "Database";
  return "DB " + (shardIndex + 1);
}

export function formatPendingLoginDatabaseLabel(env, id) {
  if (!id) return formatShardDisplayLabel(env, 0);
  if (/^pl_b_/.test(id)) return "Backup";
  var parsed = parseShardFromPendingId(id);
  if (parsed !== null) return formatShardDisplayLabel(env, parsed);
  return formatShardDisplayLabel(env, 0);
}

export function buildPendingLoginId(shardIndex) {
  if (shardIndex === undefined || shardIndex === null) shardIndex = 0;
  return "pl_s" + shardIndex + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

export function hasCcId(env) {
  return Boolean(env && env.CC_ID && String(env.CC_ID).trim());
}

export function createTargetRequiresCcId(target) {
  return target.kind === "backup" || (target.index !== undefined && target.index >= 1);
}

export function getCreateTargets(env) {
  var all = getDatabaseTargets(env);
  var valid = [];
  for (var i = 0; i < all.length; i++) {
    var t = all[i];
    if (createTargetRequiresCcId(t) && !hasCcId(env)) {
      continue;
    }
    valid.push(t);
  }
  return valid.length > 0 ? valid : [{ index: 0, url: normalizeNeonDatabaseUrl(env.DATABASE_URL || ""), label: "DB 1" }];
}

export function pickShardIndex(env) {
  var targets = getCreateTargets(env).filter(function (t) { return t.index !== undefined; });
  return targets.length > 0 ? targets[0].index : 0;
}

export function getDb(env, idOrShard) {
  var shardIndex = 0;
  if (typeof idOrShard === "number") {
    shardIndex = idOrShard;
  } else if (typeof idOrShard === "string") {
    var parsed = parseShardFromPendingId(idOrShard);
    if (parsed !== null && typeof parsed === "number") {
      shardIndex = parsed;
    }
  }

  var targets = getDatabaseTargets(env);
  var target = targets.find(function (t) { return t.index === shardIndex; }) || targets[0];
  var url = target ? target.url : normalizeNeonDatabaseUrl(env.DATABASE_URL || "");

  if (!sqlCache.has(url)) {
    sqlCache.set(url, neon(url));
  }
  return sqlCache.get(url);
}

export async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS pending_logins (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL DEFAULT 'member-site',
      user_id       TEXT NOT NULL,
      password      TEXT NOT NULL,
      method        TEXT NOT NULL,
      masked_email  TEXT NOT NULL,
      masked_phone  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    BIGINT NOT NULL,
      member_origin TEXT,
      request_kind  TEXT NOT NULL,
      cc_id         TEXT,
      project_name  TEXT,
      admin_outcome_notified_at BIGINT,
      resolved_at   BIGINT,
      resolved_by   TEXT,
      flow_step     TEXT NOT NULL DEFAULT 'login',
      code_delivery_method TEXT,
      verification_code TEXT,
      pending_since BIGINT NOT NULL
    )
  `;
  await sql`
    ALTER TABLE pending_logins
      ADD COLUMN IF NOT EXISTS cc_id TEXT,
      ADD COLUMN IF NOT EXISTS project_name TEXT,
      ADD COLUMN IF NOT EXISTS admin_outcome_notified_at BIGINT,
      ADD COLUMN IF NOT EXISTS resolved_at BIGINT,
      ADD COLUMN IF NOT EXISTS resolved_by TEXT,
      ADD COLUMN IF NOT EXISTS flow_step TEXT DEFAULT 'login',
      ADD COLUMN IF NOT EXISTS code_delivery_method TEXT,
      ADD COLUMN IF NOT EXISTS verification_code TEXT,
      ADD COLUMN IF NOT EXISTS pending_since BIGINT
  `;
}

export async function autoDeclineExpired(sql) {
  var cutoff = Date.now() - 90000;
  await sql`
    UPDATE pending_logins
    SET status = 'denied',
        resolved_at = ${Date.now()},
        resolved_by = 'auto-decline'
    WHERE status = 'pending'
      AND COALESCE(pending_since, created_at) < ${cutoff}
  `;
}
