#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/update-version.cjs <version>');
  console.error('Example: node scripts/update-version.cjs 2.0.1');
  process.exit(1);
}

// Проверка формата версии
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Error: Version must be in format X.Y.Z (e.g., 2.0.1)');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');

// Функция для замены всех вхождений версии в файле
function updateVersionInFile(filePath, versionPattern, replacement) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠ Skipping ${filePath} (not found)`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Заменяем все вхождения версии (всегда, даже если версия та же)
  content = content.replace(versionPattern, replacement);
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ Updated ${filePath}`);
  return true;
}

let updated = 0;

// package.json (корневой)
if (updateVersionInFile(
  path.join(rootDir, 'package.json'),
  /"version":\s*"[^"]+"/g,
  `"version": "${version}"`
)) updated++;

// npm-package/package.json (версия встречается дважды)
if (updateVersionInFile(
  path.join(rootDir, 'npm-package/package.json'),
  /"version":\s*"[^"]+"/g,
  `"version": "${version}"`
)) updated++;

// src-tauri/Cargo.toml
if (updateVersionInFile(
  path.join(rootDir, 'src-tauri/Cargo.toml'),
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`
)) updated++;

// src-tauri/tauri.conf.json
if (updateVersionInFile(
  path.join(rootDir, 'src-tauri/tauri.conf.json'),
  /"version":\s*"[^"]+"/g,
  `"version": "${version}"`
)) updated++;

// npm-package/install.js (два места)
const installJsPath = path.join(rootDir, 'npm-package/install.js');
if (fs.existsSync(installJsPath)) {
  let content = fs.readFileSync(installJsPath, 'utf8');
  
  // Заменяем дефолтную версию
  content = content.replace(
    /const VERSION = .*? \|\| '[\d.]+';/,
    `const VERSION = process.env.REPO2TXT_VERSION || config.version || packageJson.version || '${version}';`
  );
  
  // Заменяем пример в комментарии
  content = content.replace(
    /\/\/ Пример: repo2txt_[\d.]+_x86_64-apple-darwin\.tar\.gz/,
    `// Пример: repo2txt_${version}_x86_64-apple-darwin.tar.gz`
  );
  
  fs.writeFileSync(installJsPath, content, 'utf8');
  console.log(`✓ Updated ${installJsPath}`);
  updated++;
}

console.log(`\n✓ Version updated to ${version} in ${updated} file(s)`);

