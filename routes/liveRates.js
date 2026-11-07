const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const MASTER_RATES = [
  { key: "cement", terms: { en: "Cement OPC 53", hi: "सीमेंट (OPC 53)", kn: "ಸಿಮೆಂಟ್ (OPC 53)", te: "సిమెంట్ (OPC 53)", ta: "சிமெண்ட் (OPC 53)", ml: "സിമന്റ് (OPC 53)", bn: "সিমেন্ট (OPC 53)", or: "ସିମେଣ୍ଟ (OPC 53)" }, price: "₹410/BAG", trend: "↑ ₹25 (6.49%)", category: "Structural Material" },
  { key: "tmt steel", terms: { en: "TMT Steel Rebar", hi: "टीमैट स्टील", kn: "ಟಿಎಂಡಿ ಸ್ಟೀಲ್", te: "టిఎంటి స్టీల్", ta: "டிஎம்டி ஸ்டீல்", ml: "ടിഎംടി സ്റ്റീൽ", bn: "টিএমটি স্টিল", or: "ଟିଏମଟି ଷ୍ଟିଲ" }, price: "₹67/KG", trend: "• New Rate", category: "Structural Material" },
  { key: "m-sand", terms: { en: "M-Sand", hi: "एम-सैंड", kn: "ಎಂ-ಸ್ಯಾಂಡ್", te: "ఎం-సాండ్", ta: "எம்-சாண்ட்", ml: "എം-സാൻഡ്", bn: "এম-স্যান্ড", or: "ଏମ-ସାଣ୍ଡ" }, price: "₹48/CFT", trend: "↑ ₹3 (6.67%)", category: "Aggregate & Sand" },
  { key: "vitrified tiles", terms: { en: "Vitrified Tiles (600x600)", hi: "विट्रीफाइड टाइल्स", kn: "ವಿಟ್ರಿಫೈಡ್ ಟೈಲ್ಸ್", te: "విట్రిఫైడ్ టైల్స్", ta: "விட்ரிஃபைட் ஓடுகள்", ml: "വിട്രിഫൈഡ് ടൈൽസ്", bn: "ভিট্রিফাইড টাইলস", or: "ଭିଟ୍ରିଫାଇଡ ଟାଇଲ୍ସ" }, price: "₹58/SQFT", trend: "↓ ₹7 (10.77%)", category: "Flooring & Tiles" },
  { key: "emulsion paint", terms: { en: "Emulsion Paint", hi: "इमल्शन पेंट", kn: "ಎಮಲ್ಷನ್ ಪೇಂಟ್", te: "ఎమల్షన్ పెయింట్", ta: "எமல்ஷன் பெயிண்ட்", ml: "എമൽഷൻ പെയിന്റ്", bn: "ইমালশন পেইন্ট", or: "ଇମଲସନ ପେଣ୍ଟ" }, price: "₹35/LTR", trend: "↓ ₹200 (85.11%)", category: "Finishing & Paint" },
  { key: "clay bricks", terms: { en: "Clay Bricks", hi: "लाल ईंटें", kn: "ಮಣ್ಣಿನ ಇಟ್ಟಿಗೆಗಳು", te: "మట్టి ఇటుకలు", ta: "செங்கல்", ml: "കളിമണ്ണ് ഇഷ്ടികകൾ", bn: "মাটির ইট", or: "ମାଟି ଇଟା" }, price: "₹11/NOS", trend: "↑ ₹3.5 (46.67%)", category: "Masonry" }
];

router.get('/live-rates', (req, res) => {
  try {
    const { q, lang = 'en' } = req.query;
    if (!q) {
      return res.json({ success: true, count: MASTER_RATES.length, data: MASTER_RATES });
    }
    const searchTerm = q.toLowerCase().trim();
    const filtered = MASTER_RATES.filter(item => {
      const termInLang = (item.terms[lang] || item.terms.en).toLowerCase();
      const termInEnglish = item.terms.en.toLowerCase();
      return termInLang.includes(searchTerm) || termInEnglish.includes(searchTerm) || item.key.includes(searchTerm);
    });

    if (filtered.length > 0) {
      return res.json({ success: true, count: filtered.length, data: filtered });
    } else {
      const logPath = path.join(__dirname, '../missing_queries_log.json');
      let logs = [];
      if (fs.existsSync(logPath)) {
        logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      }
      logs.push({ query: q, lang, timestamp: new Date().toISOString() });
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));

      return res.status(404).json({ 
        success: false, 
        message: "Item not found in master database. Logged for automatic backend update.",
        query: q 
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/live-rates', (req, res) => {
  try {
    const newRate = req.body;
    if (!newRate.key || !newRate.price) {
      return res.status(400).json({ success: false, message: "Key and price are required." });
    }
    MASTER_RATES.push(newRate);
    res.json({ success: true, message: "Rate successfully added.", data: newRate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
