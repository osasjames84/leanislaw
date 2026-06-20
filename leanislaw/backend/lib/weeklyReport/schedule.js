/**
 * In-process weekly fallback scheduler. The PRIMARY mechanism is a host cron
 * hitting POST /api/v1/reports/cron/run-all (idempotent). This fallback exists
 * so a single-instance deploy without external cron still gets weekly reports.
 *
 * Opt in with REPORTS_INPROCESS_SCHEDULE=1. Runs the last completed week for
 * every coach once, on the configured weekday/hour (default Mon 06:00 local).
 * No extra dependency — checks the clock hourly.
 *   REPORTS_SCHEDULE_DOW   0=Sun..6=Sat (default 1 = Monday)
 *   REPORTS_SCHEDULE_HOUR  0..23 (default 6)
 */

import { db } from '../../db.js';
import { coachClients } from '../../schema.js';
import { eq } from 'drizzle-orm';
import { resolveWeek } from './weekRange.js';
import { generateWeeklyReports } from './generate.js';

let timer = null;
let lastRunWeek = null;

async function runAll() {
    const week = resolveWeek(); // last completed week
    if (lastRunWeek === week.weekStart) return;
    lastRunWeek = week.weekStart;
    const coaches = await db
        .selectDistinct({ coach_id: coachClients.coach_id })
        .from(coachClients)
        .where(eq(coachClients.status, 'active'));
    for (const { coach_id } of coaches) {
        try {
            await generateWeeklyReports(coach_id, week);
        } catch (e) {
            console.error('[reports] scheduled run failed for coach', coach_id, e.message);
        }
    }
    console.log(
        `[reports] scheduled weekly run complete for week ${week.weekStart} (${coaches.length} coaches)`
    );
}

export function startWeeklyScheduler() {
    if (process.env.REPORTS_INPROCESS_SCHEDULE !== '1') return false;
    const dow = Number(process.env.REPORTS_SCHEDULE_DOW ?? 1);
    const hour = Number(process.env.REPORTS_SCHEDULE_HOUR ?? 6);

    const tick = async () => {
        try {
            const now = new Date();
            if (now.getDay() !== dow || now.getHours() !== hour) return;
            await runAll();
        } catch (e) {
            console.error('[reports] scheduler tick error', e.message);
        }
    };

    timer = setInterval(tick, 60 * 60 * 1000); // hourly
    if (timer.unref) timer.unref();
    tick();
    console.log(`[reports] in-process weekly scheduler on (dow=${dow} hour=${hour})`);
    return true;
}
