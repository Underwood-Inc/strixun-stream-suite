<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$dashboard/lib/api-client';
  import type { Customer } from '$dashboard/lib/types';

  export let customer: Customer;

  interface Role {
    name: string;
    displayName: string;
    description: string;
    permissions: string[];
    priority: number;
  }

  interface Permission {
    name: string;
    action: string;
    resource: string;
    displayName: string;
    description: string;
    category: string;
  }

  interface CustomerAccess {
    customerId: string;
    roles: string[];
    permissions: string[];
    quotas: Record<string, { used: number; limit: number; period: string; resetAt: string }>;
  }

  let roles: Role[] = [];
  let permissions: Permission[] = [];
  let customers: CustomerAccess[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedTab: 'roles' | 'permissions' | 'customers' = 'roles';
  let searchQuery = '';
  let selectedCustomer: CustomerAccess | null = null;
  let editingRoles: string[] = [];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      // Load roles from Access Service
      const rolesResponse = await fetch('http://localhost:8791/access/roles', {
        headers: {
          'X-Service-Key': apiClient.getToken(), // Use JWT as service key for admin access
        },
      });
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        roles = rolesData.roles || [];
      } else {
        console.error('Failed to load roles:', rolesResponse.status);
      }

      // Load permissions from Access Service
      const permsResponse = await fetch('http://localhost:8791/access/permissions', {
        headers: {
          'X-Service-Key': apiClient.getToken(),
        },
      });
      if (permsResponse.ok) {
        const permsData = await permsResponse.json();
        permissions = permsData.permissions || [];
      } else {
        console.error('Failed to load permissions:', permsResponse.status);
      }

      // Note: Customer access list would require a new admin endpoint
      // For now, showing structure only
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error loading data:', err);
    } finally {
      loading = false;
    }
  }

  async function updateCustomerRoles(customerId: string, newRoles: string[]) {
    try {
      const response = await fetch(`http://localhost:8791/access/${customerId}/roles`, {
        method: 'PUT',
        headers: {
          'X-Service-Key': apiClient.getToken(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles: newRoles }),
      });

      if (!response.ok) {
        throw new Error('Failed to update roles');
      }

      selectedCustomer = null;
      await loadData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update roles';
    }
  }

  function openEditRoles(customerAccess: CustomerAccess) {
    selectedCustomer = customerAccess;
    editingRoles = [...customerAccess.roles];
  }

  function toggleRole(roleName: string) {
    if (editingRoles.includes(roleName)) {
      editingRoles = editingRoles.filter(r => r !== roleName);
    } else {
      editingRoles = [...editingRoles, roleName];
    }
  }

  function closeEditModal() {
    selectedCustomer = null;
    editingRoles = [];
  }

  $: filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  $: filteredPermissions = permissions.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  $: categoryGroups = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);
</script>

<div class="roles-permissions-page">
  <header class="page-header">
    <h1>Roles & Permissions</h1>
    <p class="page-description">
      Manage system roles, permissions, and customer access
    </p>
  </header>

  {#if loading}
    <div class="loading">
      <div class="loading__spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>✗ {error}</p>
      <button onclick={() => loadData()}>Retry</button>
    </div>
  {:else}
    <div class="tabs">
      <button
        class="tab-button"
        class:active={selectedTab === 'roles'}
        onclick={() => selectedTab = 'roles'}
      >
        Roles ({roles.length})
      </button>
      <button
        class="tab-button"
        class:active={selectedTab === 'permissions'}
        onclick={() => selectedTab = 'permissions'}
      >
        Permissions ({permissions.length})
      </button>
      <button
        class="tab-button"
        class:active={selectedTab === 'customers'}
        onclick={() => selectedTab = 'customers'}
      >
        Customer Access
      </button>
    </div>

    <div class="search-bar">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search {selectedTab}..."
        class="search-input"
      />
    </div>

    {#if selectedTab === 'roles'}
      <div class="roles-grid">
        {#each filteredRoles as role}
          <div class="role-card">
            <div class="role-card__header">
              <h3>{role.displayName}</h3>
              <span class="role-card__priority">Priority: {role.priority}</span>
            </div>
            <p class="role-card__description">{role.description}</p>
            <div class="role-card__permissions">
              <h4>Permissions ({role.permissions.length})</h4>
              <div class="permission-tags">
                {#each role.permissions as perm}
                  <span class="permission-tag">{perm}</span>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if selectedTab === 'permissions'}
      <div class="permissions-list">
        {#each Object.entries(categoryGroups) as [category, perms]}
          <div class="permission-category">
            <h3>{category}</h3>
            <div class="permissions-grid">
              {#each perms as perm}
                <div class="permission-card">
                  <h4>{perm.displayName}</h4>
                  <p class="permission-card__name">{perm.name}</p>
                  <p class="permission-card__description">{perm.description}</p>
                  <div class="permission-card__meta">
                    <span>Action: {perm.action}</span>
                    <span>Resource: {perm.resource}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="customers-section">
        <p class="info-message">
          ℹ Customer access management requires additional admin endpoints.
          Coming soon!
        </p>
      </div>
    {/if}
  {/if}
</div>

{#if selectedCustomer}
  <div class="modal-overlay" onclick={closeEditModal}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <header class="modal__header">
        <h2>Edit Roles</h2>
        <button class="close-button" onclick={closeEditModal}>×</button>
      </header>
      <div class="modal__body">
        <p>Customer: {selectedCustomer.customerId}</p>
        <div class="roles-checklist">
          {#each roles as role}
            <label class="role-checkbox">
              <input
                type="checkbox"
                checked={editingRoles.includes(role.name)}
                onchange={() => toggleRole(role.name)}
              />
              <span>{role.displayName}</span>
              <small>{role.description}</small>
            </label>
          {/each}
        </div>
      </div>
      <footer class="modal__footer">
        <button class="button button--secondary" onclick={closeEditModal}>
          Cancel
        </button>
        <button
          class="button button--primary"
          onclick={() => updateCustomerRoles(selectedCustomer!.customerId, editingRoles)}
        >
          Save Changes
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .roles-permissions-page {
    padding: var(--spacing-lg);
  }

  .page-header {
    margin-bottom: var(--spacing-xl);
  }

  .page-header h1 {
    font-size: var(--font-size-xxl);
    color: var(--text);
    margin-bottom: var(--spacing-sm);
  }

  .page-description {
    color: var(--text-muted);
    font-size: var(--font-size-md);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .loading__spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading p {
    margin-top: var(--spacing-md);
    color: var(--text-muted);
  }

  .error-message {
    padding: var(--spacing-lg);
    background: var(--error-bg);
    border: 1px solid var(--error);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .error-message p {
    color: var(--error);
    margin-bottom: var(--spacing-md);
  }

  .tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
    border-bottom: 2px solid var(--border);
  }

  .tab-button {
    padding: var(--spacing-md) var(--spacing-lg);
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-md);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }

  .tab-button:hover {
    color: var(--text);
  }

  .tab-button.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  .search-bar {
    margin-bottom: var(--spacing-lg);
  }

  .search-input {
    width: 100%;
    max-width: 500px;
    padding: var(--spacing-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: var(--font-size-md);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-lg);
  }

  .role-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-lg);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .role-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .role-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .role-card__header h3 {
    font-size: var(--font-size-lg);
    color: var(--text);
  }

  .role-card__priority {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .role-card__description {
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }

  .role-card__permissions h4 {
    font-size: var(--font-size-md);
    color: var(--text);
    margin-bottom: var(--spacing-sm);
  }

  .permission-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .permission-tag {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
  }

  .permissions-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
  }

  .permission-category h3 {
    font-size: var(--font-size-lg);
    color: var(--text);
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 2px solid var(--border);
  }

  .permissions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--spacing-md);
  }

  .permission-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .permission-card h4 {
    font-size: var(--font-size-md);
    color: var(--text);
    margin-bottom: var(--spacing-xs);
  }

  .permission-card__name {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--accent);
    margin-bottom: var(--spacing-sm);
  }

  .permission-card__description {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-sm);
  }

  .permission-card__meta {
    display: flex;
    gap: var(--spacing-sm);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .permission-card__meta span {
    padding: var(--spacing-xs);
    background: var(--bg);
    border-radius: var(--radius-sm);
  }

  .customers-section {
    padding: var(--spacing-xl);
    text-align: center;
  }

  .info-message {
    padding: var(--spacing-lg);
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border);
  }

  .modal__header h2 {
    font-size: var(--font-size-lg);
    color: var(--text);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 32px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    color: var(--text);
  }

  .modal__body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }

  .roles-checklist {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
  }

  .role-checkbox {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .role-checkbox:hover {
    border-color: var(--primary);
  }

  .role-checkbox input {
    margin-right: var(--spacing-sm);
  }

  .role-checkbox span {
    font-weight: 600;
    color: var(--text);
  }

  .role-checkbox small {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .modal__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border);
  }

  .button {
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .button--primary {
    background: var(--primary);
    color: white;
    border: none;
  }

  .button--primary:hover {
    background: var(--primary-hover);
  }

  .button--secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .button--secondary:hover {
    background: var(--card-hover);
  }
</style>
