<script lang="ts">
  /**
   * Encryption Settings Component
   * 
   * UI for managing JWT token-based encryption configuration
   * - Encryption is automatically enabled when user logs in (via email OTP)
   * - Uses JWT token from authentication store for key derivation
   * - CRITICAL: Without authentication (email OTP access), decryption is impossible
   * 
   * @version 3.0.0
   */

  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import {
    isEncryptionEnabled,
    enableEncryption,
    disableEncryption,
    changeEncryptionToken,
    verifyEncryptionToken,
    isHTTPS,
  } from '../../core/services/encryption';
  import { encryptedStorage, migrateToEncryption } from '../../core/services/encrypted-storage';
import { token, user } from '../../stores/auth';
import { showToast } from '../../stores/toast-queue';

  let encryptionEnabled = false;
  let isProcessing = false;
  let migrationStatus = '';
  let httpsStatus = false;
  let currentToken: string | null = null;
  let currentUserEmail: string | null = null;
  let tokenMatches = false;

  onMount(async () => {
    encryptionEnabled = await isEncryptionEnabled();
    httpsStatus = isHTTPS();
    
    // Get current token and email
    currentToken = get(token);
    const userData = get(user);
    currentUserEmail = userData?.email || null;

    // If user is authenticated and encryption is enabled, verify token matches
    if (encryptionEnabled && currentToken) {
      tokenMatches = await verifyEncryptionToken(currentToken);
      
      // If encryption is enabled but token doesn't match, warn user
      if (!tokenMatches) {
        showToast(
          '⚠ Current authentication token does not match the token used for encryption. ' +
          'You may not be able to decrypt existing data. Please log in again.',
          'warning'
        );
      }
    }

    // If user is authenticated but encryption is not enabled, enable it automatically
    if (currentToken && !encryptionEnabled) {
      await handleAutoEnableEncryption();
    }
  });

  // Watch for token changes
  $: {
    const newToken = get(token);
    const userData = get(user);
    const newEmail = userData?.email || null;
    
    if (newToken !== currentToken || newEmail !== currentUserEmail) {
      currentToken = newToken;
      currentUserEmail = newEmail;
      
      // If user logged in and encryption is enabled, verify token
      if (encryptionEnabled && newToken) {
        verifyEncryptionToken(newToken).then(matches => {
          tokenMatches = matches;
          if (!matches) {
            showToast(
              '⚠ Current authentication token does not match the token used for encryption. ' +
              'You may not be able to decrypt existing data. Please log in again.',
              'warning'
            );
          }
        });
      }
      
      // If user logged in and encryption is not enabled, enable it
      if (newToken && !encryptionEnabled) {
        handleAutoEnableEncryption();
      }
    }
  }

  async function handleAutoEnableEncryption(): Promise<void> {
    if (!currentToken) {
      return;
    }

    isProcessing = true;
    try {
      await enableEncryption(currentToken);
      tokenMatches = true;
      encryptionEnabled = true;
      
      // Migrate existing data
      migrationStatus = 'Migrating existing data to encrypted format...';
      const result = await migrateToEncryption();
      migrationStatus = `Migration complete: ${result.migrated} items migrated, ${result.failed} failed`;
      
      showToast('Encryption enabled automatically with your authentication token', 'success');
    } catch (error) {
      showToast(
        `Failed to enable encryption: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      isProcessing = false;
      migrationStatus = '';
    }
  }

  async function handleDisableEncryption(): Promise<void> {
    if (!currentToken) {
      showToast('You must be logged in to disable encryption', 'error');
      return;
    }

    isProcessing = true;
    try {
      await disableEncryption(currentToken);
      encryptionEnabled = false;
      tokenMatches = false;
      
      showToast('Encryption disabled', 'info');
    } catch (error) {
      showToast(
        `Failed to disable encryption: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="encryption-settings">
  <div class="encryption-settings__header">
    <h2>◆ Encryption Settings</h2>
    <p class="encryption-settings__description">
      All data is encrypted at rest using AES-GCM-256. 
      <strong>Only authenticated users (with email OTP access) can decrypt your data.</strong>
      Without authentication, decryption is impossible - even for you.
    </p>
  </div>

  <div class="encryption-settings__status">
    <div class="encryption-settings__status-item">
      <span class="encryption-settings__label">Encryption Status:</span>
      <span class="encryption-settings__value" class:encryption-settings__value--enabled={encryptionEnabled}>
        {encryptionEnabled ? '✓ Enabled' : '✗ Disabled'}
      </span>
    </div>
    <div class="encryption-settings__status-item">
      <span class="encryption-settings__label">HTTPS Status:</span>
      <span class="encryption-settings__value" class:encryption-settings__value--enabled={httpsStatus}>
        {httpsStatus ? '◆ Secure' : '⚠ Not Secure'}
      </span>
    </div>
    <div class="encryption-settings__status-item">
      <span class="encryption-settings__label">Authentication:</span>
      <span class="encryption-settings__value" class:encryption-settings__value--enabled={!!currentToken}>
        {currentToken ? `✓ ${currentUserEmail || 'Logged In'}` : '✗ Not Logged In'}
      </span>
    </div>
    {#if encryptionEnabled && currentToken}
      <div class="encryption-settings__status-item">
        <span class="encryption-settings__label">Token Match:</span>
        <span class="encryption-settings__value" class:encryption-settings__value--enabled={tokenMatches}>
          {tokenMatches ? '✓ Matches' : '⚠ Mismatch'}
        </span>
      </div>
    {/if}
  </div>

  {#if migrationStatus}
    <div class="encryption-settings__migration">
      <p>{migrationStatus}</p>
    </div>
  {/if}

  {#if !currentToken}
    <div class="encryption-settings__section">
      <h3>⚠ Authentication Required</h3>
      <p>
        You must be logged in (via email OTP) to use encryption. Encryption uses your JWT token 
        (obtained through email OTP authentication) as the key derivation source. 
        Please log in to enable encryption.
      </p>
    </div>
  {:else if !encryptionEnabled}
    <div class="encryption-settings__section">
      <h3>Encryption Disabled</h3>
      <p>
        Encryption is currently disabled. Your data is stored unencrypted. 
        Encryption will be enabled automatically when you log in.
      </p>
      <button 
        class="encryption-settings__button encryption-settings__button--primary"
        on:click={handleAutoEnableEncryption}
        disabled={isProcessing}
      >
        {isProcessing ? 'Enabling...' : 'Enable Encryption'}
      </button>
    </div>
  {:else}
    <div class="encryption-settings__section">
      <h3>◉ Encryption Enabled</h3>
      <p>
        All your data is encrypted using your JWT token (obtained via email OTP): 
        <strong>{currentUserEmail || 'Authenticated'}</strong>
      </p>
      
      {#if !tokenMatches}
        <div class="encryption-settings__warning">
          <strong>⚠ Token Mismatch:</strong> 
          Your current authentication token does not match the token used for encryption. 
          You may not be able to decrypt existing data. 
          Please log out and log in again to refresh your token.
        </div>
      {/if}

      <div class="encryption-settings__actions">
        <button
          class="encryption-settings__button encryption-settings__button--danger"
          on:click={handleDisableEncryption}
          disabled={isProcessing}
        >
          Disable Encryption
        </button>
      </div>
    </div>
  {/if}

  <div class="encryption-settings__info">
    <h4>ℹ️ About JWT Token-Based Encryption</h4>
    <ul>
      <li>
        <strong>JWT Token as Key:</strong> Your JWT token (obtained via email OTP) is used to derive the encryption key. 
        Without authentication (email OTP access), decryption is impossible.
      </li>
      <li>
        <strong>At Rest:</strong> All local storage (IndexedDB, localStorage) is encrypted with AES-GCM-256
      </li>
      <li>
        <strong>In Transit:</strong> All network requests use HTTPS (enforced automatically)
      </li>
      <li>
        <strong>Zero-Knowledge:</strong> Your token is never stored in plaintext - only a hash is stored for verification
      </li>
      <li>
        <strong>Automatic:</strong> Encryption is automatically enabled when you log in via email OTP
      </li>
      <li>
        <strong>Password Protection:</strong> You can add an additional password layer for specific items (like notebooks) 
        for extra security on top of the base encryption
      </li>
      <li>
        <strong>Critical:</strong> If you lose access to your email (for OTP), you cannot decrypt your data. 
        This is by design for maximum security.
      </li>
    </ul>
  </div>
</div>

<style lang="scss">
  @use '@styles/variables' as *;

  .encryption-settings {
    padding: var(--spacing-lg);
    max-width: 600px;
    margin: 0 auto;
  }

  .encryption-settings__header {
    margin-bottom: var(--spacing-lg);
  }

  .encryption-settings__header h2 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text);
  }

  .encryption-settings__description {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.9em;
    line-height: 1.5;
  }

  .encryption-settings__status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--card);
    border-radius: var(--radius-md);
  }

  .encryption-settings__status-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .encryption-settings__label {
    font-size: 0.85em;
    color: var(--text-secondary);
  }

  .encryption-settings__value {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.9em;
    word-break: break-all;

    &.encryption-settings__value--enabled {
      color: var(--success);
    }
  }

  .encryption-settings__migration {
    padding: var(--spacing-md);
    background: var(--info-bg);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
    color: var(--info-text);
  }

  .encryption-settings__section {
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--card);
    border-radius: var(--radius-md);
  }

  .encryption-settings__section h3 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text);
  }

  .encryption-settings__section p {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-secondary);
    font-size: 0.9em;
    line-height: 1.5;
  }

  .encryption-settings__warning {
    padding: var(--spacing-md);
    background: var(--warning-bg);
    border: 1px solid var(--warning);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-md);
    color: var(--warning-text);
    font-size: 0.9em;
    line-height: 1.5;
  }

  .encryption-settings__actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
  }

  .encryption-settings__button {
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: var(--hover);
      border-color: var(--primary);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.encryption-settings__button--primary {
      background: var(--primary);
      color: var(--primary-text);
      border-color: var(--primary);

      &:hover:not(:disabled) {
        background: var(--primary-hover);
      }
    }

    &.encryption-settings__button--danger {
      background: var(--danger);
      color: var(--danger-text);
      border-color: var(--danger);

      &:hover:not(:disabled) {
        background: var(--danger-hover);
      }
    }
  }

  .encryption-settings__info {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--card);
    border-radius: var(--radius-md);
  }

  .encryption-settings__info h4 {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text);
  }

  .encryption-settings__info ul {
    margin: 0;
    padding-left: var(--spacing-md);
    color: var(--text-secondary);
    font-size: 0.9em;
    line-height: 1.6;
  }

  .encryption-settings__info li {
    margin-bottom: var(--spacing-xs);
  }
</style>
