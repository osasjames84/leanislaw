/**
 * Run the Python report engine on a normalized bundle by shelling out to
 * reports/run_from_bundle.py (the same pattern the app uses for the Chess AI
 * Python service). Returns { report, dashboard_html, clients[] }.
 *
 * Env overrides:
 *   PYTHON_BIN   - python executable (default: python3)
 *   REPORTS_DIR  - path to coaching-platform/reports
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function reportsDir() {
    if (process.env.REPORTS_DIR) return process.env.REPORTS_DIR;
    // backend/lib/weeklyReport -> repo root -> coaching-platform/reports
    return path.resolve(__dirname, '..', '..', '..', '..', 'coaching-platform', 'reports');
}

export function runReportEngine(bundle, { timeoutMs = 120000 } = {}) {
    const pythonBin = process.env.PYTHON_BIN || 'python3';
    const dir = reportsDir();
    const script = path.join(dir, 'run_from_bundle.py');

    return new Promise((resolve, reject) => {
        const child = spawn(pythonBin, [script], { cwd: dir });
        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error('Report engine timed out'));
        }, timeoutMs);

        child.stdout.on('data', (d) => {
            stdout += d;
        });
        child.stderr.on('data', (d) => {
            stderr += d;
        });
        child.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new Error(`Failed to start report engine (${pythonBin}): ${err.message}`));
        });
        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code !== 0) {
                return reject(new Error(`Report engine exited ${code}: ${stderr.slice(0, 2000)}`));
            }
            let parsed;
            try {
                parsed = JSON.parse(stdout);
            } catch (e) {
                return reject(new Error(`Report engine returned invalid JSON: ${e.message}`));
            }
            if (parsed.error) return reject(new Error(`Report engine: ${parsed.error}`));
            resolve(parsed);
        });

        child.stdin.write(JSON.stringify(bundle));
        child.stdin.end();
    });
}
