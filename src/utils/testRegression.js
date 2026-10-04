const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const runRegression = () => {
  const utilsDir = __dirname;
  const files = fs.readdirSync(utilsDir).filter(f => f.startsWith('test') && f.endsWith('.js') && f !== 'testCoupons.js' && f !== 'testRegression.js');
  
  let passed = 0;
  let failed = 0;

  for (const file of files) {
    console.log(`\n========================================`);
    console.log(`Running ${file}...`);
    console.log(`========================================\n`);
    try {
      execSync(`node ${path.join(utilsDir, file)}`, { stdio: 'inherit', env: { ...process.env, PORT: Math.floor(5100 + Math.random() * 1000) } });
      passed++;
    } catch (e) {
      console.error(`\n[FAIL] ${file} failed!`);
      failed++;
    }
  }

  console.log(`\nREGRESSION RESULTS: ${passed}/${passed + failed} PASS`);
};

runRegression();
