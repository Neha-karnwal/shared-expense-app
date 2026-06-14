const fs = require('fs');
const path = require('path');
const { parseCSV } = require('../src/lib/csvParser');

function testParser() {
  console.log('Reading expenses_export.csv...');
  const csvPath = path.join(__dirname, '../expenses_export.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  
  console.log('Parsing CSV...');
  const result = parseCSV(csvText);
  
  console.log(`Total Rows Parsed: ${result.rows.length}`);
  console.log(`Total Anomalies Detected: ${result.anomalies.length}`);
  
  console.log('\n--- DETECTED ANOMALIES ---');
  result.anomalies.forEach((a, index) => {
    console.log(`[${index + 1}] Row ${a.rowNumber} (${a.anomalyType}):`);
    console.log(`    Description: ${a.description}`);
    console.log(`    Suggestion:  ${a.suggestedAction}`);
  });
}

testParser();
