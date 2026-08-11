const fs = require('fs');
const path = require('path');
const dir = 'd:/images/Desktop/BMFrontend-Beta-v1.0-2026-07-05/pages';
const targetFiles = [
  'arch-calculator.tsx',
  'brick-calculator.tsx',
  'patio-calculator.tsx',
  'pile-calculator.tsx',
  'rcc-calculator.tsx',
  'rcc-wall-calculator.tsx'
];

targetFiles.forEach(fileName => {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('syncApprovedRatesFromBackend')) return;

  content = 'import { syncApprovedRatesFromBackend } from "../utils/masterRates";\n' + content;

  if (!content.includes('syncApprovedRatesFromBackend()')) {
    content = content.replace(/(export default function \w+\(\)\s*\{)/, '$1\n  React.useEffect(() => { syncApprovedRatesFromBackend(); }, []);');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('ADDED SYNC TO:', fileName);
});
