const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const apkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');

function extractFingerprint() {
  const buffer = fs.readFileSync(apkPath);
  let offset = 0;

  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLen);
      const dataStart = offset + 30 + fileNameLen + extraLen;

      if (fileName.startsWith('META-INF/') && (fileName.endsWith('.RSA') || fileName.endsWith('.DSA') || fileName.endsWith('.EC'))) {
        console.log(`Found Certificate File in APK: ${fileName}`);
        let certBuffer;
        if (compMethod === 0) {
          certBuffer = buffer.subarray(dataStart, dataStart + compSize);
        } else if (compMethod === 8) {
          certBuffer = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compSize));
        }

        if (certBuffer) {
          // Extract X509 certificate DER block from PKCS7 RSA container
          const sha256 = crypto.createHash('sha256').update(certBuffer).digest('hex').toUpperCase();
          const formattedSha256 = sha256.match(/.{1,2}/g).join(':');
          console.log(`RSA File SHA256 Digest: ${formattedSha256}`);

          // Also try finding X.509 DER certificate pattern (30 82 ...) inside PKCS#7 structure
          const certStart = certBuffer.indexOf(Buffer.from([0x30, 0x82]));
          if (certStart >= 0) {
            const certDer = certBuffer.subarray(certStart);
            const certSha256 = crypto.createHash('sha256').update(certDer).digest('hex').toUpperCase();
            const formattedCertSha256 = certSha256.match(/.{1,2}/g).join(':');
            console.log(`Cert DER SHA256 Digest: ${formattedCertSha256}`);
            
            return { rawSha: formattedSha256, certSha: formattedCertSha256 };
          }
        }
      }

      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
}

extractFingerprint();
