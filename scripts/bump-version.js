import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metadataPath = path.resolve(__dirname, '../build-metadata.json');

function bump() {
  try {
    let metadata = { buildId: '000' };
    
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }

    // Convert from Base36, increment, and convert back
    const currentVal = parseInt(metadata.buildId, 36);
    const newVal = (currentVal + 1) % Math.pow(36, 3); // Max 'ZZZ'
    
    metadata.buildId = newVal.toString(36).toUpperCase().padStart(3, '0');
    metadata.lastBump = new Date().toISOString();

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Sync with package.json version
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    
    // Maintain the first 3 semver parts, but replace the suffix
    const baseVersion = pkg.version.split('-')[0];
    pkg.version = `${baseVersion}-${metadata.buildId}`;
    
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    
    console.log(`\n[VERSION] Build ID bumped to: ${metadata.buildId}`);
    console.log(`[PACKAGE] package.json version synced to: ${pkg.version}\n`);
  } catch (err) {
    console.error('[ERROR] Failed to bump build version:', err);
    process.exit(1);
  }
}

bump();
