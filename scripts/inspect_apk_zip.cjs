const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const apkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');
const extractDir = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'extracted_apk');

console.log(`Inspecting ${apkPath}...`);
const buffer = fs.readFileSync(apkPath);
console.log(`File size: ${buffer.length} bytes`);
console.log(`First 4 bytes hex: ${buffer.subarray(0, 4).toString('hex')}`);

// Check if it's a zip file (starts with 50 4b 03 04)
if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
  console.log('Confirmed ZIP Archive from PWABuilder! Parsing zip entries...');

  let offset = 0;
  let fileCount = 0;

  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
      console.log(`Found Entry: ${fileName} (Compressed: ${compSize}, Uncompressed: ${uncompSize})`);

      const dataStart = offset + 30 + fileNameLen + extraLen;
      let fileData;

      if (compMethod === 0) {
        fileData = buffer.subarray(dataStart, dataStart + compSize);
      } else if (compMethod === 8) {
        fileData = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compSize));
      }

      if (fileData) {
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        const outFilePath = path.join(extractDir, path.basename(fileName));
        fs.writeFileSync(outFilePath, fileData);
        console.log(`Extracted: ${outFilePath} (${fileData.length} bytes)`);

        if (fileName.endsWith('.apk')) {
          // Replace C:\Users\USER (QC)\Downloads\FourStarCargo.apk with the REAL inner apk!
          fs.writeFileSync(apkPath, fileData);
          console.log(`>>> REPLACED ${apkPath} WITH THE TRUE INNER SIGNED APK (${fileData.length} bytes)! <<<`);
        }
      }

      offset = dataStart + compSize;
      fileCount++;
    } else {
      offset++;
    }
  }
} else {
  console.log('Not a zip file');
}
