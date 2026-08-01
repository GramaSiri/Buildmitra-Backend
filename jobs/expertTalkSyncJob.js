const { runExpertTalksSync } = require('../services/expertTalkSyncService');

let syncTimer = null;
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 Hours

function startExpertTalkSyncJob() {
  console.log('🔄 Initializing Expert Talks Scheduled Auto-Sync Job (Interval: 6 Hours)...');

  // Trigger initial startup sync after 5 seconds to ensure server connection
  setTimeout(async () => {
    try {
      console.log('🚀 Running initial Expert Talks startup sync...');
      const result = await runExpertTalksSync('startup');
      console.log(`✅ Startup sync completed: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated, ${result.duplicatesSkipped} duplicates skipped.`);
    } catch (err) {
      console.error('❌ Startup sync error:', err.message);
    }
  }, 5000);

  // Set recurring 6-hour interval
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    try {
      console.log('⏰ Running scheduled 6-hour Expert Talks sync...');
      const result = await runExpertTalksSync('scheduled');
      console.log(`✅ Scheduled sync completed: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated.`);
    } catch (err) {
      console.error('❌ Scheduled sync error:', err.message);
    }
  }, SYNC_INTERVAL_MS);
}

function stopExpertTalkSyncJob() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

module.exports = {
  startExpertTalkSyncJob,
  stopExpertTalkSyncJob
};
