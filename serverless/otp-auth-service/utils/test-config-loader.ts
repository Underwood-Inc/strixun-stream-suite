/**
 * Test Configuration Loader
 * Loads integration test configuration from TOML files
 * Supports .dev.toml and .prod.toml for different environments
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@iarna/toml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IntegrationConfig {
  integration: {
    customer_api_url: string;
    service_api_key: string;
    use_live_api: boolean;
  };
}

interface TestConfig {
  customerApiUrl: string;
  serviceApiKey: string;
  useLiveApi: boolean;
}

/**
 * Load test configuration from TOML file
 * Priority:
 * 1. Environment variables (highest priority)
 * 2. TOML file (.dev.toml or .prod.toml)
 * 3. Defaults (lowest priority)
 */
export function loadTestConfig(environment: 'dev' | 'prod' = 'dev'): TestConfig {
  const configPath = join(__dirname, '..', `.${environment}.toml`);
  
  let tomlConfig: IntegrationConfig | null = null;
  
  // Try to load from TOML file
  try {
    const tomlContent = readFileSync(configPath, 'utf-8');
    tomlConfig = parse(tomlContent) as IntegrationConfig;
    console.log(`[Test Config] Loaded configuration from .${environment}.toml`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Test Config] .${environment}.toml not found. Using environment variables or defaults.`);
      console.warn(`[Test Config] To create it, copy .${environment}.toml.example to .${environment}.toml and fill in your values.`);
    } else {
      console.error(`[Test Config] Error reading .${environment}.toml:`, error.message);
    }
  }
  
  // Priority: Environment variables > TOML file > Defaults
  const customerApiUrl = 
    process.env.CUSTOMER_API_URL ||
    tomlConfig?.integration?.customer_api_url ||
    (environment === 'prod' 
      ? 'https://customer-api.idling.app' 
      : 'https://strixun-customer-api-dev.strixuns-script-suite.workers.dev');
  
  const serviceApiKey = 
    process.env.SERVICE_API_KEY ||
    tomlConfig?.integration?.service_api_key ||
    '';
  
  const useLiveApi = 
    process.env.USE_LIVE_API === 'true' ||
    tomlConfig?.integration?.use_live_api ||
    false;
  
  if (!serviceApiKey && useLiveApi) {
    throw new Error(
      `SERVICE_API_KEY is required for integration tests.\n` +
      `Set it in:\n` +
      `  1. Environment variable: SERVICE_API_KEY=...\n` +
      `  2. TOML file: .${environment}.toml (service_api_key = "...")\n` +
      `  3. Copy .${environment}.toml.example to .${environment}.toml and fill in your values.`
    );
  }
  
  return {
    customerApiUrl,
    serviceApiKey,
    useLiveApi,
  };
}

