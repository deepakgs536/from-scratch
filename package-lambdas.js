import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const services = [
  'product-service', 'inventory-service', 'cart-service', 'order-service',
  'payment-service', 'user-service', 'auth-service', 'media-service',
  'analytics-service', 'notification-service'
];

const distDir = path.resolve(__dirname, 'infrastructure', 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create a dummy file
const dummyFile = path.join(distDir, 'dummy.txt');
fs.writeFileSync(dummyFile, 'dummy content');

console.log('Starting packaging process for Lambda deployment...\n');

for (const service of services) {
  const servicePath = path.resolve(__dirname, service);
  const zipPath = path.join(distDir, `${service}.zip`);
  
  const secureEnv = { ...process.env, PATH: (process.env.PATH || '').split(path.delimiter).filter(p => path.isAbsolute(p)).join(path.delimiter) };
  
  console.log(`📦 Packaging ${service}...`);
  try {
    console.log('   Installing production dependencies...');
    execSync('npm ci --omit=dev --ignore-scripts', { cwd: servicePath, stdio: 'ignore', env: secureEnv });

    console.log(`   Creating zip archive...`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    execSync(`tar -a -c -f "${zipPath}" *`, { cwd: servicePath, stdio: 'ignore', env: secureEnv });
    console.log(`   ✅ Successfully packaged ${service}.zip`);
  } catch (err) {
    console.error(`   ❌ Error packaging ${service}: ${err.message}`);
  }
}

console.log('\n🎉 Packaging complete! Deployment packages are located in infrastructure/dist');
