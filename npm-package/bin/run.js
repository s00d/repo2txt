#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const binName = process.platform === 'win32' ? 'repo2txt.exe' : 'repo2txt';
const binPath = path.join(__dirname, binName);

// Проверяем существование бинарника
if (!fs.existsSync(binPath)) {
  console.error(`Error: Binary not found at ${binPath}`);
  console.error(`Please run: npm install -g repo2txt`);
  console.error(`Or if already installed: npm rebuild`);
  process.exit(1);
}

// Запускаем бинарник и передаем все аргументы
const args = process.argv.slice(2);
const child = spawn(binPath, args, {
  stdio: 'inherit', // Перенаправляем ввод/вывод
  windowsHide: false // Не скрывать окно на Windows (если это CLI)
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start repo2txt:', err.message);
  console.error('Try reinstalling: npm install -g repo2txt --force');
  process.exit(1);
});
