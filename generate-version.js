const fs = require('fs');
const path = require('path');

const versionInfo = {
  version: Date.now().toString()
};

fs.writeFileSync(
  path.join(__dirname, 'public', 'version.json'),
  JSON.stringify(versionInfo, null, 2)
);

console.log('Generated version.json:', versionInfo.version);
