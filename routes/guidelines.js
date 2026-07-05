const express = require('express');
const router = express.Router();

const guidelinesData = [
  {
    id: 'rera',
    title: 'RERA Guidelines',
    description: 'Real Estate Regulation and Development Act',
    officialWebsite: 'https://rera.gov.in/',
    sections: [
      { title: 'Registration', content: 'All projects must be registered with RERA.' },
      { title: 'Buyer Protection', content: 'RERA ensures timely possession and quality.' }
    ]
  },
  {
    id: 'bda',
    title: 'BDA Rules',
    description: 'Bangalore Development Authority Regulations',
    officialWebsite: 'https://bda.gov.in/',
    sections: [
      { title: 'Land Use', content: 'Properties must comply with BDA classifications.' },
      { title: 'Building Approval', content: 'All plans must be approved by BDA.' }
    ]
  },
  {
    id: 'bmrda',
    title: 'BMRDA Regulations',
    description: 'Bangalore Metropolitan Region Development Authority',
    officialWebsite: 'https://bmrda.karnataka.gov.in/',
    sections: [
      { title: 'Metropolitan Planning', content: 'BMRDA oversees metropolitan development.' },
      { title: 'Infrastructure', content: 'Development must meet infrastructure standards.' }
    ]
  }
];

router.get('/', (req, res) => {
  res.json({ success: true, guidelines: guidelinesData });
});

router.get('/:id', (req, res) => {
  const guideline = guidelinesData.find(g => g.id === req.params.id);
  if (!guideline) {
    return res.status(404).json({ success: false, message: 'Guideline not found' });
  }
  res.json({ success: true, guideline });
});

module.exports = router;
