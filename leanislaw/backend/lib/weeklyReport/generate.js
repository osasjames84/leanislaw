/**
 * Orchestrate a weekly run for one coach: build the bundle from the real DB,
 * run the engine, and persist one weekly_reports row per client (with the PDF
 * as base64) plus the coach's HTML dashboard. Idempotent per (client, week).
 */

import { db } from '../../db.js';
import { weeklyReports, weeklyDashboards } from '../../schema.js';
import { buildWeeklyBundle } from './buildBundle.js';
import { runReportEngine } from './runEngine.js';

export async function generateWeeklyReports(coachId, week) {
    const bundle = await buildWeeklyBundle(coachId, week);
    if (!bundle.clients.length) {
        return { week_start: week.weekStart, count: 0, clients: [], summary: null };
    }

    const result = await runReportEngine(bundle);
    const model = result.report;
    const pdfById = new Map(result.clients.map((c) => [String(c.id), c.pdf_base64]));

    const generatedAt = new Date();
    for (const c of model.clients) {
        await db
            .insert(weeklyReports)
            .values({
                coach_id: coachId,
                client_id: Number(c.id),
                week_start: week.weekStart,
                status: c.status,
                flags: c.flags,
                model: c,
                pdf_base64: pdfById.get(String(c.id)) ?? null,
                generated_at: generatedAt,
            })
            .onConflictDoUpdate({
                target: [weeklyReports.client_id, weeklyReports.week_start],
                set: {
                    coach_id: coachId,
                    status: c.status,
                    flags: c.flags,
                    model: c,
                    pdf_base64: pdfById.get(String(c.id)) ?? null,
                    generated_at: generatedAt,
                },
            });
    }

    await db
        .insert(weeklyDashboards)
        .values({
            coach_id: coachId,
            week_start: week.weekStart,
            html: result.dashboard_html,
            generated_at: generatedAt,
        })
        .onConflictDoUpdate({
            target: [weeklyDashboards.coach_id, weeklyDashboards.week_start],
            set: { html: result.dashboard_html, generated_at: generatedAt },
        });

    return {
        week_start: week.weekStart,
        week_end: week.weekEnd,
        count: model.clients.length,
        summary: model.summary,
        clients: model.clients.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    };
}
