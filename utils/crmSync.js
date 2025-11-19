import axios from 'axios';

export const syncToCRM = async ({ phone }) => {
  try {
    await axios.post('https://your-crm-api.com/contacts', {
      phone,
      source: 'BuildMitra OTP Login'
    });
    console.log(`✅ CRM sync successful for ${phone}`);
  } catch (err) {
    console.error(`❌ CRM sync failed for ${phone}:`, err.message);
  }
};