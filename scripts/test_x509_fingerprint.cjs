const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const apkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');

function getTrueX509Fingerprint() {
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
          // PKCS#7 SignedData parser or search for ASN.1 DER SEQUENCE of X.509 cert
          // Search for 30 82 ... sequence containing issuer / subject
          let pos = 0;
          const fingerprints = [];
          while (pos < certBuffer.length - 4) {
            if (certBuffer[pos] === 0x30 && certBuffer[pos + 1] === 0x82) {
              const len = (certBuffer[pos + 2] << 8) | certBuffer[pos + 3];
              const candidate = certBuffer.subarray(pos, pos + 4 + len);
              try {
                const x509 = new crypto.X509Certificate(candidate);
                console.log(`\n=== FOUND VALID X509 CERTIFICATE ===`);
                console.log(`Subject: ${x509.subject}`);
                console.log(`Issuer: ${x509.issuer}`);
                console.log(`Valid From: ${x509.validFrom}`);
                console.log(`Valid To: ${x509.validTo}`);
                console.log(`Node cert.fingerprint256: ${x509.fingerprint256}`);
                fingerprints.push(x509.fingerprint256);
              } catch (e) {
                // Not a valid standalone X.509 cert structure at this pos
              }
            }
            pos++;
          }
          return fingerprints;
        }
      }

      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
}

getTrueX509Fingerprint();
