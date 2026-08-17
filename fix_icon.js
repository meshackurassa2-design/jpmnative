const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconPath = path.join(__dirname, 'assets', 'icon.png');
const realIconPath = path.join(__dirname, 'assets', 'icon_real.png');

const buf = fs.readFileSync(iconPath);

sharp(buf)
  .toFormat('png')
  .toBuffer()
  .then(data => {
    fs.writeFileSync(iconPath, data);
    fs.writeFileSync(realIconPath, data);
    console.log('Icons converted successfully');
  })
  .catch(err => {
    console.error('Error converting icons:', err);
  });
