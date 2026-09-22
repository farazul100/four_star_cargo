const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const AdmZip = require('adm-zip');

const outputApkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');
const tempZipPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'temp_pwa_build.zip');
const assetlinksPath1 = path.join(__dirname, '..', 'public', '.well-known', 'assetlinks.json');
const assetlinksPath2 = path.join(__dirname, '..', 'mobile_app', '.well-known', 'assetlinks.json');

function makeRequest(options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`PWABuilder API HTTP Status: ${res.statusCode}`);
      if (res.statusCode === 200 || res.statusCode === 201) {
        const fileStream = fs.createWriteStream(tempZipPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });
      } else {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => reject(new Error(`API Error ${res.statusCode}: ${body}`)));
      }
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractApkFromZip() {
  const zip = new AdmZip(tempZipPath);
  const zipEntries = zip.getEntries();
  
  let targetEntry = zipEntries.find(entry => entry.entryName.endsWith('.apk') && !entry.isDirectory);
  
  if (targetEntry) {
    console.log(`Found APK entry in ZIP: ${targetEntry.entryName} (${targetEntry.header.size} bytes)`);
    const bufferData = targetEntry.getData();
    fs.writeFileSync(outputApkPath, bufferData);
    console.log(`Saved extracted signed APK to: ${outputApkPath} (${bufferData.length} bytes)`);
    return bufferData;
  } else {
    // If returned binary is directly the APK itself
    const rawBuffer = fs.readFileSync(tempZipPath);
    fs.writeFileSync(outputApkPath, rawBuffer);
    console.log(`Saved raw APK to: ${outputApkPath} (${rawBuffer.length} bytes)`);
    return rawBuffer;
  }
}

function getExactX509Fingerprint(apkBuffer) {
  const apkZip = new AdmZip(apkBuffer);
  const entries = apkZip.getEntries();
  const certEntry = entries.find(e => e.entryName.startsWith('META-INF/') && (e.entryName.endsWith('.RSA') || e.entryName.endsWith('.DSA') || e.entryName.endsWith('.EC')));

  if (!certEntry) {
    throw new Error('No META-INF certificate found in APK!');
  }

  console.log(`Found Certificate File in APK: ${certEntry.entryName}`);
  const certBuffer = certEntry.getData();

  let pos = 0;
  while (pos < certBuffer.length - 4) {
    if (certBuffer[pos] === 0x30 && certBuffer[pos + 1] === 0x82) {
      const len = (certBuffer[pos + 2] << 8) | certBuffer[pos + 3];
      const candidate = certBuffer.subarray(pos, pos + 4 + len);
      try {
        const x509 = new crypto.X509Certificate(candidate);
        console.log(`\n=== EXTRACTED EXACT X509 CERTIFICATE ===`);
        console.log(`Subject: ${x509.subject}`);
        console.log(`Issuer: ${x509.issuer}`);
        console.log(`Fingerprint SHA256: ${x509.fingerprint256}`);
        return x509.fingerprint256;
      } catch (e) {}
    }
    pos++;
  }
  throw new Error('Could not parse valid X.509 certificate from RSA block');
}

async function runBuildProcess() {
  console.log('1. Requesting compiled Android APK package from PWABuilder Cloud API...');

  const payload = JSON.stringify({
    appVersion: "1.0.0",
    appVersionCode: 1,
    host: "four.kee2mart.com",
    iconUrl: "https://four.kee2mart.com/logo.png",
    launcherName: "FourStarCargo",
    name: "M/S Four Star Cargo",
    navigationColor: "#0F2D52",
    themeColor: "#0F2D52",
    backgroundColor: "#0F2D52",
    startUrl: "/app/index.html",
    webManifestUrl: "https://four.kee2mart.com/app/manifest.json",
    display: "fullscreen",
    fallbackType: "webview",
    packageId: "com.fourstarcargo.customerapp",
    splashScreenFadeOutDuration: 300,
    signingMode: "new",
    signing: {
      fullName: "Four Star Cargo",
      organization: "Four Star Cargo",
      organizationalUnit: "Mobile Team",
      countryCode: "BD",
      keyPassword: "CargoPassword123",
      storePassword: "CargoPassword123",
      alias: "fourstarcargo"
    }
  });

  const options = {
    hostname: 'pwabuilder-cloudapk.azurewebsites.net',
    port: 443,
    path: '/generateAppPackage',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  await makeRequest(options, payload);
  console.log('2. Package downloaded. Extracting signed APK...');
  const apkBuffer = extractApkFromZip();

  console.log('3. Extracting exact X.509 SHA-256 certificate fingerprint from signed APK...');
  const sha256Fingerprint = getExactX509Fingerprint(apkBuffer);

  console.log(`\n4. Updating assetlinks.json in public/ and mobile_app/ with exact fingerprint:\n${sha256Fingerprint}`);

  const allFingerprints = Array.from(new Set([
    sha256Fingerprint,
    "09:F8:36:F0:20:29:2E:1D:C5:E2:33:B6:E0:B2:75:48:24:F3:F0:E2:56:D3:BE:AF:A4:C1:B6:6C:7E:B1:50:93",
    "BD:90:D3:48:30:09:CD:E4:C6:C8:F4:93:E5:02:78:68:4C:D0:E5:C7:00:E8:D8:AA:66:83:8F:9B:7C:29:63:94",
    "81:67:3B:F6:18:04:8F:F5:1C:D6:0C:60:A6:2A:AE:62:90:A4:A1:09:E8:65:A8:A0:27:1C:E6:E9:9B:39:25:64",
    "45:0C:02:0B:0A:16:3A:B5:13:FD:9A:DD:13:42:E6:26:41:24:0B:75:A9:F6:BE:85:DB:E2:27:BF:EE:A7:E7:DC",
    "61:6F:FC:E5:04:81:F9:8D:C5:02:2C:21:7C:CF:6F:67:21:49:9B:A3:73:CF:71:AC:CF:32:AC:74:F4:4A:35:F0",
    "2A:C0:EA:4F:A5:C8:30:0C:73:EE:A7:CD:50:DA:01:CA:8D:DC:0B:AB:83:58:C9:21:D8:1B:87:29:A1:80:9A:19",
    "7B:05:36:F8:6A:1C:55:33:99:6F:21:D4:47:6C:E4:E9:BD:61:D4:C5:FA:40:CB:D7:00:13:9C:4F:7D:5E:50:29",
    "A3:25:81:AB:25:92:3D:AB:61:8C:79:45:75:75:40:2E:4E:35:5B:C8:BB:31:DE:42:61:DE:E0:4F:D8:72:D7:D3",
    "45:20:C7:16:7B:7A:B7:7D:6A:D8:95:47:B7:5D:67:AD:20:DF:06:F7:58:F0:97:29:95:FD:69:3C:18:46:B3:69"
  ]));

  const assetlinksContent = JSON.stringify([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.fourstarcargo.customerapp",
        "sha256_cert_fingerprints": allFingerprints
      }
    }
  ], null, 2);

  const assetlinksPathRoot = path.join(__dirname, '..', '.well-known', 'assetlinks.json');
  const assetlinksPathDist = path.join(__dirname, '..', 'dist', '.well-known', 'assetlinks.json');

  fs.mkdirSync(path.dirname(assetlinksPath1), { recursive: true });
  fs.mkdirSync(path.dirname(assetlinksPath2), { recursive: true });
  fs.mkdirSync(path.dirname(assetlinksPathRoot), { recursive: true });
  fs.mkdirSync(path.dirname(assetlinksPathDist), { recursive: true });

  fs.writeFileSync(assetlinksPath1, assetlinksContent);
  fs.writeFileSync(assetlinksPath2, assetlinksContent);
  fs.writeFileSync(assetlinksPathRoot, assetlinksContent);
  fs.writeFileSync(assetlinksPathDist, assetlinksContent);

  console.log(`Updated ${assetlinksPath1}`);
  console.log(`Updated ${assetlinksPath2}`);
  console.log('\n=== SUCCESS! APK AND ASSETLINKS ARE NOW 100% MATCHED! ===');
}

runBuildProcess().catch(err => {
  console.error('Build process failed:', err);
  process.exit(1);
});
