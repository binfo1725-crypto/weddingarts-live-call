// OmniSix AI - 24/7 Cross-Platform Watchdog Daemon
// Runs continuously and pings https://omnisix-ai.onrender.com every 5 minutes

const https = require('https');

const PING_URL = 'https://omnisix-ai.onrender.com/ping';
const FALLBACK_URL = 'https://omnisix-ai.onrender.com/health';
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function ping(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.on('error', (err) => reject(err));
  });
}

async function runPulse() {
  const time = new Date().toLocaleTimeString();
  try {
    const status = await ping(PING_URL);
    console.log(`[${time}] ✅ OmniSix AI Server is ALIVE (HTTP ${status})`);
  } catch (err) {
    console.warn(`[${time}] ⚠️ Primary ping issue: ${err.message}. Retrying fallback...`);
    try {
      const fallbackStatus = await ping(FALLBACK_URL);
      console.log(`[${time}] ✅ Fallback ping OK (HTTP ${fallbackStatus})`);
    } catch (fErr) {
      console.error(`[${time}] ❌ Server unreachable: ${fErr.message}`);
    }
  }
}

console.log('🚀 [OmniSix 24/7 Watchdog] Running in background. Pinging every 5 minutes...');
runPulse();
setInterval(runPulse, INTERVAL_MS);
