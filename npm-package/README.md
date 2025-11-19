# repo2txt

Convert repository structure to markdown with token counting and file filtering.

## Installation

### Global Installation

```bash
npm install -g repo2txt
```

### Local Installation

```bash
npm install repo2txt
```

### Using npx (without installation)

```bash
npx repo2txt
```

## Usage

After installation, you can run `repo2txt` from anywhere:

```bash
repo2txt [options]
```

## How It Works

This npm package is a wrapper that:

1. **Downloads the binary** during `npm install` (via `postinstall` script)
2. **Detects your platform** (Windows, macOS, Linux) and architecture (x64, arm64)
3. **Downloads the appropriate binary** from GitHub Releases
4. **Makes it executable** and provides a CLI wrapper

## Binary Distribution

The package expects archives to be published on GitHub Releases with the following naming convention:

- `repo2txt_2.0.0_x86_64-apple-darwin.tar.gz` (macOS Intel)
- `repo2txt_2.0.0_aarch64-apple-darwin.tar.gz` (macOS Apple Silicon)
- `repo2txt_2.0.0_x86_64-unknown-linux-gnu.tar.gz` (Linux x64)
- `repo2txt_2.0.0_aarch64-unknown-linux-gnu.tar.gz` (Linux ARM64)
- `repo2txt_2.0.0_x86_64-pc-windows-msvc.zip` (Windows x64)
- `repo2txt_2.0.0_aarch64-pc-windows-msvc.zip` (Windows ARM64)

**Important**: The archive must contain the binary file `repo2txt` (or `repo2txt.exe` on Windows) at the root level or in a subdirectory. The install script will automatically extract and locate it.

## Signature Verification

The installer automatically verifies GPG signatures for downloaded binaries. This ensures the integrity and authenticity of the files.

**How it works:**
1. Downloads the signature file (`.sig`) alongside the archive
2. Imports the GPG public key from GitHub (`https://github.com/<owner>.gpg`)
3. Verifies the signature using `gpg --verify`
4. If verification fails, installation is aborted (unless `REPO2TXT_SKIP_VERIFY=true`)

**Requirements:**
- GPG must be installed on your system
- If GPG is not available, installation continues without verification (with a warning)

**Skip verification** (for debugging only):
```bash
REPO2TXT_SKIP_VERIFY=true npm install -g repo2txt
```

## Configuration

You can customize the repository and version using environment variables:

```bash
REPO2TXT_OWNER=your-username REPO2TXT_REPO=repo2txt REPO2TXT_VERSION=2.0.0 npm install
```

Or set them in `package.json` before publishing:

```json
{
  "repo2txt": {
    "owner": "your-username",
    "repo": "repo2txt",
    "version": "2.0.0",
    "gpgKeyId": "YOUR_KEY_ID"
  }
}
```

## Troubleshooting

### Binary not found

If you see "Binary not found", try:

```bash
npm rebuild
```

Or manually run the install script:

```bash
node install.js
```

### Download fails

Ensure:
1. GitHub release exists for the specified version
2. Archive file name matches the expected pattern: `repo2txt_{version}_{target}.{tar.gz|zip}`
3. Archive contains the binary file `repo2txt` (or `repo2txt.exe` on Windows)
4. You have internet connection
5. GitHub Releases are publicly accessible
6. `tar` command is available (Windows 10+, macOS, Linux)

## Development

To test locally:

```bash
cd npm-package
npm install
node bin/run.js --help
```

## License

MIT

