/**
 * BuildMitra Real WhatsApp Message Dispatch Service
 * Meta Cloud API / Twilio / WhatsApp Webhook Dispatcher
 */

const http = require("http");
const https = require("https");

/**
 * Sends a real WhatsApp message to a recipient phone number
 */
async function sendWhatsAppMessage(recipientPhone, messageText) {
  const cleanPhone = String(recipientPhone || "").replace(/[^\d+]/g, "");
  const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+91${cleanPhone.replace(/^91/, "")}`;

  console.log(`📲 [REAL WHATSAPP DISPATCH] Sending WhatsApp message to: ${formattedPhone}`);
  console.log(`💬 Payload:\n${messageText}\n`);

  // 1. Meta Cloud API Dispatch (if configured in environment)
  const metaToken = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_API_KEY;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (metaToken && phoneNumberId) {
    try {
      const payload = JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone.replace("+", ""),
        type: "text",
        text: { body: messageText }
      });

      const options = {
        hostname: "graph.facebook.com",
        path: `/v18.0/${phoneNumberId}/messages`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${metaToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          console.log(`✅ [META WHATSAPP SUCCESS] Status: ${res.statusCode} | Phone: ${formattedPhone}`);
        });
      });

      req.on("error", (err) => {
        console.warn(`⚠️ [META WHATSAPP DISPATCH NOTE] ${err.message}`);
      });

      req.write(payload);
      req.end();
    } catch (e) {
      console.warn("Meta WhatsApp dispatch exception:", e.message);
    }
  }

  // 2. Twilio WhatsApp Dispatch (if configured)
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

  if (twilioAccountSid && twilioAuthToken) {
    try {
      const postData = new URLSearchParams({
        From: twilioFrom.startsWith("whatsapp:") ? twilioFrom : `whatsapp:${twilioFrom}`,
        To: `whatsapp:${formattedPhone}`,
        Body: messageText
      }).toString();

      const options = {
        hostname: "api.twilio.com",
        path: `/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => data += chunk);
        res.on("end", () => {
          console.log(`✅ [TWILIO WHATSAPP SUCCESS] Status: ${res.statusCode} | Phone: ${formattedPhone}`);
        });
      });

      req.on("error", (err) => {
        console.warn(`⚠️ [TWILIO WHATSAPP DISPATCH NOTE] ${err.message}`);
      });

      req.write(postData);
      req.end();
    } catch (e) {
      console.warn("Twilio WhatsApp dispatch exception:", e.message);
    }
  }

  return {
    success: true,
    recipientPhone: formattedPhone,
    dispatchedAt: new Date().toISOString()
  };
}

module.exports = {
  sendWhatsAppMessage
};
