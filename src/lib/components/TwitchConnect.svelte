<script lang="ts">
  /**
   * Twitch Account Connection Component
   * 
   * Allows users to attach/detach their Twitch account
   */

  import { onMount } from 'svelte';
  import { TwitchAttachmentService, type TwitchAccountData } from '../../services/twitchAttachment';
  import { user, setAuth } from '../../stores/auth';
  import { getTwitchClientId, getTwitchOAuthCallback } from '../../modules/twitch-api';
  import { showToast } from '../../stores/toast-queue';
  import { getApiUrl } from '../../stores/auth';

  let twitchService: TwitchAttachmentService | null = null;
  let attachedAccount: TwitchAccountData | null = null;
  let loading = false;
  let connecting = false;

  onMount(async () => {
    const clientId = getTwitchClientId();
    const callbackUrl = getTwitchOAuthCallback();
    const apiUrl = getApiUrl();

    if (!clientId || !callbackUrl) {
      showToast({ message: 'Twitch Client ID not configured', type: 'error' });
      return;
    }

    twitchService = new TwitchAttachmentService({
      clientId,
      callbackUrl,
      apiUrl,
    });

    await loadAttachedAccount();
  });

  async function loadAttachedAccount() {
    if (!twitchService) return;

    try {
      loading = true;
      attachedAccount = await twitchService.getAttachedAccount();
      
      // Update user store if account is attached
      if (attachedAccount) {
        const currentUser = $user;
        if (currentUser) {
          setAuth({
            ...currentUser,
            twitchAccount: {
              twitchUserId: attachedAccount.twitchUserId,
              twitchUsername: attachedAccount.twitchUsername,
              displayName: attachedAccount.twitchUsername, // Use username as display name
              attachedAt: attachedAccount.attachedAt,
            },
          });
        }
      }
    } catch (error) {
      console.error('[TwitchConnect] Failed to load account:', error);
    } finally {
      loading = false;
    }
  }

  async function connectTwitch() {
    if (!twitchService) return;

    try {
      connecting = true;
      
      // Generate OAuth URL with state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('twitch_oauth_state', state);
      
      const oauthUrl = twitchService.generateOAuthUrl(state);
      
      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        oauthUrl,
        'Twitch Authorization',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        showToast({ message: 'Popup blocked. Please allow popups and try again.', type: 'error' });
        connecting = false;
        return;
      }

      // Listen for OAuth callback
      const messageListener = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data.type !== 'twitch_oauth_callback') return;

        window.removeEventListener('message', messageListener);
        popup.close();

        const { accessToken, state: returnedState } = event.data;

        // Verify state
        const storedState = sessionStorage.getItem('twitch_oauth_state');
        if (storedState !== returnedState) {
          showToast({ message: 'Security verification failed', type: 'error' });
          connecting = false;
          return;
        }

        sessionStorage.removeItem('twitch_oauth_state');

        try {
          // Attach account
          attachedAccount = await twitchService!.attachAccount(accessToken, returnedState);
          showToast({ message: 'Twitch account connected successfully!', type: 'success' });
          
          // Reload user data
          await loadAttachedAccount();
        } catch (error) {
          showToast({ 
            message: error instanceof Error ? error.message : 'Failed to connect Twitch account', 
            type: 'error' 
          });
        } finally {
          connecting = false;
        }
      };

      window.addEventListener('message', messageListener);

      // Cleanup if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          connecting = false;
        }
      }, 500);
    } catch (error) {
      showToast({ 
        message: error instanceof Error ? error.message : 'Failed to start Twitch connection', 
        type: 'error' 
      });
      connecting = false;
    }
  }

  async function disconnectTwitch() {
    if (!twitchService || !attachedAccount) return;

    if (!confirm('Are you sure you want to disconnect your Twitch account?')) {
      return;
    }

    try {
      loading = true;
      await twitchService.detachAccount();
      attachedAccount = null;
      
      // Update user store
      const currentUser = $user;
      if (currentUser) {
        setAuth({
          ...currentUser,
          twitchAccount: undefined,
        });
      }
      
      showToast({ message: 'Twitch account disconnected', type: 'success' });
    } catch (error) {
      showToast({ 
        message: error instanceof Error ? error.message : 'Failed to disconnect Twitch account', 
        type: 'error' 
      });
    } finally {
      loading = false;
    }
  }
</script>

<style lang="scss">
  @use '@styles/variables' as *;

  .twitch-connect {
    padding: 16px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 8px;
  }

  .twitch-connect .twitch-connect__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .twitch-connect .twitch-connect__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .twitch-connect .twitch-connect__status {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .twitch-connect .twitch-connect__status--connected {
    background: var(--success-bg);
    color: var(--success);
  }

  .twitch-connect .twitch-connect__status--disconnected {
    background: var(--error-bg);
    color: var(--error);
  }

  .twitch-connect .twitch-connect__account-info {
    padding: 12px;
    background: var(--background);
    border: 2px solid var(--border);
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .twitch-connect .twitch-connect__account-name {
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
  }

  .twitch-connect .twitch-connect__account-id {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .twitch-connect .twitch-connect__actions {
    display: flex;
    gap: 8px;
  }

  .twitch-connect .twitch-connect__button {
    flex: 1;
    padding: 10px 16px;
    background: var(--primary);
    color: var(--text);
    border: 2px solid var(--border);
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 0 var(--border);
  }

  .twitch-connect .twitch-connect__button:hover:not(:disabled) {
    background: var(--border);
    transform: translateY(-1px);
    box-shadow: 0 3px 0 var(--border);
  }

  .twitch-connect .twitch-connect__button:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: 0 1px 0 var(--border);
  }

  .twitch-connect .twitch-connect__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .twitch-connect .twitch-connect__button--danger {
    background: var(--error);
    color: #fff;
  }

  .twitch-connect .twitch-connect__button--danger:hover:not(:disabled) {
    background: var(--error);
    opacity: 0.9;
  }
</style>

<div class="twitch-connect">
  <div class="twitch-connect__header">
    <h3 class="twitch-connect__title">
      <span></span>
      <span>Twitch Account</span>
    </h3>
    {#if attachedAccount}
      <span class="twitch-connect__status twitch-connect__status--connected">Connected</span>
    {:else}
      <span class="twitch-connect__status twitch-connect__status--disconnected">Not Connected</span>
    {/if}
  </div>

  {#if loading}
    <p style="color: var(--text-secondary); text-align: center; padding: 16px;">
      Loading...
    </p>
  {:else if attachedAccount}
    <div class="twitch-connect__account-info">
      <div class="twitch-connect__account-name">
        {attachedAccount.twitchUsername}
      </div>
      <div class="twitch-connect__account-id">
        ID: {attachedAccount.twitchUserId}
      </div>
      <div class="twitch-connect__account-id" style="margin-top: 4px; font-size: 0.8rem;">
        Connected {new Date(attachedAccount.attachedAt).toLocaleDateString()}
      </div>
    </div>
    <div class="twitch-connect__actions">
      <button 
        class="twitch-connect__button twitch-connect__button--danger" 
        on:click={disconnectTwitch}
        disabled={loading}
        type="button"
      >
        Disconnect
      </button>
    </div>
  {:else}
    <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9rem;">
      Connect your Twitch account to enable additional features and link your streaming identity.
    </p>
    <div class="twitch-connect__actions">
      <button 
        class="twitch-connect__button" 
        on:click={connectTwitch}
        disabled={connecting || !twitchService}
        type="button"
      >
        {#if connecting}
          Connecting...
        {:else}
          Connect Twitch Account
        {/if}
      </button>
    </div>
  {/if}
</div>

