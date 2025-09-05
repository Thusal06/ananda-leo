const fs = require('fs');
const path = require('path');
module.exports = () => {
  const p = path.join(__dirname, '..', '..', 'data', 'directors.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { members: [] };
  }
};