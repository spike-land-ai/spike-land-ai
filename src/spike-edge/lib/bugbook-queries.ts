/**
 * Bugbook query builders — parameterized SQL for the bugbook route.
 */

export interface BugListFilters {
  status?: string | undefined;
  category?: string | undefined;
  sort?: string | undefined;
  limit: number;
  offset: number;
}

export interface BuiltQuery {
  sql: string;
  params: (string | number)[];
}

export function buildBugListQuery(filters: BugListFilters): BuiltQuery {
  let sql = "SELECT id, title, category, status, severity, elo, report_count, first_seen_at, last_seen_at FROM bugs WHERE 1=1";
  const params: (string | number)[] = [];

  if (filters.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }

  const orderCol = filters.sort === "recent" ? "last_seen_at" : "elo";
  sql += ` ORDER BY ${orderCol} DESC LIMIT ? OFFSET ?`;
  params.push(filters.limit, filters.offset);

  return { sql, params };
}

export function buildBugCountQuery(filters: Pick<BugListFilters, "status" | "category">): BuiltQuery {
  let sql = "SELECT COUNT(*) as total FROM bugs WHERE 1=1";
  const params: (string | number)[] = [];

  if (filters.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }

  return { sql, params };
}

export function buildFindExistingBugByError(serviceName: string, errorCode: string): BuiltQuery {
  const metadataLike = `%"error_code":"${errorCode}"%`;
  return {
    sql: "SELECT * FROM bugs WHERE category = ? AND metadata LIKE ? AND status != 'DEPRECATED' LIMIT 1",
    params: [serviceName, metadataLike],
  };
}

export function buildFindExistingBugByTitle(title: string, serviceName: string): BuiltQuery {
  return {
    sql: "SELECT * FROM bugs WHERE title = ? AND category = ? AND status != 'DEPRECATED' LIMIT 1",
    params: [title, serviceName],
  };
}

export function buildInsertBug(
  title: string,
  description: string,
  serviceName: string,
  severity: string,
  errorCode?: string,
): BuiltQuery {
  return {
    sql: "INSERT INTO bugs (title, description, category, severity, metadata) VALUES (?, ?, ?, ?, ?) RETURNING id",
    params: [
      title,
      description,
      serviceName,
      severity,
      errorCode ? JSON.stringify({ error_code: errorCode }) : "{}",
    ],
  };
}

export function buildBumpBugReportCount(now: number, bugId: string): BuiltQuery {
  return {
    sql: "UPDATE bugs SET report_count = report_count + 1, last_seen_at = ?, status = CASE WHEN report_count >= 2 AND status = 'CANDIDATE' THEN 'ACTIVE' ELSE status END WHERE id = ?",
    params: [now, bugId],
  };
}

export function buildInsertBugReport(
  bugId: string,
  reporterId: string,
  serviceName: string,
  description: string,
  reproductionSteps: string | null,
  severity: string,
  metadata?: Record<string, unknown>,
): BuiltQuery {
  return {
    sql: "INSERT INTO bug_reports (bug_id, reporter_id, service_name, description, reproduction_steps, severity, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
    params: [
      bugId,
      reporterId,
      serviceName,
      description,
      reproductionSteps ?? "",
      severity,
      metadata ? JSON.stringify(metadata) : "{}",
    ],
  };
}

export function buildRandomCompetitor(serviceName: string, bugId: string): BuiltQuery {
  return {
    sql: "SELECT id, elo, report_count FROM bugs WHERE category = ? AND id != ? AND status IN ('CANDIDATE', 'ACTIVE') ORDER BY RANDOM() LIMIT 1",
    params: [serviceName, bugId],
  };
}
