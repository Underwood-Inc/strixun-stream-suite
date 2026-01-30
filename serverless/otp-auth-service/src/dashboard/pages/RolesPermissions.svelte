<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { accessApiClient, type CustomerWithAccess } from '$dashboard/lib/access-api-client';
  import type { Customer, RoleDefinition, PermissionDefinition } from '$dashboard/lib/types';
  import ErrorDisplay from '@strixun/shared-components/svelte/ErrorDisplay';

  export let customer: Customer;
  export let userRoles: string[] = [];

  // Check if user has super-admin role
  $: hasSuperAdmin = userRoles.includes('super-admin');

  let roles: RoleDefinition[] = [];
  let permissions: PermissionDefinition[] = [];
  let customers: CustomerWithAccess[] = [];
  let customersLoading = false;
  let customersError: unknown | null = null;
  let loading = true;
  let error: string | null = null;
  let selectedTab: 'roles' | 'permissions' | 'customers' = 'roles';
  let searchQuery = '';
  let customerSearchQuery = '';
  let selectedCustomer: CustomerWithAccess | null = null;
  let editingRoles: string[] = [];
  let originalRoles: string[] = [];
  let savingRoles = false;

  // Dirty state: check if roles have changed from original
  $: isDirty = (() => {
    if (editingRoles.length !== originalRoles.length) return true;
    const sortedEditing = [...editingRoles].sort();
    const sortedOriginal = [...originalRoles].sort();
    return sortedEditing.some((r, i) => r !== sortedOriginal[i]);
  })();

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      // Call Access Service DIRECTLY - no proxy needed!
      const rolesData = await accessApiClient.getAllRoles();
      roles = rolesData.roles || [];

      // Call Access Service DIRECTLY for permissions
      const permsData = await accessApiClient.getAllPermissions();
      permissions = permsData.permissions || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error loading data:', err);
    } finally {
      loading = false;
    }
  }

  // Load customers when customers tab is selected
  $: if (selectedTab === 'customers' && customers.length === 0 && !customersLoading && !customersError) {
    loadCustomers();
  }

  async function loadCustomers() {
    customersLoading = true;
    customersError = null;

    try {
      const response = await accessApiClient.listCustomersWithAccess({
        pageSize: 100,
        search: customerSearchQuery || undefined,
      });
      customers = response.customers;
    } catch (err) {
      customersError = err;
      console.error('Error loading customers:', err);
    } finally {
      customersLoading = false;
    }
  }

  async function updateCustomerRoles(customerId: string, newRoles: string[]) {
    savingRoles = true;
    try {
      await accessApiClient.updateCustomerRoles(customerId, newRoles, 'Updated via admin dashboard');
      // Reload customers to reflect changes
      await loadCustomers();
      selectedCustomer = null;
      editingRoles = [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update roles';
    } finally {
      savingRoles = false;
    }
  }

  function openEditRoles(customerAccess: CustomerWithAccess) {
    selectedCustomer = customerAccess;
    const roles = customerAccess.roles || [];
    editingRoles = [...roles];
    originalRoles = [...roles];
  }

  /**
   * Check if a role can be removed from the selected customer
   * Rules:
   * 1. Cannot remove 'super-admin' from yourself if you are a super-admin
   * 2. Cannot remove any privileged role from yourself that would cause self-lockout
   * 3. Super-admins from env var (isSuperAdmin) cannot have their super-admin role removed
   */
  function canRemoveRole(roleName: string): boolean {
    if (!selectedCustomer) return true;
    
    // Check if editing self
    const isEditingSelf = selectedCustomer.customerId === customer.customerId;
    
    // Rule 1 & 2: Cannot remove super-admin from yourself if you are a super-admin
    if (isEditingSelf && roleName === 'super-admin' && hasSuperAdmin) {
      return false;
    }
    
    // Rule 3: If the target user has isSuperAdmin flag (env var super admin),
    // their super-admin role cannot be removed by anyone
    if (roleName === 'super-admin' && selectedCustomer.isSuperAdmin) {
      return false;
    }
    
    return true;
  }

  /**
   * Check if a role can be added to the selected customer
   * Rules:
   * 1. Cannot add 'banned' role to yourself
   */
  function canAddRole(roleName: string): boolean {
    if (!selectedCustomer) return true;
    
    const isEditingSelf = selectedCustomer.customerId === customer.customerId;
    
    // Cannot ban yourself
    if (isEditingSelf && roleName === 'banned') {
      return false;
    }
    
    return true;
  }

  /**
   * Get the reason why a role cannot be removed (for tooltip/display)
   */
  function getRoleProtectionReason(roleName: string): string | null {
    if (!selectedCustomer) return null;
    
    const isEditingSelf = selectedCustomer.customerId === customer.customerId;
    
    if (isEditingSelf && roleName === 'super-admin' && hasSuperAdmin) {
      return 'You cannot remove super-admin from yourself';
    }
    
    if (roleName === 'super-admin' && selectedCustomer.isSuperAdmin) {
      return 'This user is a super-admin via environment configuration';
    }
    
    return null;
  }

  /**
   * Get the reason why a role cannot be added (for tooltip/display)
   */
  function getAddBlockedReason(roleName: string): string | null {
    if (!selectedCustomer) return null;
    
    const isEditingSelf = selectedCustomer.customerId === customer.customerId;
    
    if (isEditingSelf && roleName === 'banned') {
      return 'You cannot ban yourself';
    }
    
    return null;
  }

  function toggleRole(roleName: string) {
    // Check if we can remove this role (if it's currently assigned)
    if (editingRoles.includes(roleName)) {
      if (!canRemoveRole(roleName)) {
        // Cannot remove this role - show feedback
        const reason = getRoleProtectionReason(roleName);
        if (reason) {
          error = reason;
          setTimeout(() => { if (error === reason) error = null; }, 3000);
        }
        return;
      }
      editingRoles = editingRoles.filter(r => r !== roleName);
    } else {
      // Check if we can add this role
      if (!canAddRole(roleName)) {
        const reason = getAddBlockedReason(roleName);
        if (reason) {
          error = reason;
          setTimeout(() => { if (error === reason) error = null; }, 3000);
        }
        return;
      }
      editingRoles = [...editingRoles, roleName];
    }
  }

  function closeEditModal() {
    selectedCustomer = null;
    editingRoles = [];
    originalRoles = [];
  }

  function handleCustomerSearch() {
    customers = []; // Clear to trigger reload
    loadCustomers();
  }
  
  // Close column menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.column-menu-wrapper')) {
      showColumnMenu = false;
    }
  }
  
  // Cleanup on unmount
  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  });
  
  // Manage click outside listener for column menu
  let prevShowColumnMenu = false;
  $: {
    if (showColumnMenu && !prevShowColumnMenu) {
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    } else if (!showColumnMenu && prevShowColumnMenu) {
      document.removeEventListener('click', handleClickOutside);
    }
    prevShowColumnMenu = showColumnMenu;
  }

  $: filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /**
   * Calculate effective permissions from granted roles.
   * This shows what the user can ACTUALLY do.
   * If wildcard (*) is present, expands to show ALL defined permissions.
   */
  function getEffectivePermissions(
    grantedRoles: string[], 
    allRoles: RoleDefinition[], 
    allPermissions: PermissionDefinition[]
  ): { permissions: string[]; hasWildcard: boolean } {
    const grantedRoleDefs = allRoles.filter(r => grantedRoles.includes(r.name));
    
    // Check for wildcard - means ALL permissions
    const hasWildcard = grantedRoleDefs.some(r => r.permissions.includes('*'));
    
    if (hasWildcard) {
      // Return ALL defined permissions in the system
      return {
        permissions: allPermissions.map(p => p.name).sort(),
        hasWildcard: true
      };
    }
    
    // Collect unique permissions from all granted roles
    const permSet = new Set<string>();
    grantedRoleDefs.forEach(r => r.permissions.forEach((p: string) => permSet.add(p)));
    return {
      permissions: Array.from(permSet).sort(),
      hasWildcard: false
    };
  }

  // Reactive: show what permissions the user effectively has
  $: effectivePermsResult = getEffectivePermissions(editingRoles, roles, permissions);
  $: effectivePermissions = effectivePermsResult.permissions;
  $: hasWildcardAccess = effectivePermsResult.hasWildcard;

  // ==================== TABLE CONFIGURATION ====================
  
  type ColumnId = 'displayName' | 'customerId' | 'roles' | 'status' | 'lastLogin' | 'actions';
  
  interface ColumnConfig {
    id: ColumnId;
    label: string;
    width: number;
    minWidth: number;
    visible: boolean;
    sortable: boolean;
  }
  
  // Column definitions with default widths
  let columns: ColumnConfig[] = [
    { id: 'displayName', label: 'Display Name', width: 220, minWidth: 120, visible: true, sortable: true },
    { id: 'customerId', label: 'Customer ID', width: 180, minWidth: 100, visible: true, sortable: true },
    { id: 'roles', label: 'Roles', width: 200, minWidth: 100, visible: true, sortable: false },
    { id: 'status', label: 'Status', width: 100, minWidth: 80, visible: true, sortable: true },
    { id: 'lastLogin', label: 'Last Login', width: 160, minWidth: 100, visible: true, sortable: true },
    { id: 'actions', label: 'Actions', width: 120, minWidth: 100, visible: true, sortable: false },
  ];
  
  // Sorting state - 3-click cycle: asc -> desc -> null (reset)
  let sortColumn: ColumnId | null = null;
  let sortDirection: 'asc' | 'desc' | null = null;
  
  function toggleSort(column: ColumnId) {
    if (!columns.find(c => c.id === column)?.sortable) return;
    
    if (sortColumn !== column) {
      // New column - start with ascending
      sortColumn = column;
      sortDirection = 'asc';
    } else if (sortDirection === 'asc') {
      // Same column, was asc - switch to desc
      sortDirection = 'desc';
    } else {
      // Same column, was desc - reset to no sort
      sortColumn = null;
      sortDirection = null;
    }
  }
  
  // Column visibility
  let showColumnMenu = false;
  
  function toggleColumnVisibility(columnId: ColumnId) {
    const visibleCount = columns.filter(c => c.visible).length;
    const col = columns.find(c => c.id === columnId);
    if (!col) return;
    
    // Prevent hiding all columns - must have at least 1 visible
    if (col.visible && visibleCount <= 1) return;
    
    columns = columns.map(c => 
      c.id === columnId ? { ...c, visible: !c.visible } : c
    );
  }
  
  // Column resizing
  let resizingColumn: ColumnId | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  
  function startResize(e: MouseEvent, columnId: ColumnId) {
    e.preventDefault();
    e.stopPropagation();
    resizingColumn = columnId;
    resizeStartX = e.clientX;
    const col = columns.find(c => c.id === columnId);
    resizeStartWidth = col?.width || 100;
    
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResize);
  }
  
  function handleResize(e: MouseEvent) {
    if (!resizingColumn) return;
    
    const delta = e.clientX - resizeStartX;
    const col = columns.find(c => c.id === resizingColumn);
    if (!col) return;
    
    const newWidth = Math.max(col.minWidth, resizeStartWidth + delta);
    columns = columns.map(c => 
      c.id === resizingColumn ? { ...c, width: newWidth } : c
    );
  }
  
  function stopResize() {
    resizingColumn = null;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResize);
  }
  
  // Column reordering (drag and drop)
  let draggedColumn: ColumnId | null = null;
  let dragOverColumn: ColumnId | null = null;
  
  function handleDragStart(e: DragEvent, columnId: ColumnId) {
    draggedColumn = columnId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', columnId);
    }
  }
  
  function handleDragOver(e: DragEvent, columnId: ColumnId) {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnId) {
      dragOverColumn = columnId;
    }
  }
  
  function handleDragLeave() {
    dragOverColumn = null;
  }
  
  function handleDrop(e: DragEvent, targetColumnId: ColumnId) {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) {
      draggedColumn = null;
      dragOverColumn = null;
      return;
    }
    
    const fromIndex = columns.findIndex(c => c.id === draggedColumn);
    const toIndex = columns.findIndex(c => c.id === targetColumnId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      const newColumns = [...columns];
      const [removed] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, removed);
      columns = newColumns;
    }
    
    draggedColumn = null;
    dragOverColumn = null;
  }
  
  function handleDragEnd() {
    draggedColumn = null;
    dragOverColumn = null;
  }
  
  // Get visible columns in order
  $: visibleColumns = columns.filter(c => c.visible);

  $: filteredCustomers = customers.filter(c =>
    c.customerId.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    (c.displayName?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ?? false)
  );

  // Sorted customers
  $: sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aVal: string | number | null = null;
    let bVal: string | number | null = null;
    
    switch (sortColumn) {
      case 'displayName':
        aVal = a.displayName?.toLowerCase() || '';
        bVal = b.displayName?.toLowerCase() || '';
        break;
      case 'customerId':
        aVal = a.customerId.toLowerCase();
        bVal = b.customerId.toLowerCase();
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'lastLogin':
        aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        break;
    }
    
    if (aVal === null || bVal === null) return 0;
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  $: categoryGroups = permissions.reduce<Record<string, PermissionDefinition[]>>((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

</script>

<div class="roles-permissions-page">
  <header class="page-header">
    <h1>Roles & Permissions</h1>
    <p class="page-description">
      Manage system roles, permissions, and customer access
    </p>
  </header>

  {#if !hasSuperAdmin}
    <div class="access-denied">
      <div class="access-denied__icon">??</div>
      <h2>Access Denied</h2>
      <p>You need super-admin privileges to access this page.</p>
      <p class="access-denied__help">
        Contact your system administrator to request super-admin access.
      </p>
    </div>
  {:else if loading}
    <div class="loading">
      <div class="loading__spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if error}
    <div class="error-message">
      <p>? {error}</p>
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
                  {#if perm === '*'}
                    <span class="permission-tag permission-tag--wildcard">* All Permissions (Wildcard)</span>
                  {:else}
                    <span class="permission-tag">{perm}</span>
                  {/if}
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
        <div class="customer-search">
          <input
            type="text"
            bind:value={customerSearchQuery}
            placeholder="Search by name or ID..."
            class="search-input"
            onkeydown={(e) => e.key === 'Enter' && handleCustomerSearch()}
          />
          <button class="search-button" onclick={handleCustomerSearch}>Search</button>
        </div>

        {#if customersLoading}
          <div class="loading">
            <div class="loading__spinner"></div>
            <p>Loading customers...</p>
          </div>
        {:else if customersError}
          <ErrorDisplay
            error={customersError}
            onRetry={loadCustomers}
            retryText="Retry"
            minHeight="300px"
          />
        {:else if filteredCustomers.length === 0}
          <div class="empty-state">
            <div class="empty-state__icon">👥</div>
            <div class="empty-state__title">No customers found</div>
            <div class="empty-state__subtitle">Try adjusting your search criteria</div>
          </div>
        {:else}
          <!-- Table Toolbar -->
          <div class="table-toolbar">
            <div class="stats-bar">
              <div class="stat-item">
                <div class="stat-label">Total Customers</div>
                <div class="stat-value">{customers.length}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Filtered Results</div>
                <div class="stat-value">{filteredCustomers.length}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Super Admins</div>
                <div class="stat-value">{customers.filter(c => c.isSuperAdmin).length}</div>
              </div>
            </div>
            
            <!-- Column Visibility Toggle -->
            <div class="column-menu-wrapper">
              <button 
                class="column-menu-toggle" 
                onclick={() => showColumnMenu = !showColumnMenu}
                title="Configure columns"
              >
                <span class="column-icon">⚙</span>
                Columns
              </button>
              
              {#if showColumnMenu}
                <div class="column-menu">
                  <div class="column-menu__header">Show/Hide Columns</div>
                  {#each columns as col}
                    <label class="column-menu__item">
                      <input 
                        type="checkbox" 
                        checked={col.visible}
                        onchange={() => toggleColumnVisibility(col.id)}
                        disabled={col.visible && columns.filter(c => c.visible).length <= 1}
                      />
                      {col.label}
                    </label>
                  {/each}
                  <div class="column-menu__hint">Drag column headers to reorder</div>
                </div>
              {/if}
            </div>
          </div>

          <div class="table-container" class:resizing={resizingColumn !== null}>
            <table class="data-table">
              <thead>
                <tr>
                  {#each visibleColumns as col (col.id)}
                    <th 
                      class="col-{col.id}"
                      class:sortable={col.sortable}
                      class:sorted={sortColumn === col.id}
                      class:drag-over={dragOverColumn === col.id}
                      style="width: {col.width}px; min-width: {col.minWidth}px;"
                      draggable="true"
                      ondragstart={(e) => handleDragStart(e, col.id)}
                      ondragover={(e) => handleDragOver(e, col.id)}
                      ondragleave={handleDragLeave}
                      ondrop={(e) => handleDrop(e, col.id)}
                      ondragend={handleDragEnd}
                    >
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div class="th-content" onclick={() => col.sortable && toggleSort(col.id)}>
                        <span class="th-label">{col.label}</span>
                        {#if col.sortable}
                          <span class="sort-icon">
                            {#if sortColumn === col.id}
                              {#if sortDirection === 'asc'}
                                ▲
                              {:else}
                                ▼
                              {/if}
                            {:else}
                              ⇅
                            {/if}
                          </span>
                        {/if}
                      </div>
                      <!-- Resize Handle -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div 
                        class="resize-handle"
                        onmousedown={(e) => startResize(e, col.id)}
                      ></div>
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each sortedCustomers as cust}
                  <tr>
                    {#each visibleColumns as col (col.id)}
                      <td class="col-{col.id}" style="width: {col.width}px; min-width: {col.minWidth}px;">
                        {#if col.id === 'displayName'}
                          <div class="customer-name-cell">
                            <span class="customer-display-name">{cust.displayName || 'Unknown'}</span>
                            {#if cust.isSuperAdmin}
                              <span class="super-admin-badge">Super Admin</span>
                            {/if}
                          </div>
                        {:else if col.id === 'customerId'}
                          <code class="customer-id-code">{cust.customerId}</code>
                        {:else if col.id === 'roles'}
                          {#if cust.roles && cust.roles.length > 0}
                            <div class="role-pills">
                              {#each cust.roles as role}
                                <span class="role-pill">{role}</span>
                              {/each}
                            </div>
                          {:else}
                            <span class="no-roles">No roles</span>
                          {/if}
                        {:else if col.id === 'status'}
                          <span class="status-pill status-pill--{cust.status || 'unknown'}">
                            {cust.status || 'unknown'}
                          </span>
                        {:else if col.id === 'lastLogin'}
                          {formatDate(cust.lastLogin)}
                        {:else if col.id === 'actions'}
                          <button class="table-action-btn" onclick={() => openEditRoles(cust)}>
                            Edit Roles
                          </button>
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            Showing {sortedCustomers.length} of {customers.length} customers
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

{#if selectedCustomer}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="modal-overlay" 
    onclick={closeEditModal}
    onkeydown={(e) => e.key === 'Escape' && closeEditModal()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="document">
      <header class="modal__header">
        <h2 id="modal-title">Edit Roles</h2>
        <button class="close-btn" onclick={closeEditModal} disabled={savingRoles} aria-label="Close">&times;</button>
      </header>
      <div class="modal__body">
        <div class="modal-customer-info">
          <p><strong>Customer:</strong> {selectedCustomer.displayName || 'Unknown'}</p>
          <p class="customer-id-small">{selectedCustomer.customerId}</p>
          {#if selectedCustomer.isSuperAdmin}
            <p class="super-admin-warning">This customer is a super admin</p>
          {/if}
        </div>
        <div class="roles-checklist">
          {#each roles as role}
            {@const isChecked = editingRoles.includes(role.name)}
            {@const protectionReason = isChecked ? getRoleProtectionReason(role.name) : null}
            {@const blockReason = !isChecked ? getAddBlockedReason(role.name) : null}
            {@const isProtected = protectionReason !== null}
            {@const isBlocked = blockReason !== null}
            {@const isDisabled = savingRoles || isProtected || isBlocked}
            <label 
              class="role-checkbox" 
              class:disabled={isDisabled}
              class:protected={isProtected}
              class:blocked={isBlocked}
              class:checked={isChecked}
              title={protectionReason || blockReason || ''}
            >
              <div class="role-checkbox__header">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onchange={() => toggleRole(role.name)}
                  disabled={isDisabled}
                />
                <span class="role-checkbox__name">{role.displayName}</span>
                {#if isProtected}
                  <span class="status-badge status-badge--protected">Protected</span>
                {:else if isBlocked}
                  <span class="status-badge status-badge--blocked">Blocked</span>
                {/if}
              </div>
              <small class="role-checkbox__description">{role.description}</small>
              {#if isProtected}
                <small class="protection-reason">{protectionReason}</small>
              {:else if isBlocked}
                <small class="protection-reason">{blockReason}</small>
              {/if}
            </label>
          {/each}
        </div>
        
        <!-- Show effective permissions - what the user can ACTUALLY do -->
        <div class="effective-permissions">
          <div class="effective-permissions__header">
            <h4>Effective Permissions ({effectivePermissions.length})</h4>
            {#if hasWildcardAccess}
              <span class="wildcard-badge">* Wildcard Access</span>
            {/if}
          </div>
          {#if hasWildcardAccess}
            <p class="effective-permissions__description">
              Has <strong>wildcard (*)</strong> permission - access to ALL system permissions:
            </p>
          {:else}
            <p class="effective-permissions__description">Based on assigned roles, this customer has access to:</p>
          {/if}
          <div class="effective-permissions__list">
            {#if effectivePermissions.length === 0}
              <span class="no-permissions">No permissions - no roles assigned</span>
            {:else}
              {#each effectivePermissions as perm}
                <span class="permission-chip">{perm}</span>
              {/each}
            {/if}
          </div>
        </div>
      </div>
      <footer class="modal__footer">
        <button class="modal-btn modal-btn--secondary" onclick={closeEditModal} disabled={savingRoles}>
          Cancel
        </button>
        <button
          class="modal-btn modal-btn--primary"
          onclick={() => updateCustomerRoles(selectedCustomer!.customerId, editingRoles)}
          disabled={savingRoles || !isDirty}
        >
          {savingRoles ? 'Saving...' : 'Save Changes'}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../../../../shared-styles/animations' as *;
  @use '../../../../../shared-styles/mixins' as *;

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

  .access-denied {
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-xxl);
    text-align: center;
    max-width: 500px;
    margin: var(--spacing-xxl) auto;
  }

  .access-denied .access-denied__icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg);
  }

  .access-denied h2 {
    color: var(--text);
    font-size: var(--font-size-xl);
    margin-bottom: var(--spacing-md);
  }

  .access-denied p {
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    margin-bottom: var(--spacing-sm);
  }

  .access-denied .access-denied__help {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-style: italic;
    margin-top: var(--spacing-lg);
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

  .permission-tag--wildcard {
    background: var(--primary-bg);
    color: var(--primary);
    font-weight: 600;
    font-family: var(--font-base);
    border: 1px solid var(--primary);
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
    padding: var(--spacing-lg);
  }

  .info-message {
    padding: var(--spacing-lg);
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    text-align: center;
  }

  .customer-search {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .search-button {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
  }

  .search-button:hover {
    background: var(--primary-hover);
  }

  // Table Toolbar
  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
  }

  // Stats Bar
  .stats-bar {
    display: flex;
    gap: var(--spacing-lg);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .stat-item {
    text-align: center;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent);
  }

  // Column Menu
  .column-menu-wrapper {
    position: relative;
  }

  .column-menu-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    
    &:hover {
      background: var(--card-hover);
      border-color: var(--accent);
    }
    
    .column-icon {
      font-size: 1rem;
    }
  }

  .column-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 200px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
    overflow: hidden;
  }

  .column-menu__header {
    padding: 10px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .column-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    font-size: 0.875rem;
    color: var(--text);
    cursor: pointer;
    transition: background 0.15s;
    
    &:hover {
      background: var(--card-hover);
    }
    
    input[type="checkbox"] {
      accent-color: var(--accent);
      width: 16px;
      height: 16px;
    }
  }

  .column-menu__hint {
    padding: 8px 12px;
    font-size: 0.7rem;
    color: var(--text-muted);
    background: var(--bg);
    border-top: 1px solid var(--border);
    font-style: italic;
  }

  // Empty state
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xxl, 48px);
    text-align: center;
    color: var(--text-muted);
    min-height: 300px;
    background: var(--card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .empty-state__icon {
    font-size: 2rem;
    margin-bottom: var(--spacing-md);
  }

  .empty-state__title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
    color: var(--text);
  }

  .empty-state__subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  // Table Container
  .table-container {
    flex: 1;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    overflow: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    position: sticky;
    top: 0;
    background: var(--bg);
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    z-index: 1;
    user-select: none;
    position: relative;
    transition: background 0.15s;
    
    &.sortable .th-content {
      cursor: pointer;
    }
    
    &.sortable:hover {
      background: var(--card);
    }
    
    &.sorted {
      color: var(--accent);
      background: var(--card);
    }
    
    &.drag-over {
      background: var(--accent);
      opacity: 0.3;
    }
    
    &[draggable="true"] {
      cursor: grab;
      
      &:active {
        cursor: grabbing;
      }
    }
  }
  
  .th-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    padding-right: 24px; // Leave room for resize handle
    height: 100%;
  }
  
  .th-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .sort-icon {
    font-size: 1rem;
    color: var(--accent);
    flex-shrink: 0;
    margin-left: 8px;
  }
  
  th.sorted .sort-icon {
    color: var(--accent);
  }
  
  // Resize Handle
  .resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    background: transparent;
    border-right: 2px solid transparent;
    transition: border-color 0.15s, background 0.15s;
    z-index: 2;
    
    &:hover,
    &:active {
      border-right-color: var(--accent);
      background: rgba(var(--accent-rgb, 255, 165, 0), 0.1);
    }
  }
  
  .table-container.resizing {
    cursor: col-resize;
    user-select: none;
    
    .data-table th,
    .data-table td {
      pointer-events: none;
    }
    
    .resize-handle {
      pointer-events: auto;
    }
  }

  .data-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  .data-table tbody tr {
    transition: background 0.15s;
    
    &:hover {
      background: var(--card-hover);
    }
  }

  // Column widths
  .col-name { width: 200px; }
  .col-id { width: 180px; }
  .col-roles { width: 200px; }
  .col-status { width: 100px; }
  .col-login { width: 150px; }
  .col-actions { width: 120px; text-align: right !important; }

  // Customer name cell
  .customer-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .customer-display-name {
    font-weight: 500;
    color: var(--text);
  }

  .super-admin-badge {
    padding: 2px 8px;
    background: var(--accent);
    color: var(--bg);
    border-radius: var(--radius-sm);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .customer-id-code {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    color: var(--text-muted);
    background: var(--bg);
    padding: 4px 8px;
    border-radius: var(--radius-sm);
  }

  // Role pills
  .role-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .role-pill {
    padding: 2px 8px;
    background: var(--primary-bg);
    color: var(--accent);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .no-roles {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.8rem;
  }

  // Status pill
  .status-pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-pill--active {
    background: var(--success-bg, rgba(74, 222, 128, 0.15));
    color: var(--success, #4ade80);
  }

  .status-pill--inactive, .status-pill--unknown {
    background: rgba(156, 163, 175, 0.15);
    color: var(--text-muted);
  }

  .status-pill--banned {
    background: var(--danger-bg, rgba(239, 68, 68, 0.15));
    color: var(--danger, #ef4444);
  }

  // Table action button
  .table-action-btn {
    @include arcade-button(var(--border), var(--border-light));
    padding: 6px 12px;
    font-size: 0.75rem;
    background: transparent;
    color: var(--text);
    
    &:hover:not(:disabled) {
      background: var(--bg);
      color: var(--text);
    }
  }

  // Table footer
  .table-footer {
    padding: var(--spacing-sm) var(--spacing-md);
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
  

  .status-badge {
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
  }

  .status-badge--active {
    background: var(--success-bg);
    color: var(--success);
  }

  .status-badge--suspended {
    background: var(--danger-bg);
    color: var(--danger);
  }

  .status-badge--unknown {
    background: var(--muted-bg);
    color: var(--text-muted);
  }

  .customer-last-login {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .action-button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all 0.2s ease;
  }

  .action-button:hover {
    background: var(--primary-bg);
    border-color: var(--primary);
    color: var(--primary);
  }

  .customers-count {
    margin-top: var(--spacing-md);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
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

  .close-btn {
    background: none;
    border: none;
    font-size: 32px;
    color: var(--text-secondary, var(--text-muted));
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
    
    &:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }
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
    transition: border-color 0.2s, background 0.2s;
  }

  .role-checkbox:hover:not(.disabled) {
    border-color: var(--primary);
  }

  .role-checkbox.checked {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb, 212, 175, 55), 0.08);
  }

  .role-checkbox__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .role-checkbox__name {
    font-weight: 600;
    color: var(--text);
  }

  .role-checkbox__description {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    margin-left: 24px;
  }

  .role-checkbox input {
    margin-right: var(--spacing-sm);
  }

  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 4px;
    margin-left: auto;
  }

  .status-badge--protected {
    background: var(--warning, #edae49);
    color: var(--bg, #1a1611);
  }

  .effective-permissions {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--bg-secondary, #252118);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .effective-permissions__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }

  .effective-permissions h4 {
    margin: 0;
    color: var(--text);
    font-size: var(--font-size-md);
  }

  .wildcard-badge {
    padding: 2px 8px;
    background: var(--primary);
    color: var(--bg, #1a1611);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 4px;
  }

  .effective-permissions__description {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .effective-permissions__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .permission-chip {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--primary-bg);
    color: var(--primary);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
  }

  .no-permissions {
    color: var(--text-muted);
    font-style: italic;
  }

  .role-checkbox.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .role-checkbox.protected {
    border-color: var(--warning, #edae49);
    background: rgba(237, 174, 73, 0.05);
  }

  .role-checkbox.blocked {
    border-color: var(--danger, #ef4444);
    background: rgba(239, 68, 68, 0.05);
  }

  .status-badge--blocked {
    background: var(--danger, #ef4444);
    color: var(--bg, #1a1611);
  }

  .protected-badge {
    display: inline-block;
    padding: 2px 8px;
    background: var(--warning, #edae49);
    color: var(--bg, #1a1611);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    border-radius: 4px;
    margin-left: 8px;
  }

  .protection-reason {
    color: var(--warning, #edae49);
    font-style: italic;
    margin-top: 4px;
  }

  .modal-customer-info {
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background: var(--bg);
    border-radius: var(--radius-md);
  }

  .modal-customer-info p {
    margin: 0 0 var(--spacing-xs) 0;
  }

  .customer-id-small {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .super-admin-warning {
    color: var(--warning);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .modal-btn--primary {
    @include arcade-button(var(--accent), var(--accent-dark));
  }

  .modal-btn--secondary {
    @include arcade-button(var(--border), var(--border-light));
    background: transparent;
    color: var(--text);
    
    &:hover:not(:disabled) {
      background: var(--bg-dark);
      color: var(--text);
    }
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
