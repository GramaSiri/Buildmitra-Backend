import axios from 'axios';

export const sendOtp = async (phone, otp) => {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/BuildMitra`;

  try {
    await axios.get(url);
    console.log(`✅ OTP ${otp} sent to ${phone}`);
  } catch (err) {
    console.error(`❌ OTP send failed:`, err.message);
  }
};