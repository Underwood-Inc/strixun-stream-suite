# Framework & Modularization Proposal

## [EMOJI] Current State Analysis

**app.js**: 1,132 lines - Too large, needs breaking down

### Current Structure Breakdown:
1. **Storage Backup & Export** (~340 lines) - Lines 14-352
2. **Recovery UI** (~40 lines) - Lines 354-390
3. **UI State Persistence** (~60 lines) - Lines 392-456
4. **UI Functions** (~120 lines) - Lines 458-570
5. **Module Wrappers** (~100 lines) - Lines 572-712
6. **Text Cycler UI Helpers** (~100 lines) - Lines 713-833
7. **Initialization** (~230 lines) - Lines 835-1067
8. **Keyboard Shortcuts** (~25 lines) - Lines 1069-1092
9. **Exports** (~35 lines) - Lines 1094-1130

##  Proposed Framework Architecture

### Core Framework (`assets/js/core/`)

```
core/
├── framework.js      # Core framework (DI, module registry, events)
├── module.js         # Base module class
├── router.js         # Page navigation/router
└── lifecycle.js      # App lifecycle hooks
```

### Feature Modules (`assets/js/modules/`)

```
modules/
├── backup/           # Backup & export functionality
│   ├── backup-manager.js
│   ├── export-handler.js
│   └── import-handler.js
├── ui-state/         # UI state persistence
│   └── ui-state-manager.js
├── navigation/       # Page navigation
│   └── router.js
├── keyboard/         # Keyboard shortcuts
│   └── shortcuts.js
└── initialization/   # App bootstrap
    └── bootstrap.js
```

## [EMOJI] Framework Features

### 1. **Dependency Injection System**
- Centralized dependency registry
- Lazy loading of dependencies
- Type-safe dependency resolution

### 2. **Module System**
- Base Module class with lifecycle hooks
- Automatic module registration
- Module dependency resolution
- Module communication via events

### 3. **Event System**
- Global event bus
- Module-scoped events
- Event middleware support

### 4. **Router/Navigation**
- Declarative route definitions
- Route guards (e.g., requires connection)
- Route lifecycle hooks

### 5. **Lifecycle Hooks**
- `beforeInit()` - Before module initialization
- `onInit()` - During initialization
- `afterInit()` - After initialization
- `onReady()` - When DOM is ready
- `onDestroy()` - Cleanup

## [EMOJI] Proposed Module Breakdown

### Module 1: Backup Manager (`modules/backup/backup-manager.js`)
**Extract from app.js lines 14-352**

```javascript
// Functions to extract:
- updateStorageStatus()
- getSelectedExportData()
- exportSelectedData()
- copyBackupToClipboard()
- importDataWithOptions()
- showImportDialog()
- forceStorageSync()
- exportAllData()
- importAllData()
- offerRecovery()
```

**Size**: ~340 lines  New module: ~300 lines

### Module 2: UI State Manager (`modules/ui-state/ui-state-manager.js`)
**Extract from app.js lines 392-456**

```javascript
// Functions to extract:
- saveUIState()
- loadUIState()
- setupUIStatePersistence()
- UI_FIELDS constant
- UI_CHECKBOXES constant
```

**Size**: ~65 lines  New module: ~80 lines

### Module 3: Navigation Router (`modules/navigation/router.js`)
**Extract from app.js lines 458-513**

```javascript
// Functions to extract:
- showPage()
- restoreActiveTab()
- Route definitions
- Route guards
```

**Size**: ~55 lines  New module: ~120 lines (with framework features)

### Module 4: Logger (`modules/logging/logger.js`)
**Extract from app.js lines 515-541**

```javascript
// Functions to extract:
- log()
- clearLog()
```

**Size**: ~27 lines  New module: ~50 lines (with enhancements)

### Module 5: Text Cycler UI (`modules/text-cycler-ui/text-cycler-ui.js`)
**Extract from app.js lines 713-833**

```javascript
// Functions to extract:
- updateTextCyclerMode()
- updateConfigIdPreview()
- getBrowserSourceUrl()
- updateBrowserSourceUrlPreview()
- copyBrowserSourceUrl()
- updateTransitionMode()
- updateTextSourceDropdown()
- loadTextSource()
```

**Size**: ~120 lines  New module: ~150 lines

### Module 6: Keyboard Shortcuts (`modules/keyboard/shortcuts.js`)
**Extract from app.js lines 1069-1092**

```javascript
// Functions to extract:
- Keyboard event handlers
- Shortcut definitions
```

**Size**: ~25 lines  New module: ~80 lines (with configurable shortcuts)

### Module 7: Bootstrap (`modules/initialization/bootstrap.js`)
**Extract from app.js lines 835-1067**

```javascript
// Functions to extract:
- DOMContentLoaded handler
- Module initialization order
- Dependency setup
```

**Size**: ~230 lines  New module: ~200 lines (with framework)

### Module 8: Module Wrappers (Keep in app.js or create `modules/wrappers/`)
**Extract from app.js lines 572-712**

These are thin wrappers - could stay in app.js or be auto-generated.

## [EMOJI] Framework Implementation

### Core Framework (`core/framework.js`)

```javascript
class Framework {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.events = new EventEmitter();
        this.initialized = false;
    }
    
    // Register a module
    register(name, moduleClass, deps = []) {
        this.modules.set(name, { class: moduleClass, deps });
    }
    
    // Get a dependency
    get(name) {
        return this.dependencies.get(name);
    }
    
    // Initialize all modules
    async init() {
        // Resolve dependencies
        // Initialize in order
        // Call lifecycle hooks
    }
}

// Global instance
window.AppFramework = new Framework();
```

### Base Module Class (`core/module.js`)

```javascript
class Module {
    constructor(framework, name) {
        this.framework = framework;
        this.name = name;
        this.deps = {};
    }
    
    // Lifecycle hooks
    beforeInit() {}
    onInit() {}
    afterInit() {}
    onReady() {}
    onDestroy() {}
    
    // Dependency injection
    require(name) {
        return this.framework.get(name);
    }
    
    // Event system
    emit(event, data) {
        this.framework.events.emit(event, data);
    }
    
    on(event, handler) {
        this.framework.events.on(event, handler);
    }
}
```

## [EMOJI] Migration Strategy

### Phase 1: Create Framework Core (Week 1)
1. Create `assets/js/core/` directory
2. Implement `framework.js` and `module.js`
3. Add basic event system
4. Test with one module

### Phase 2: Extract First Module (Week 1)
1. Extract Backup Manager
2. Convert to Module class
3. Update app.js to use it
4. Test thoroughly

### Phase 3: Extract Remaining Modules (Week 2)
1. Extract UI State Manager
2. Extract Navigation Router
3. Extract Logger
4. Extract Text Cycler UI
5. Extract Keyboard Shortcuts
6. Extract Bootstrap

### Phase 4: Cleanup & Optimization (Week 2)
1. Remove wrapper functions (or auto-generate)
2. Update all references
3. Add TypeScript definitions (optional)
4. Documentation

## [EMOJI] Expected Results

### Before:
- `app.js`: 1,132 lines
- Monolithic structure
- Hard to test
- Hard to maintain

### After:
- `app.js`: ~100 lines (just bootstrap)
- `core/framework.js`: ~200 lines
- `modules/backup/`: ~300 lines
- `modules/ui-state/`: ~80 lines
- `modules/navigation/`: ~120 lines
- `modules/logging/`: ~50 lines
- `modules/text-cycler-ui/`: ~150 lines
- `modules/keyboard/`: ~80 lines
- `modules/initialization/`: ~200 lines

**Total**: ~1,280 lines (slight increase due to framework overhead, but much better organized)

## [EMOJI] Benefits

1. **Better Organization**: Each module has a single responsibility
2. **Easier Testing**: Modules can be tested in isolation
3. **Better Maintainability**: Changes are localized
4. **Dependency Management**: Clear dependency graph
5. **Lifecycle Hooks**: Better control over initialization
6. **Event System**: Loose coupling between modules
7. **Scalability**: Easy to add new features
8. **Type Safety**: Can add JSDoc/TypeScript later

## [EMOJI] Alternative: Simpler Approach

If full framework is too much, we could:

1. **Just extract modules** without framework
2. Use simple module pattern (IIFE)
3. Keep dependency injection simple (pass deps to init)
4. Use global event emitter (simple)

This would be faster but less structured.

## [EMOJI] Recommendation

**Start with simpler approach**, then add framework features as needed:

1. Extract modules to separate files
2. Use simple dependency injection (pass deps to init)
3. Add event system later if needed
4. Keep it lightweight and fast

This gives us 80% of the benefits with 20% of the complexity.

