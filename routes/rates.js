const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ratesFile = path.join(__dirname, '../data/rates.json');
if (!fs.existsSync(ratesFile)) {
  fs.writeFileSync(ratesFile, JSON.stringify({
    cement: 400, sand: 55, aggregate: 50, steel: 68,
    labour_skilled: 350, labour_semiskilled: 250, labour_unskilled: 180
  }));
}

const getRates = () => JSON.parse(fs.readFileSync(ratesFile));
const saveRates = (data) => fs.writeFileSync(ratesFile, JSON.stringify(data, null, 2));

router.get('/', (req, res) => res.json(getRates()));
router.post('/update', (req, res) => {
  const { category, rate } = req.body;
  const rates = getRates();
  if (rates[category] !== undefined) {
    rates[category] = rate;
    saveRates(rates);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Category not found' });
  }
});

module.exports = router;
