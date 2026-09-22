const fs = require('fs');
const path = require('path');
const https = require('https');

const outputApkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');

async function downloadRealApk() {
  console.log('Requesting compiled Android APK package from PWABuilder Cloud API...');
  
  const payload = JSON.stringify({
    appVersion: "1.0.0",
    appVersionCode: 1,
    host: "four.kee2mart.com",
    iconUrl: "https://four.kee2mart.com/logo.png",
    launcherName: "FourStarCargo",
    name: "M/S Four Star Cargo",
    navigationColor: "#0F2D52",
    themeColor: "#00C2BB",
    backgroundColor: "#0F2D52",
    startUrl: "/app/index.html",
    webManifestUrl: "https://four.kee2mart.com/app/manifest.json",
    display: "standalone",
    fallbackType: "customtabs",
    packageId: "com.fourstarcargo.customerapp",
    splashScreenFadeOutDuration: 300,
    signingMode: "none"
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
    console.log(`API Response Status: ${res.statusCode}`);
    if (res.statusCode === 200 || res.statusCode === 201) {
      const fileStream = fs.createWriteStream(outputApkPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const stat = fs.statSync(outputApkPath);
        console.log(`SUCCESS! Saved real compiled Android APK to: ${outputApkPath} (${stat.size} bytes)`);
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

downloadRealApk();
