/**
 * Audit Log Export Service
 *
 * Provides export functionality for audit logs in CSV, JSON, and PDF formats.
 * Supports filtering and metadata inclusion.
 *
 * Resolves #590: Build comprehensive Audit Log
 */

import type {
  AuditLogExportOptions,
  AuditLogExportResult,
  ExportFormat,
  WorkspaceAuditLogEntry,
} from "./types";
import { WorkspaceAuditLogger } from "./workspace-audit-logger";

/**
 * Audit Export Service
 */
export class AuditExportService {
  /**
   * Export audit logs in the specified format
   */
  static async export(
    options: AuditLogExportOptions,
  ): Promise<AuditLogExportResult> {
    // Fetch all logs matching the search params
    const logs = await WorkspaceAuditLogger.getAllForExport(
      options.searchParams,
    );

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseFilename = options.filename || `audit-logs-${timestamp}`;

    switch (options.format) {
      case "csv":
        return this.exportToCsv(logs, baseFilename, options.includeMetadata);
      case "json":
        return this.exportToJson(logs, baseFilename, options.includeMetadata);
      case "pdf":
        return this.exportToPdf(logs, baseFilename, options.includeMetadata);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export logs to CSV format
   */
  private static exportToCsv(
    logs: WorkspaceAuditLogEntry[],
    filename: string,
    includeMetadata = false,
  ): AuditLogExportResult {
    // Define headers
    const headers = [
      "ID",
      "Workspace ID",
      "User ID",
      "Action",
      "Target ID",
      "Target Type",
      "Resource ID",
      "Resource Type",
      "IP Address",
      "User Agent",
      "Created At",
    ];

    if (includeMetadata) {
      headers.push("Old Value", "New Value", "Metadata");
    }

    // Escape CSV field
    const escapeField = (field: unknown): string => {
      if (field === null || field === undefined) {
        return "";
      }
      const str = typeof field === "object"
        ? JSON.stringify(field)
        : String(field);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, "\"\"")}"`;
      }
      return str;
    };

    // Build CSV content
    const rows = [headers.join(",")];

    for (const log of logs) {
      const row = [
        escapeField(log.id),
        escapeField(log.workspaceId),
        escapeField(log.userId),
        escapeField(log.action),
        escapeField(log.targetId),
        escapeField(log.targetType),
        escapeField(log.resourceId),
        escapeField(log.resourceType),
        escapeField(log.ipAddress),
        escapeField(log.userAgent),
        escapeField(log.createdAt.toISOString()),
      ];

      if (includeMetadata) {
        row.push(
          escapeField(log.oldValue),
          escapeField(log.newValue),
          escapeField(log.metadata),
        );
      }

      rows.push(row.join(","));
    }

    return {
      format: "csv",
      filename: `${filename}.csv`,
      data: rows.join("\n"),
      mimeType: "text/csv",
      recordCount: logs.length,
    };
  }

  /**
   * Export logs to JSON format
   */
  private static exportToJson(
    logs: WorkspaceAuditLogEntry[],
    filename: string,
    includeMetadata = true,
  ): AuditLogExportResult {
    // Transform logs based on metadata preference
    const exportLogs = logs.map(log => {
      const baseLog = {
        id: log.id,
        workspaceId: log.workspaceId,
        userId: log.userId,
        action: log.action,
        targetId: log.targetId,
        targetType: log.targetType,
        resourceId: log.resourceId,
        resourceType: log.resourceType,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
      };

      if (includeMetadata) {
        return {
          ...baseLog,
          oldValue: log.oldValue,
          newValue: log.newValue,
          metadata: log.metadata,
        };
      }

      return baseLog;
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      recordCount: logs.length,
      logs: exportLogs,
    };

    return {
      format: "json",
      filename: `${filename}.json`,
      data: JSON.stringify(exportData, null, 2),
      mimeType: "application/json",
      recordCount: logs.length,
    };
  }

  /**
   * Export logs to PDF format (returns HTML that can be converted to PDF client-side)
   * Note: For full PDF generation, consider using a library like puppeteer or pdfkit
   */
  private static exportToPdf(
    logs: WorkspaceAuditLogEntry[],
    filename: string,
    includeMetadata = false,
  ): AuditLogExportResult {
    // Generate HTML table that can be converted to PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audit Log Export</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      margin: 20px;
    }
    h1 {
      font-size: 18px;
      margin-bottom: 10px;
    }
    .meta {
      color: #666;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f4f4f4;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .json {
      font-family: monospace;
      font-size: 10px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media print {
      body { margin: 0; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>Audit Log Export</h1>
  <div class="meta">
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Records: ${logs.length}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date/Time</th>
        <th>Action</th>
        <th>User ID</th>
        <th>Target</th>
        <th>IP Address</th>
        ${includeMetadata ? "<th>Details</th>" : ""}
      </tr>
    </thead>
    <tbody>
      ${
      logs
        .map(
          log => `
        <tr>
          <td>${log.createdAt.toISOString()}</td>
          <td>${log.action}</td>
          <td>${log.userId}</td>
          <td>${log.targetType || ""}: ${log.targetId || ""}</td>
          <td>${log.ipAddress || ""}</td>
          ${
            includeMetadata
              ? `<td class="json">${JSON.stringify(log.metadata || {})}</td>`
              : ""
          }
        </tr>
      `,
        )
        .join("")
    }
    </tbody>
  </table>
</body>
</html>
    `.trim();

    return {
      format: "pdf",
      filename: `${filename}.html`, // Returns HTML that can be converted to PDF
      data: html,
      mimeType: "text/html",
      recordCount: logs.length,
    };
  }

  /**
   * Get supported export formats
   */
  static getSupportedFormats(): ExportFormat[] {
    return ["csv", "json", "pdf"];
  }

  /**
   * Validate export options
   */
  static validateOptions(options: AuditLogExportOptions): string[] {
    const errors: string[] = [];

    if (!options.format) {
      errors.push("Export format is required");
    } else if (!this.getSupportedFormats().includes(options.format)) {
      errors.push(`Unsupported export format: ${options.format}`);
    }

    if (!options.searchParams.workspaceId) {
      errors.push("Workspace ID is required for export");
    }

    return errors;
  }
}
