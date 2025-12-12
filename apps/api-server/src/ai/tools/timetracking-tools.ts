/**
 * Time Tracking Agent Tools
 * Tools for time entries, timesheets, and project time analysis
 */

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";

// ==============================================
// Get Time Entries Tool (from tasks)
// ==============================================

const getTimeEntriesSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  projectId: z.string().describe("Filter by project ID").optional(),
  userId: z.string().describe("Filter by user/assignee ID").optional(),
  startDate: z.string().describe("Start date (YYYY-MM-DD)").optional(),
  endDate: z.string().describe("End date (YYYY-MM-DD)").optional(),
});

type GetTimeEntriesParams = z.infer<typeof getTimeEntriesSchema>;

export const getTimeEntriesTool = tool({
  description:
    "Get time entries from tasks showing estimated vs actual hours. Use for time tracking overview.",
  parameters: getTimeEntriesSchema,
  execute: async (params: GetTimeEntriesParams): Promise<string> => {
    const { tenantId, projectId, userId, startDate, endDate } = params;

    try {
      const tasks = await sql`
        SELECT
          t.id,
          t.title,
          t.status,
          t.priority,
          t.estimated_hours,
          t.actual_hours,
          t.due_date,
          t.created_at,
          t.updated_at,
          p.name as project_name,
          p.id as project_id,
          u.first_name || ' ' || u.last_name as assignee_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE p.manager_id IN (
          SELECT id FROM users WHERE tenant_id = ${tenantId}
        )
        ${projectId ? sql`AND t.project_id = ${projectId}::uuid` : sql``}
        ${userId ? sql`AND t.assigned_to = ${userId}::uuid` : sql``}
        ${startDate ? sql`AND t.created_at >= ${startDate}::date` : sql``}
        ${endDate ? sql`AND t.created_at <= ${endDate}::date` : sql``}
        ORDER BY t.updated_at DESC
        LIMIT 50
      `;

      if (tasks.length === 0) {
        return "No time entries found for the specified criteria.";
      }

      // Calculate totals
      let totalEstimated = 0;
      let totalActual = 0;
      let completedTasks = 0;

      for (const task of tasks) {
        totalEstimated += Number(task.estimated_hours) || 0;
        totalActual += Number(task.actual_hours) || 0;
        if (task.status === "done" || task.status === "completed") {
          completedTasks++;
        }
      }

      const variance =
        totalEstimated > 0 ? ((totalActual - totalEstimated) / totalEstimated) * 100 : 0;

      let response = `## ⏱️ Time Entries\n\n`;
      response += `### Summary\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Total Tasks | ${tasks.length} |\n`;
      response += `| Completed | ${completedTasks} |\n`;
      response += `| Estimated Hours | ${totalEstimated.toFixed(1)}h |\n`;
      response += `| Actual Hours | ${totalActual.toFixed(1)}h |\n`;
      response += `| Variance | ${variance > 0 ? "📈" : "📉"} ${variance.toFixed(1)}% |\n`;

      response += `\n### Tasks\n`;
      response += `| Task | Project | Assignee | Est. | Actual | Status |\n`;
      response += `|------|---------|----------|------|--------|--------|\n`;

      for (const task of tasks.slice(0, 20)) {
        const est = Number(task.estimated_hours) || 0;
        const act = Number(task.actual_hours) || 0;
        const statusEmoji =
          task.status === "done" || task.status === "completed"
            ? "✅"
            : task.status === "in_progress"
              ? "🔄"
              : "📋";
        response += `| ${task.title.substring(0, 30)} | ${task.project_name} | ${task.assignee_name || "-"} | ${est}h | ${act}h | ${statusEmoji} |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting time entries:", error);
      return `Error getting time entries: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Project Time Tool
// ==============================================

const getProjectTimeSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  projectId: z.string().describe("The project ID").optional(),
});

type GetProjectTimeParams = z.infer<typeof getProjectTimeSchema>;

export const getProjectTimeTool = tool({
  description: "Get total time logged to a project with breakdown by task and milestone.",
  parameters: getProjectTimeSchema,
  execute: async (params: GetProjectTimeParams): Promise<string> => {
    const { tenantId, projectId } = params;

    try {
      const projects = await sql`
        SELECT
          p.id,
          p.name,
          p.status,
          p.budget,
          p.start_date,
          p.end_date,
          COUNT(t.id) as task_count,
          COUNT(CASE WHEN t.status IN ('done', 'completed') THEN 1 END) as completed_tasks,
          COALESCE(SUM(CAST(t.estimated_hours AS NUMERIC)), 0) as total_estimated,
          COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as total_actual
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.manager_id IN (
          SELECT id FROM users WHERE tenant_id = ${tenantId}
        )
        ${projectId ? sql`AND p.id = ${projectId}::uuid` : sql``}
        GROUP BY p.id, p.name, p.status, p.budget, p.start_date, p.end_date
        ORDER BY p.updated_at DESC
        LIMIT 20
      `;

      if (projects.length === 0) {
        return "No projects found.";
      }

      let response = `## 📊 Project Time Analysis\n\n`;
      response += `| Project | Status | Tasks | Est. Hours | Actual | Variance |\n`;
      response += `|---------|--------|-------|------------|--------|----------|\n`;

      let grandTotalEst = 0;
      let grandTotalAct = 0;

      for (const p of projects) {
        const est = Number(p.total_estimated) || 0;
        const act = Number(p.total_actual) || 0;
        grandTotalEst += est;
        grandTotalAct += act;

        const variance = est > 0 ? ((act - est) / est) * 100 : 0;
        const varIndicator = variance > 10 ? "🔴" : variance > 0 ? "🟡" : "🟢";
        const completionRate =
          Number(p.task_count) > 0
            ? ((Number(p.completed_tasks) / Number(p.task_count)) * 100).toFixed(0)
            : 0;

        response += `| ${p.name} | ${p.status} (${completionRate}%) | ${p.task_count} | ${est.toFixed(1)}h | ${act.toFixed(1)}h | ${varIndicator} ${variance.toFixed(1)}% |\n`;
      }

      const totalVariance =
        grandTotalEst > 0 ? ((grandTotalAct - grandTotalEst) / grandTotalEst) * 100 : 0;

      response += `\n### Grand Total\n`;
      response += `- **Estimated:** ${grandTotalEst.toFixed(1)} hours\n`;
      response += `- **Actual:** ${grandTotalAct.toFixed(1)} hours\n`;
      response += `- **Variance:** ${totalVariance.toFixed(1)}%\n`;

      if (projectId && projects.length === 1) {
        // Get breakdown by milestone for single project
        const milestones = await sql`
          SELECT
            m.name,
            m.status,
            m.due_date,
            COUNT(t.id) as task_count,
            COALESCE(SUM(CAST(t.estimated_hours AS NUMERIC)), 0) as estimated,
            COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as actual
          FROM milestones m
          LEFT JOIN tasks t ON m.id = t.milestone_id
          WHERE m.project_id = ${projectId}::uuid
          GROUP BY m.id, m.name, m.status, m.due_date
          ORDER BY m.due_date
        `;

        if (milestones.length > 0) {
          response += `\n### Breakdown by Milestone\n`;
          response += `| Milestone | Due | Tasks | Est. | Actual |\n`;
          response += `|-----------|-----|-------|------|--------|\n`;

          for (const m of milestones) {
            const dueDate = m.due_date ? new Date(m.due_date as string).toLocaleDateString() : "-";
            response += `| ${m.name} | ${dueDate} | ${m.task_count} | ${Number(m.estimated).toFixed(1)}h | ${Number(m.actual).toFixed(1)}h |\n`;
          }
        }
      }

      return response;
    } catch (error) {
      console.error("Error getting project time:", error);
      return `Error getting project time: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Team Utilization Tool
// ==============================================

const getTeamUtilizationSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
  period: z.enum(["week", "month", "quarter"]).default("month").describe("Time period to analyze"),
});

type GetTeamUtilizationParams = z.infer<typeof getTeamUtilizationSchema>;

export const getTeamUtilizationTool = tool({
  description: "Get team utilization rates showing hours worked per team member.",
  parameters: getTeamUtilizationSchema,
  execute: async (params: GetTeamUtilizationParams): Promise<string> => {
    const { tenantId, period } = params;

    const periodInterval =
      period === "week" ? "7 days" : period === "quarter" ? "3 months" : "1 month";

    try {
      const utilization = await sql`
        SELECT
          u.id,
          u.first_name || ' ' || u.last_name as name,
          u.role,
          COUNT(t.id) as tasks_assigned,
          COUNT(CASE WHEN t.status IN ('done', 'completed') THEN 1 END) as tasks_completed,
          COALESCE(SUM(CAST(t.estimated_hours AS NUMERIC)), 0) as estimated_hours,
          COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as logged_hours,
          COUNT(DISTINCT t.project_id) as projects_count
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assigned_to
          AND t.updated_at >= NOW() - ${periodInterval}::interval
        WHERE u.tenant_id = ${tenantId}
          AND u.status = 'active'
        GROUP BY u.id, u.first_name, u.last_name, u.role
        ORDER BY logged_hours DESC
      `;

      if (utilization.length === 0) {
        return "No team members found.";
      }

      // Assume 160 hours/month standard capacity
      const standardCapacity = period === "week" ? 40 : period === "quarter" ? 480 : 160;

      let response = `## 👥 Team Utilization (Last ${period})\n\n`;
      response += `| Team Member | Role | Tasks | Completed | Hours | Utilization |\n`;
      response += `|-------------|------|-------|-----------|-------|-------------|\n`;

      let totalHours = 0;
      for (const member of utilization) {
        const hours = Number(member.logged_hours) || 0;
        totalHours += hours;
        const utilizationRate = ((hours / standardCapacity) * 100).toFixed(0);
        const completionRate =
          Number(member.tasks_assigned) > 0
            ? ((Number(member.tasks_completed) / Number(member.tasks_assigned)) * 100).toFixed(0)
            : 0;

        const utilBar =
          Number(utilizationRate) >= 80 ? "🟢" : Number(utilizationRate) >= 50 ? "🟡" : "🔴";

        response += `| ${member.name} | ${member.role || "-"} | ${member.tasks_assigned} | ${completionRate}% | ${hours.toFixed(1)}h | ${utilBar} ${utilizationRate}% |\n`;
      }

      const avgUtilization = (totalHours / (utilization.length * standardCapacity)) * 100;

      response += `\n### Summary\n`;
      response += `- **Team Size:** ${utilization.length} members\n`;
      response += `- **Total Hours Logged:** ${totalHours.toFixed(1)}h\n`;
      response += `- **Average Utilization:** ${avgUtilization.toFixed(0)}%\n`;
      response += `- **Capacity (${period}):** ${standardCapacity}h per person\n`;

      return response;
    } catch (error) {
      console.error("Error getting team utilization:", error);
      return `Error getting team utilization: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// ==============================================
// Get Time Stats Tool
// ==============================================

const getTimeStatsSchema = z.object({
  tenantId: z.string().describe("The tenant ID"),
});

type GetTimeStatsParams = z.infer<typeof getTimeStatsSchema>;

export const getTimeStatsTool = tool({
  description: "Get overall time tracking statistics and metrics.",
  parameters: getTimeStatsSchema,
  execute: async (params: GetTimeStatsParams): Promise<string> => {
    const { tenantId } = params;

    try {
      // Overall stats
      const stats = await sql`
        SELECT
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN t.status IN ('done', 'completed') THEN 1 END) as completed_tasks,
          COALESCE(SUM(CAST(t.estimated_hours AS NUMERIC)), 0) as total_estimated,
          COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as total_actual,
          COALESCE(AVG(CAST(t.estimated_hours AS NUMERIC)), 0) as avg_estimated,
          COALESCE(AVG(CAST(t.actual_hours AS NUMERIC)), 0) as avg_actual
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.manager_id IN (
          SELECT id FROM users WHERE tenant_id = ${tenantId}
        )
      `;

      // By status
      const byStatus = await sql`
        SELECT
          t.status,
          COUNT(*) as count,
          COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as hours
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.manager_id IN (
          SELECT id FROM users WHERE tenant_id = ${tenantId}
        )
        GROUP BY t.status
        ORDER BY hours DESC
      `;

      // By priority
      const byPriority = await sql`
        SELECT
          t.priority,
          COUNT(*) as count,
          COALESCE(SUM(CAST(t.actual_hours AS NUMERIC)), 0) as hours
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.manager_id IN (
          SELECT id FROM users WHERE tenant_id = ${tenantId}
        )
        GROUP BY t.priority
        ORDER BY
          CASE t.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END
      `;

      const data = stats[0] || {};
      const totalEst = Number(data.total_estimated) || 0;
      const totalAct = Number(data.total_actual) || 0;
      const variance = totalEst > 0 ? ((totalAct - totalEst) / totalEst) * 100 : 0;

      let response = `## 📈 Time Tracking Statistics\n\n`;
      response += `### Overview\n`;
      response += `| Metric | Value |\n`;
      response += `|--------|-------|\n`;
      response += `| Total Tasks | ${data.total_tasks || 0} |\n`;
      response += `| Completed Tasks | ${data.completed_tasks || 0} |\n`;
      response += `| Total Estimated | ${totalEst.toFixed(1)}h |\n`;
      response += `| Total Actual | ${totalAct.toFixed(1)}h |\n`;
      response += `| Variance | ${variance > 0 ? "📈" : "📉"} ${variance.toFixed(1)}% |\n`;
      response += `| Avg per Task (Est) | ${Number(data.avg_estimated || 0).toFixed(1)}h |\n`;
      response += `| Avg per Task (Act) | ${Number(data.avg_actual || 0).toFixed(1)}h |\n`;

      response += `\n### By Status\n`;
      response += `| Status | Tasks | Hours |\n`;
      response += `|--------|-------|-------|\n`;
      for (const row of byStatus) {
        response += `| ${row.status} | ${row.count} | ${Number(row.hours).toFixed(1)}h |\n`;
      }

      response += `\n### By Priority\n`;
      response += `| Priority | Tasks | Hours |\n`;
      response += `|----------|-------|-------|\n`;
      for (const row of byPriority) {
        const emoji =
          row.priority === "critical"
            ? "🔴"
            : row.priority === "high"
              ? "🟠"
              : row.priority === "medium"
                ? "🟡"
                : "🟢";
        response += `| ${emoji} ${row.priority} | ${row.count} | ${Number(row.hours).toFixed(1)}h |\n`;
      }

      return response;
    } catch (error) {
      console.error("Error getting time stats:", error);
      return `Error getting time stats: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
