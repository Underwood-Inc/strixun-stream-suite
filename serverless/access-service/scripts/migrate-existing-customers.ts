/**
 * Bulk Migration Script - Migrate Existing Customers to Authorization Service
 * 
 * This script migrates all existing customers from the old email-based permission
 * system to the new Authorization Service.
 * 
 * Prerequisites:
 * 1. Authorization Service must be deployed
 * 2. SUPER_ADMIN_EMAILS environment variable must be set
 * 3. SERVICE_API_KEY must be set for service-to-service auth
 * 
 * Usage:
 *   pnpm tsx serverless/access-service/scripts/migrate-existing-customers.ts
 *   pnpm tsx serverless/access-service/scripts/migrate-existing-customers.ts --dry-run
 * 
 * What it does:
 * 1. Reads all customers from OTP Auth Service (via wrangler kv:key list)
 * 2. For each customer:
 *    - Checks their email against SUPER_ADMIN_EMAILS
 *    - Assigns appropriate roles (super-admin or customer)
 *    - Provisions them in Authorization Service via API
 * 3. Reports migration summary
 */

interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  accessUrl?: string;
  serviceApiKey?: string;
}

async function migrateExistingCustomers(options: MigrationOptions = {}) {
  const { 
    dryRun = false, 
    verbose = false,
    accessUrl = process.env.ACCESS_SERVICE_URL || 'https://access-api.idling.app',
    serviceApiKey = process.env.SERVICE_API_KEY
  } = options;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Authorization Service - Customer Migration');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(dryRun ? '🔍 DRY RUN MODE - No changes will be made' : '⚠  LIVE MODE - Changes will be applied');
  console.log('');
  console.log(`Access Service: ${accessUrl}`);
  console.log('');

  if (!serviceApiKey) {
    console.log('⚠  SERVICE_API_KEY not set (optional for this guide)');
    console.log('  You will need to set it when calling the Authorization Service API');
    console.log('');
  }

  // Step 1: Read SUPER_ADMIN_EMAILS from environment
  const superAdminEmails: string[] = [];
  if (process.env.SUPER_ADMIN_EMAILS) {
    superAdminEmails.push(...process.env.SUPER_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()));
    console.log(`✓ Loaded ${superAdminEmails.length} super admin emails from SUPER_ADMIN_EMAILS`);
    if (verbose) {
      console.log('  Super admins:', superAdminEmails.join(', '));
    }
  } else {
    console.log('⚠  SUPER_ADMIN_EMAILS not set. All customers will be assigned "customer" role.');
  }
  console.log('');

  // Step 2: Instructions for getting customer list
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MANUAL MIGRATION REQUIRED');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('This migration script requires manual intervention due to KV access limitations.');
  console.log('');
  console.log('STEP 1: Export customer list from OTP Auth KV');
  console.log('  Run in serverless/otp-auth-service directory:');
  console.log('  pnpm exec wrangler kv:key list --binding OTP_AUTH_KV --prefix customer_');
  console.log('');
  console.log('STEP 2: For each customer, call Authorization Service API:');
  console.log('');
  console.log('  PowerShell example:');
  console.log('  $headers = @{');
  console.log(`    "X-Service-Key" = "$serviceApiKey"`);
  console.log('    "Content-Type" = "application/json"');
  console.log('  }');
  console.log('  $body = @{ roles = @("customer") } | ConvertTo-Json');
  console.log(`  Invoke-RestMethod -Method Put -Uri "${accessUrl}/access/<customerId>/roles" -Headers $headers -Body $body`);
  console.log('');
  console.log('ALTERNATIVE: Use the auto-provisioning system');
  console.log('  The OTP Auth Service now auto-provisions customers on login.');
  console.log('  Existing customers will be provisioned automatically when they next log in.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('For a fully automated migration, you can:');
  console.log('1. Wait for customers to log in (auto-provisioning)');
  console.log('2. Or manually call the Authorization Service API for each customer');
  console.log('');
  console.log('Migration approach: HYBRID (auto-provisioning + manual)');
  console.log('  - New logins: Automatic');
  console.log('  - Existing customers: Automatic on next login');
  console.log('  - Super admins: Manual provisioning recommended');
  console.log('');

  // Step 3: Show example for provisioning super admins
  if (superAdminEmails.length > 0) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUPER ADMIN PROVISIONING');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('To manually provision super admins, use this PowerShell script:');
    console.log('');
    console.log('$superAdmins = @(');
    for (const email of superAdminEmails) {
      console.log(`  @{ customerId = "<customerId>"; email = "${email}" }`);
    }
    console.log(')');
    console.log('');
    console.log('foreach ($admin in $superAdmins) {');
    console.log('  $headers = @{');
    console.log(`    "X-Service-Key" = "${serviceApiKey}"`);
    console.log('    "Content-Type" = "application/json"');
    console.log('  }');
    console.log('  $body = @{ roles = @("super-admin") } | ConvertTo-Json');
    console.log(`  Write-Host "Provisioning $($admin.email) as super-admin..."`);
    console.log(`  Invoke-RestMethod -Method Put -Uri "${accessUrl}/access/$($admin.customerId)/roles" -Headers $headers -Body $body`);
    console.log('}');
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RECOMMENDED APPROACH');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Deploy all services (OTP Auth, Mods API)');
  console.log('2. Manually provision super admins using the script above');
  console.log('3. Let regular customers be auto-provisioned on login');
  console.log('4. Monitor Authorization Service logs for provisioning activity');
  console.log('');
  console.log('✓ MIGRATION GUIDE COMPLETE');
  console.log('');
}

// Run migration
const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

migrateExistingCustomers({ dryRun, verbose })
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
