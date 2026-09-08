const { runPropertyIntelligenceSync } = require('../services/propertyIntelligenceSyncService');

let timer = null;
const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function startPropertyIntelligenceSyncJob() {
  const run = async (trigger) => {
    try {
      const result = await runPropertyIntelligenceSync(trigger);
      console.log(`Property Intelligence sync: ${result.draftsCreated} drafts, ${result.duplicatesSkipped} duplicates.`);
    } catch (error) {
      console.error('Property Intelligence sync error:', error.message);
    }
  };

  setTimeout(() => run('startup'), 20000);
  if (timer) clearInterval(timer);
  timer = setInterval(() => run('scheduled'), CHECK_INTERVAL_MS);
}

module.exports = { startPropertyIntelligenceSyncJob };
