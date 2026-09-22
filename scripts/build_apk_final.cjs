const fs = require('fs');
const path = require('path');
const https = require('https');

const tempZip = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'temp_pwa_build.zip');
const finalApkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');

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
  display: "standalone",
  fallbackType: "customtabs",
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

console.log('Sending request to PWABuilder API for updated standalone app APK...');
const req = https.request({
  hostname: 'pwabuilder-cloudapk.azurewebsites.net',
  port: 443,
  path: '/generateAppPackage',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log(`Status: ${res.statusCode}`);
  const file = fs.createWriteStream(tempZip);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Downloaded updated ZIP package. Size:', fs.statSync(tempZip).size);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(payload);
req.end();
