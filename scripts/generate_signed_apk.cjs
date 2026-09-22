const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const outputApkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');
const tempZipPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'temp_pwa_build.zip');

async function generateSignedNativeWebViewApk() {
  console.log('Requesting NATIVE WEBVIEW (NO ADDRESS BAR / NO CUSTOM TAB) Android APK from PWABuilder Cloud API...');

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
    fallbackType: "webview", // CRITICAL: Forces 100% Native WebView Shell without Chrome CustomTab or URL Bar
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

  const req = https.request(options, (res) => {
    console.log(`PWABuilder API Response Status: ${res.statusCode}`);
    if (res.statusCode === 200 || res.statusCode === 201) {
      const fileStream = fs.createWriteStream(tempZipPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log('Downloaded Native WebView package zip successfully. Extracting signed APK...');
      });
    } else {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.error('API Error Response:', body);
      });
    }
  });

  req.on('error', (e) => {
    console.error('Request Error:', e.message);
  });

  req.write(payload);
  req.end();
}

generateSignedNativeWebViewApk();
