#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

const packageJson = require('./package.json');
const config = packageJson.repo2txt || {};

// НАСТРОЙКИ
const OWNER = process.env.REPO2TXT_OWNER || config.owner || 's00d';
const REPO = process.env.REPO2TXT_REPO || config.repo || 'repo2txt';
const VERSION = process.env.REPO2TXT_VERSION || config.version || packageJson.version || '2.0.4';
const GPG_KEY_ID = process.env.REPO2TXT_GPG_KEY_ID || config.gpgKeyId || null; // Опционально: ID ключа для проверки
const BIN_DIR = path.join(__dirname, 'bin');
const BIN_NAME = process.platform === 'win32' ? 'repo2txt.exe' : 'repo2txt';
const SKIP_VERIFY = process.env.REPO2TXT_SKIP_VERIFY === 'true' || config.skipVerify === true; // Для отладки

// Маппинг архитектур Node.js в Rust Targets
const PLATFORM_MAPPING = {
    'win32': {
        'x64': 'x86_64-pc-windows-msvc',
        'arm64': 'aarch64-pc-windows-msvc'
    },
    'darwin': {
        'x64': 'x86_64-apple-darwin',
        'arm64': 'aarch64-apple-darwin'
    },
    'linux': {
        'x64': 'x86_64-unknown-linux-gnu',
        'arm64': 'aarch64-unknown-linux-gnu'
    }
};

function getTarget() {
    const platform = os.platform();
    const arch = os.arch();
    if (PLATFORM_MAPPING[platform] && PLATFORM_MAPPING[platform][arch]) {
        return PLATFORM_MAPPING[platform][arch];
    }
    throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function getDownloadUrl(target, isSignature = false) {
    // Формат имени файла в релизах.
    // Если вы используете tauri-action или стандартные rust actions, обычно это tar.gz или zip
    // Пример: repo2txt_2.0.4_x86_64-apple-darwin.tar.gz
    const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
    const sigExt = isSignature ? '.sig' : '';
    const filename = `repo2txt_${VERSION}_${target}.${ext}${sigExt}`;
    return `https://github.com/${OWNER}/${REPO}/releases/download/v${VERSION}/${filename}`;
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        
        const request = https.get(url, (response) => {
            // Обработка редиректов (GitHub их использует)
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                file.close();
                if (fs.existsSync(dest)) {
                    try {
                        fs.unlinkSync(dest);
                    } catch (e) {
                        // Игнорируем ошибки удаления
                    }
                }
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }

            response.pipe(file);
            
            file.on('finish', () => {
                file.close(resolve);
            });
        });
        
        request.on('error', (err) => {
            file.close();
            if (fs.existsSync(dest)) {
                try {
                    fs.unlinkSync(dest);
                } catch (e) {
                    // Игнорируем ошибки удаления
                }
            }
            reject(err);
        });
    });
}

function checkGpgAvailable() {
    try {
        execSync('gpg --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

async function verifySignature(archivePath, sigPath) {
    if (SKIP_VERIFY) {
        console.log('⚠ Skipping signature verification (REPO2TXT_SKIP_VERIFY=true)');
        return true;
    }

    if (!checkGpgAvailable()) {
        console.log('⚠ GPG not available, skipping signature verification');
        console.log('  Install GPG to verify signatures: https://gnupg.org/download/');
        return true; // Не критично, продолжаем установку
    }

    try {
        // Пытаемся импортировать ключ из GitHub, если он не импортирован
        if (GPG_KEY_ID) {
            try {
                execSync(`gpg --list-keys ${GPG_KEY_ID}`, { stdio: 'ignore' });
            } catch (e) {
                console.log(`Importing GPG key ${GPG_KEY_ID}...`);
                try {
                    execSync(`gpg --keyserver keyserver.ubuntu.com --recv-keys ${GPG_KEY_ID}`, { stdio: 'inherit' });
                } catch (e2) {
                    // Пробуем альтернативный способ - скачать с GitHub
                    try {
                        const keyUrl = `https://github.com/${OWNER}.gpg`;
                        const keyPath = path.join(BIN_DIR, 'pubkey.gpg');
                        await downloadFile(keyUrl, keyPath);
                        execSync(`gpg --import "${keyPath}"`, { stdio: 'inherit' });
                        fs.unlinkSync(keyPath);
                    } catch (e3) {
                        console.log('⚠ Could not import GPG key, skipping verification');
                        return true;
                    }
                }
            }
        } else {
            // Пробуем импортировать ключ с GitHub без указания ID
            try {
                const keyUrl = `https://github.com/${OWNER}.gpg`;
                const keyPath = path.join(BIN_DIR, 'pubkey.gpg');
                await downloadFile(keyUrl, keyPath);
                execSync(`gpg --import "${keyPath}"`, { stdio: 'inherit' });
                fs.unlinkSync(keyPath);
            } catch (e) {
                console.log('⚠ Could not import GPG key, skipping verification');
                return true;
            }
        }

        // Проверяем подпись
        console.log('Verifying signature...');
        execSync(`gpg --verify "${sigPath}" "${archivePath}"`, { stdio: 'inherit' });
        console.log('✓ Signature verified successfully');
        return true;
    } catch (e) {
        console.error('✗ Signature verification failed!');
        console.error('  The archive may have been tampered with.');
        console.error('  You can skip verification with: REPO2TXT_SKIP_VERIFY=true npm install');
        return false;
    }
}

async function install() {
    try {
        const target = getTarget();
        const url = getDownloadUrl(target);
        const sigUrl = getDownloadUrl(target, true);
        const archiveName = `repo2txt.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`;
        const sigName = `${archiveName}.sig`;
        const archivePath = path.join(BIN_DIR, archiveName);
        const sigPath = path.join(BIN_DIR, sigName);
        const binaryPath = path.join(BIN_DIR, BIN_NAME);

        // Проверяем, существует ли уже бинарник
        if (fs.existsSync(binaryPath)) {
            console.log(`✓ Binary already exists at ${binaryPath}`);
            process.exit(0);
        }

        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        console.log(`Detecting platform... ${target}`);
        console.log(`Downloading from ${url}...`);
        
        await downloadFile(url, archivePath);

        // Скачиваем подпись, если доступна
        let signatureDownloaded = false;
        try {
            console.log(`Downloading signature...`);
            await downloadFile(sigUrl, sigPath);
            signatureDownloaded = true;
        } catch (e) {
            console.log('⚠ Signature file not found, skipping verification');
        }

        // Проверяем подпись, если она была скачана
        if (signatureDownloaded) {
            const verified = await verifySignature(archivePath, sigPath);
            if (!verified && !SKIP_VERIFY) {
                // Удаляем архив при неудачной проверке
                if (fs.existsSync(archivePath)) {
                    fs.unlinkSync(archivePath);
                }
                if (fs.existsSync(sigPath)) {
                    fs.unlinkSync(sigPath);
                }
                throw new Error('Signature verification failed');
            }
        }

        console.log('Extracting...');
        
        // Используем системный tar (есть на Win10+, Mac, Linux)
        try {
            // Для Windows и Unix
            execSync(`tar -xf "${archivePath}" -C "${BIN_DIR}"`, { stdio: 'inherit' });
        } catch (e) {
            console.error("Extraction failed. Ensure 'tar' is available.");
            throw e;
        }

        // Очистка
        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
        if (fs.existsSync(sigPath)) {
            fs.unlinkSync(sigPath);
        }

        // Проверка прав доступа (для Mac/Linux)
        if (process.platform !== 'win32') {
            if (fs.existsSync(binaryPath)) {
                fs.chmodSync(binaryPath, 0o755);
            } else {
                // Возможно бинарник в подпапке, ищем его
                const files = fs.readdirSync(BIN_DIR);
                const foundBinary = files.find(f => f === BIN_NAME || f.endsWith(BIN_NAME));
                if (foundBinary) {
                    const foundPath = path.join(BIN_DIR, foundBinary);
                    fs.chmodSync(foundPath, 0o755);
                    // Перемещаем в корень bin если нужно
                    if (foundBinary !== BIN_NAME) {
                        fs.renameSync(foundPath, binaryPath);
                    }
                }
            }
        }

        // macOS: дополнительные команды для правильной работы
        if (process.platform === 'darwin' && fs.existsSync(binaryPath)) {
            try {
                console.log('Applying macOS security settings...');
                // Удаляем расширенные атрибуты (quarantine и т.д.)
                execSync(`xattr -cr "${binaryPath}"`, { stdio: 'inherit' });
                // Подписываем бинарник (ad-hoc подпись)
                execSync(`codesign --force --deep --sign - "${binaryPath}"`, { stdio: 'inherit' });
                console.log('✓ macOS security settings applied');
            } catch (e) {
                console.log('⚠ Could not apply macOS security settings:', e.message);
                // Не критично, продолжаем
            }
        }

        // Проверяем, что бинарник действительно существует
        if (!fs.existsSync(binaryPath)) {
            throw new Error(`Binary not found after extraction. Expected at: ${binaryPath}`);
        }

        console.log('✓ repo2txt installed successfully!');
    } catch (error) {
        console.error('✗ Installation failed:', error.message);
        console.error(`\nPlease ensure:`);
        console.error(`1. GitHub release v${VERSION} exists`);
        console.error(`2. Archive file name matches: repo2txt_${VERSION}_<target>.{tar.gz|zip}`);
        console.error(`3. Archive contains binary: ${BIN_NAME}`);
        console.error(`4. You have internet connection`);
        console.error(`5. 'tar' command is available (Windows 10+, macOS, Linux)`);
        process.exit(1);
    }
}

install();
