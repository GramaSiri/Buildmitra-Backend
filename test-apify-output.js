const { ApifyClient } = require('apify-client');

const client = new ApifyClient({ token: 'apify_api_12fTfPGdrcrogc8MylEzem3o24fhSJc2ZiiM' });

async function test() {
  console.log('Starting AI floor plan...');
  const run = await client.actor('calm_necessity/ai-floor-planner').call({
    prompt: 'Generate a simple 2-bedroom house floor plan. 40x60 plot.',
    outputFormat: 'png'
  });
  
  console.log('Run status:', run.status);
  console.log('Dataset ID:', run.defaultDatasetId);
  
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log('Dataset items (full):', JSON.stringify(items, null, 2));
  
  const storeId = run.defaultKeyValueStoreId;
  const keys = await client.keyValueStore(storeId).listKeys();
  console.log('Key-value store keys:', keys.items.map(k => k.key));
}

test();