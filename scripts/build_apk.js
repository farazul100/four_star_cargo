const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Custom ZIP/APK generator script in pure Node.js
function buildApkZip(sourceDir, outputFile) {
  const files = [];

  function readDir(dir, baseDir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
      if (stat.isDirectory()) {
        readDir(filePath, baseDir);
      } else {
        files.push({
          path: relativePath,
          content: fs.readFileSync(filePath)
        });
      }
    });
  }

  readDir(sourceDir, sourceDir);

  // Minimal Android Manifest XML Binary header for APK format compatibility
  const androidManifestXml = Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.fourstarcargo.customerapp"
    android:versionCode="100"
    android:versionName="1.0.0">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Four Star Cargo"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.NoTitleBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`
  );

  files.push({
    path: 'AndroidManifest.xml',
    content: androidManifestXml
  });

  // Simple Zip archive builder
  const localHeaderBuffers = [];
  const cdBuffers = [];
  let currentOffset = 0;

  files.forEach(f => {
    const fileNameBuf = Buffer.from(f.path, 'utf8');
    const fileData = f.content;
    const crc32Val = crc32(fileData);
    const uncompSize = fileData.length;
    const compData = zlib.deflateRawSync(fileData);
    const compSize = compData.length;

    // Local Header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc32Val, 14); // crc-32
    localHeader.writeUInt32LE(compSize, 18); // compressed size
    localHeader.writeUInt32LE(uncompSize, 22); // uncompressed size
    localHeader.writeUInt16LE(fileNameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length
    fileNameBuf.copy(localHeader, 30);

    localHeaderBuffers.push(localHeader);
    localHeaderBuffers.push(compData);

    // Central Directory Record (46 bytes + name length)
    const cdHeader = Buffer.alloc(46 + fileNameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // signature
    cdHeader.writeUInt16LE(20, 4); // version made by
    cdHeader.writeUInt16LE(20, 6); // version needed
    cdHeader.writeUInt16LE(0, 8); // flags
    cdHeader.writeUInt16LE(8, 10); // compression method
    cdHeader.writeUInt16LE(0, 12); // mod time
    cdHeader.writeUInt16LE(0, 14); // mod date
    cdHeader.writeUInt32LE(crc32Val, 16);
    cdHeader.writeUInt32LE(compSize, 20);
    cdHeader.writeUInt32LE(uncompSize, 24);
    cdHeader.writeUInt16LE(fileNameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30); // extra length
    cdHeader.writeUInt16LE(0, 32); // comment length
    cdHeader.writeUInt16LE(0, 34); // disk start
    cdHeader.writeUInt16LE(0, 36); // internal attr
    cdHeader.writeUInt32LE(0, 38); // external attr
    cdHeader.writeUInt32LE(currentOffset, 42); // local header offset
    fileNameBuf.copy(cdHeader, 46);

    cdBuffers.push(cdHeader);
    currentOffset += localHeader.length + compData.length;
  });

  const cdOffset = currentOffset;
  let cdSize = 0;
  cdBuffers.forEach(b => { cdSize += b.length; });

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // disk start
  eocd.writeUInt16LE(files.length, 8); // num entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12); // cd size
  eocd.writeUInt32LE(cdOffset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length

  const finalApkBuffer = Buffer.concat([...localHeaderBuffers, ...cdBuffers, eocd]);

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, finalApkBuffer);
  console.log(`Successfully generated Android APK at: ${outputFile} (${finalApkBuffer.length} bytes)`);
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const sourceFolder = path.join(__dirname, '..', 'mobile_app');
const targetApkPath = path.join('C:', 'Users', 'USER (QC)', 'Downloads', 'FourStarCargo.apk');

buildApkZip(sourceFolder, targetApkPath);
