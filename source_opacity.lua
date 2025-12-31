--[[
================================================================================
OBS Source Opacity Control (Lua)
================================================================================

Freely control the opacity of any source in your scenes with a simple slider.
When opacity is set to 100%, the filter is automatically removed to prevent
excessive filter overhead on your sources.

Features:
    - Real-time opacity slider (0-100%)
    - Automatic filter cleanup at 100% opacity
    - Works on any source type
    - Minimal performance footprint

Author: OBS Animation System
Version: 1.0.0
================================================================================
--]]

obs = obslua


-- =============================================================================
-- Configuration
-- =============================================================================

local OPACITY_FILTER_NAME = "_lua_opacity_control"

local settings_ref = nil

-- Source opacity configurations: { source_name = { opacity = 0-100 } }
local source_opacity_configs = {}


-- =============================================================================
-- Logging
-- =============================================================================

local function log_info(msg)
    obs.script_log(obs.LOG_INFO, "[OpacityCtrl] " .. msg)
end

local function log_error(msg)
    obs.script_log(obs.LOG_ERROR, "[OpacityCtrl] " .. msg)
end


-- =============================================================================
-- Source Enumeration
-- =============================================================================

local function get_all_source_names()
    local names = {}
    local sources = obs.obs_enum_sources()
    
    if sources ~= nil then
        for _, source in ipairs(sources) do
            local name = obs.obs_source_get_name(source)
            if name ~= nil and name ~= "" then
                table.insert(names, name)
            end
        end
        obs.source_list_release(sources)
    end
    
    table.sort(names)
    return names
end

local function get_source_by_name(source_name)
    local sources = obs.obs_enum_sources()
    local found_source = nil
    
    if sources ~= nil then
        for _, source in ipairs(sources) do
            if obs.obs_source_get_name(source) == source_name then
                found_source = source
                obs.obs_source_addref(source)
                break
            end
        end
        obs.source_list_release(sources)
    end
    
    return found_source
end


-- =============================================================================
-- Opacity Filter Management
-- =============================================================================

local function has_opacity_filter(source)
    if source == nil then return false end
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    if filter ~= nil then
        obs.obs_source_release(filter)
        return true
    end
    return false
end

local function ensure_opacity_filter(source, initial_opacity)
    if source == nil then return false end
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    
    if filter == nil then
        local filter_settings = obs.obs_data_create()
        obs.obs_data_set_double(filter_settings, "opacity", initial_opacity)
        
        local new_filter = obs.obs_source_create_private("color_filter_v2", OPACITY_FILTER_NAME, filter_settings)
        if new_filter == nil then
            new_filter = obs.obs_source_create_private("color_filter", OPACITY_FILTER_NAME, filter_settings)
        end
        
        if new_filter ~= nil then
            obs.obs_source_filter_add(source, new_filter)
            obs.obs_source_release(new_filter)
            obs.obs_data_release(filter_settings)
            return true
        end
        obs.obs_data_release(filter_settings)
        return false
    else
        obs.obs_source_release(filter)
        return true
    end
end

local function set_source_opacity(source, opacity_percent)
    if source == nil then return end
    
    local opacity_normalized = math.max(0.0, math.min(1.0, opacity_percent / 100.0))
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    if filter ~= nil then
        local filter_settings = obs.obs_source_get_settings(filter)
        obs.obs_data_set_double(filter_settings, "opacity", opacity_normalized)
        obs.obs_source_update(filter, filter_settings)
        obs.obs_data_release(filter_settings)
        obs.obs_source_release(filter)
    else
        ensure_opacity_filter(source, opacity_normalized)
    end
end

local function remove_opacity_filter(source)
    if source == nil then return end
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    if filter ~= nil then
        obs.obs_source_filter_remove(source, filter)
        obs.obs_source_release(filter)
    end
end


-- =============================================================================
-- Apply Opacity (Main Logic)
-- =============================================================================

local function apply_opacity_to_source(source_name, opacity_percent)
    local source = get_source_by_name(source_name)
    if source == nil then
        log_error("Source not found: " .. source_name)
        return false
    end
    
    if opacity_percent >= 100 then
        -- At full opacity, remove the filter to reduce overhead
        if has_opacity_filter(source) then
            remove_opacity_filter(source)
            log_info("Removed filter from '" .. source_name .. "' (100% opacity)")
        end
    else
        -- Apply opacity filter
        set_source_opacity(source, opacity_percent)
        log_info("Set '" .. source_name .. "' opacity to " .. opacity_percent .. "%")
    end
    
    obs.obs_source_release(source)
    return true
end


-- =============================================================================
-- Configuration Persistence
-- =============================================================================

local function load_opacity_configs(settings)
    source_opacity_configs = {}
    local configs_array = obs.obs_data_get_array(settings, "opacity_configs")
    if configs_array == nil then return end
    
    local count = obs.obs_data_array_count(configs_array)
    for i = 0, count - 1 do
        local item = obs.obs_data_array_item(configs_array, i)
        local source_name = obs.obs_data_get_string(item, "source_name")
        local opacity = obs.obs_data_get_int(item, "opacity")
        
        if source_name ~= nil and source_name ~= "" then
            source_opacity_configs[source_name] = { opacity = opacity }
        end
        obs.obs_data_release(item)
    end
    obs.obs_data_array_release(configs_array)
    
    local count_loaded = 0
    for _ in pairs(source_opacity_configs) do count_loaded = count_loaded + 1 end
    log_info("Loaded " .. count_loaded .. " opacity configs")
end

local function save_opacity_configs(settings)
    local configs_array = obs.obs_data_array_create()
    
    for source_name, config in pairs(source_opacity_configs) do
        local item = obs.obs_data_create()
        obs.obs_data_set_string(item, "source_name", source_name)
        obs.obs_data_set_int(item, "opacity", config.opacity)
        obs.obs_data_array_push_back(configs_array, item)
        obs.obs_data_release(item)
    end
    
    obs.obs_data_set_array(settings, "opacity_configs", configs_array)
    obs.obs_data_array_release(configs_array)
end

local function restore_saved_opacities()
    for source_name, config in pairs(source_opacity_configs) do
        apply_opacity_to_source(source_name, config.opacity)
    end
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2> Source Opacity Control v1.0</h2>
<p>Freely control the opacity of any source.</p>

<h3>Features:</h3>
<ul>
    <li><b>Real-time slider</b> - Adjust opacity 0-100%</li>
    <li><b>Auto-cleanup</b> - Filter removed at 100% (no overhead!)</li>
    <li><b>Persistent</b> - Settings saved across sessions</li>
</ul>

<h3>Usage:</h3>
<ol>
    <li>Select a source from the dropdown</li>
    <li>Adjust the opacity slider</li>
    <li>Click "Apply Opacity" to set it</li>
</ol>

<p><b>Pro Tip:</b> Setting opacity to 100% removes the filter entirely, keeping your source list clean!</p>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- Control Section
    obs.obs_properties_add_text(props, "h1", 
        "═══════════ OPACITY CONTROL ═══════════", obs.OBS_TEXT_INFO)
    
    -- Refresh button
    obs.obs_properties_add_button(props, "refresh_btn", "[EMOJI] Refresh Source List",
        function(props, p)
            return true
        end)
    
    -- Source dropdown
    local source_list = obs.obs_properties_add_list(props, "selected_source", "Source",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(source_list, "(Select a source)", "")
    
    local all_sources = get_all_source_names()
    for _, name in ipairs(all_sources) do
        obs.obs_property_list_add_string(source_list, name, name)
    end
    
    -- Opacity slider
    obs.obs_properties_add_int_slider(props, "opacity_value", "Opacity (%)", 0, 100, 1)
    
    -- Apply button
    obs.obs_properties_add_button(props, "apply_btn", "[OK] Apply Opacity",
        function(props, p)
            if settings_ref == nil then return false end
            
            local source_name = obs.obs_data_get_string(settings_ref, "selected_source")
            local opacity = obs.obs_data_get_int(settings_ref, "opacity_value")
            
            if source_name == nil or source_name == "" then
                log_error("Select a source first, please!")
                return false
            end
            
            local success = apply_opacity_to_source(source_name, opacity)
            if success then
                source_opacity_configs[source_name] = { opacity = opacity }
                save_opacity_configs(settings_ref)
            end
            
            return true
        end)
    
    -- Managed Sources Section
    obs.obs_properties_add_text(props, "h2", 
        "═══════════ MANAGED SOURCES ═══════════", obs.OBS_TEXT_INFO)
    
    -- Remove source dropdown
    local remove_list = obs.obs_properties_add_list(props, "remove_source", "Source to Reset",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(remove_list, "(Select)", "")
    
    for source_name, _ in pairs(source_opacity_configs) do
        local config = source_opacity_configs[source_name]
        local label = source_name .. " (" .. config.opacity .. "%)"
        obs.obs_property_list_add_string(remove_list, label, source_name)
    end
    
    -- Reset button (removes filter, restores to 100%)
    obs.obs_properties_add_button(props, "reset_btn", "[EMOJI]️ Reset to 100% (Remove Filter)",
        function(props, p)
            if settings_ref == nil then return false end
            
            local source_name = obs.obs_data_get_string(settings_ref, "remove_source")
            
            if source_name == nil or source_name == "" then
                log_error("Select a source to reset!")
                return false
            end
            
            local source = get_source_by_name(source_name)
            if source ~= nil then
                remove_opacity_filter(source)
                obs.obs_source_release(source)
            end
            
            source_opacity_configs[source_name] = nil
            save_opacity_configs(settings_ref)
            log_info("Reset '" .. source_name .. "' to 100% and removed config")
            
            return true
        end)
    
    -- Status Section
    obs.obs_properties_add_text(props, "h3", 
        "═══════════ STATUS ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "list_btn", "[EMOJI] List Managed Sources",
        function(props, p)
            log_info("=== Managed Opacity Sources ===")
            local count = 0
            for source_name, config in pairs(source_opacity_configs) do
                count = count + 1
                log_info(count .. ". " .. source_name .. " -> " .. config.opacity .. "%")
            end
            if count == 0 then
                log_info("No sources being managed")
            end
            return false
        end)
    
    obs.obs_properties_add_button(props, "cleanup_btn", " Remove All Filters",
        function(props, p)
            log_info("Removing all opacity control filters...")
            
            for source_name, _ in pairs(source_opacity_configs) do
                local source = get_source_by_name(source_name)
                if source ~= nil then
                    remove_opacity_filter(source)
                    obs.obs_source_release(source)
                end
            end
            
            source_opacity_configs = {}
            if settings_ref then
                save_opacity_configs(settings_ref)
            end
            
            log_info("All opacity filters removed!")
            return true
        end)
    
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_int(settings, "opacity_value", 100)
end

function script_update(settings)
    settings_ref = settings
end

function script_load(settings)
    settings_ref = settings
    log_info("Loading Source Opacity Control v1.0...")
    
    load_opacity_configs(settings)
    
    -- Restore saved opacities on load
    restore_saved_opacities()
    
    log_info("Loaded! " .. #get_all_source_names() .. " sources available.")
end

function script_save(settings)
    save_opacity_configs(settings)
end

function script_unload()
    log_info("Unloading Source Opacity Control...")
    -- Note: We intentionally do NOT remove filters on unload
    -- so the user's opacity settings persist visually
    log_info("Unloaded.")
end

