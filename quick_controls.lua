--[[
================================================================================
OBS Quick Controls Dock (Lua)
================================================================================

Adds a floating dock to OBS with quick access buttons for:
- Triggering swap configs
- Toggling aspect ratio override
- Quick visibility controls

Author: OBS Animation System
Version: 1.0.0
================================================================================
--]]

obs = obslua

-- =============================================================================
-- Configuration
-- =============================================================================

local dock_created = false
local settings_ref = nil

-- Shared state with source_swap.lua (we read their configs)
local swap_script_settings = nil


-- =============================================================================
-- Logging
-- =============================================================================

local function log_info(msg)
    obs.script_log(obs.LOG_INFO, "[QuickCtrl] " .. msg)
end


-- =============================================================================
-- Dock Creation
-- =============================================================================

-- Note: OBS Lua doesn't have full dock support in all versions.
-- We'll create a properties-based interface that can be shown via the script settings.
-- For a true floating dock, OBS would need the C API or a newer Lua binding.

-- Alternative: We create hotkey-triggered actions and a simple status display


-- =============================================================================
-- Quick Actions via Hotkeys
-- =============================================================================

local hotkey_ids = {}

-- Toggle aspect override hotkey
local function toggle_aspect_override(pressed)
    if not pressed then return end
    
    -- Cycle through: 0 (off) -> 1 (preserve) -> 2 (stretch) -> 0
    if settings_ref then
        local current = obs.obs_data_get_int(settings_ref, "quick_override")
        local next_val = (current + 1) % 3
        obs.obs_data_set_int(settings_ref, "quick_override", next_val)
        
        local names = {"OFF", "PRESERVE", "STRETCH"}
        log_info("Aspect Override: " .. names[next_val + 1])
    end
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2>[EMOJI] Quick Controls v1.0</h2>
<p>Quick access buttons and hotkeys for animation scripts.</p>

<h3>Features:</h3>
<ul>
<li>Hotkey to cycle aspect override (Off [EMOJI] Preserve [EMOJI] Stretch)</li>
<li>Quick status display</li>
<li>Works alongside Source Swap script</li>
</ul>

<h3>Setup:</h3>
<ol>
<li>Load this script</li>
<li>Go to Settings [EMOJI] Hotkeys</li>
<li>Find "Quick: Cycle Aspect Override"</li>
<li>Assign a hotkey</li>
</ol>

<p><b>Tip:</b> Use this to quickly toggle aspect mode during a stream!</p>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- Status display
    obs.obs_properties_add_text(props, "h1", 
        "═══════════ QUICK STATUS ═══════════", obs.OBS_TEXT_INFO)
    
    -- Current override setting
    local override_list = obs.obs_properties_add_list(props, "quick_override", 
        "[PERF] Aspect Override", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_INT)
    obs.obs_property_list_add_int(override_list, "Off (use default)", 0)
    obs.obs_property_list_add_int(override_list, "Force PRESERVE", 1)
    obs.obs_property_list_add_int(override_list, "Force STRETCH", 2)
    
    -- Info
    obs.obs_properties_add_text(props, "h2", 
        "═══════════ HOTKEYS ═══════════", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "hotkey_info", 
        "Assign 'Quick: Cycle Aspect Override' in Settings [EMOJI] Hotkeys", obs.OBS_TEXT_INFO)
    
    -- Quick swap buttons (if swap configs exist)
    obs.obs_properties_add_text(props, "h3", 
        "═══════════ QUICK SWAPS ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_text(props, "swap_info", 
        "Use Source Swap script hotkeys for quick swaps", obs.OBS_TEXT_INFO)
    
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_int(settings, "quick_override", 0)
end

function script_update(settings)
    settings_ref = settings
    
    -- Sync with source_swap if possible
    -- (In a real implementation, we'd need inter-script communication)
end

function script_load(settings)
    settings_ref = settings
    
    -- Register hotkey for cycling aspect override
    hotkey_ids.cycle_aspect = obs.obs_hotkey_register_frontend(
        "quick_cycle_aspect",
        "Quick: Cycle Aspect Override",
        toggle_aspect_override
    )
    
    -- Load saved hotkey
    local hotkey_save = obs.obs_data_get_array(settings, "hotkey_cycle_aspect")
    if hotkey_save then
        obs.obs_hotkey_load(hotkey_ids.cycle_aspect, hotkey_save)
        obs.obs_data_array_release(hotkey_save)
    end
    
    log_info("Quick Controls loaded!")
    log_info("Assign hotkeys in Settings [EMOJI] Hotkeys")
end

function script_save(settings)
    -- Save hotkey bindings
    if hotkey_ids.cycle_aspect then
        local hotkey_save = obs.obs_hotkey_save(hotkey_ids.cycle_aspect)
        obs.obs_data_set_array(settings, "hotkey_cycle_aspect", hotkey_save)
        obs.obs_data_array_release(hotkey_save)
    end
end

function script_unload()
    if hotkey_ids.cycle_aspect then
        obs.obs_hotkey_unregister(hotkey_ids.cycle_aspect)
    end
    log_info("Quick Controls unloaded")
end
