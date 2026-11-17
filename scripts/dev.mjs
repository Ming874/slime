// 本機開發：Node API（127.0.0.1:8781）＋ next dev（http://localhost:8778，/api/ 轉給 API）。
// Google 登入的回呼網址是 http://localhost:8778/api/auth/google/callback（要在 Google Cloud 登記）。
import { spawn } from 'node:child_process';

const kids = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--disable-warning=ExperimentalWarning', 'server/server.js'], {
    stdio: 'inherit', env: { ...process.env, PORT: '8781', HOST: '127.0.0.1', SERVE_STATIC: '0', PUBLIC_URL: 'http://localhost:8778' },
  }),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '8778'], {
    stdio: 'inherit', env: { ...process.env, SLIME_API: 'http://127.0.0.1:8781' },
  }),
];
const stop = () => { for (const k of kids) k.kill('SIGTERM'); };
for (const k of kids) k.on('exit', (code) => { stop(); process.exitCode = code ?? 0; });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
