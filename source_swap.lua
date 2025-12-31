--[[
================================================================================
OBS Source Swap Script (Lua)
================================================================================

Smoothly swaps the position and size of two sources with animation.
Supports MULTIPLE swap configurations, each with its own hotkey!

v3.1.0:
- Added Temporary Aspect Override in settings
- Override supersedes global setting for all swaps
- Works for root sources and sources in groups

Author: OBS Animation System
Version: 3.1.0
================================================================================
--]]

obs = obslua

-- =============================================================================
-- Configuration
-- =============================================================================

local animation_duration = 400
local easing_type = "ease_in_out"
local debug_mode = true
local preserve_aspect = true  -- Default: use SCALE_INNER (no distortion)
local temp_override = 0       -- 0 = off, 1 = force preserve, 2 = force stretch

local swap_configs = {}
local is_animating = false
local anim_start_time = 0
local anim_data = nil
local settings_ref = nil


-- =============================================================================
-- Easing Functions
-- =============================================================================

local function ease_linear(t) return t end
local function ease_in(t) return t * t end
local function ease_out(t) return 1 - (1 - t) * (1 - t) end
local function ease_in_out(t)
    if t < 0.5 then return 2 * t * t
    else return 1 - math.pow(-2 * t + 2, 2) / 2 end
end
local function ease_back(t)
    local c1, c3 = 1.70158, 2.70158
    return 1 + c3 * math.pow(t - 1, 3) + c1 * math.pow(t - 1, 2)
end
local function ease_bounce(t)
    local n1, d1 = 7.5625, 2.75
    if t < 1 / d1 then return n1 * t * t
    elseif t < 2 / d1 then t = t - 1.5 / d1; return n1 * t * t + 0.75
    elseif t < 2.5 / d1 then t = t - 2.25 / d1; return n1 * t * t + 0.9375
    else t = t - 2.625 / d1; return n1 * t * t + 0.984375 end
end

local easing_functions = {
    linear = ease_linear, ease_in = ease_in, ease_out = ease_out,
    ease_in_out = ease_in_out, back = ease_back, bounce = ease_bounce
}


-- =============================================================================
-- Logging
-- =============================================================================

local function log_info(msg) obs.script_log(obs.LOG_INFO, "[Swap] " .. msg) end
local function log_error(msg) obs.script_log(obs.LOG_ERROR, "[Swap] " .. msg) end
local function log_debug(msg) if debug_mode then obs.script_log(obs.LOG_INFO, "[Swap:DBG] " .. msg) end end
local function lerp(a, b, t) return a + (b - a) * t end


-- =============================================================================
-- Source Finding with Group Detection
-- =============================================================================

local function find_scene_item_with_parent(scene, source_name, parent_group)
    if scene == nil then return nil, nil end
    local items = obs.obs_scene_enum_items(scene)
    if items == nil then return nil, nil end
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        if source then
            local name = obs.obs_source_get_name(source)
            if name == source_name then
                obs.sceneitem_list_release(items)
                return item, parent_group
            end
            if obs.obs_sceneitem_is_group(item) then
                local group_scene = obs.obs_sceneitem_group_get_scene(item)
                if group_scene then
                    local found, found_parent = find_scene_item_with_parent(group_scene, source_name, item)
                    if found then
                        obs.sceneitem_list_release(items)
                        return found, found_parent
                    end
                end
            end
        end
    end
    obs.sceneitem_list_release(items)
    return nil, nil
end

local function get_scene_item_with_parent(source_name)
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then return nil, nil end
    local scene = obs.obs_scene_from_source(scene_source)
    local item, parent = find_scene_item_with_parent(scene, source_name, nil)
    obs.obs_source_release(scene_source)
    return item, parent
end

local function get_scene_source_names()
    local names = {}
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then return names end
    local scene = obs.obs_scene_from_source(scene_source)
    if scene == nil then
        obs.obs_source_release(scene_source)
        return names
    end
    
    local function enumerate(s, prefix)
        local items = obs.obs_scene_enum_items(s)
        if items then
            for _, item in ipairs(items) do
                local source = obs.obs_sceneitem_get_source(item)
                if source then
                    local name = obs.obs_source_get_name(source)
                    if name and name ~= "" then
                        local display = prefix ~= "" and (prefix .. "  " .. name) or name
                        table.insert(names, {display = display, name = name})
                    end
                    if obs.obs_sceneitem_is_group(item) then
                        local gs = obs.obs_sceneitem_group_get_scene(item)
                        if gs then enumerate(gs, name) end
                    end
                end
            end
            obs.sceneitem_list_release(items)
        end
    end
    enumerate(scene, "")
    obs.obs_source_release(scene_source)
    return names
end


-- =============================================================================
-- Transform Functions
-- =============================================================================

-- Get group's transform (position and scale) - SIMPLE version
local function get_group_transform(group_item)
    if group_item == nil then
        return 0, 0, 1.0, 1.0
    end
    
    local pos = obs.vec2()
    obs.obs_sceneitem_get_pos(group_item, pos)
    
    local scale = obs.vec2()
    obs.obs_sceneitem_get_scale(group_item, scale)
    
    -- Ensure scale is never zero
    local sx = (scale.x ~= 0) and scale.x or 1.0
    local sy = (scale.y ~= 0) and scale.y or 1.0
    
    return pos.x, pos.y, sx, sy
end

-- Capture full transform with screen-space calculations
local function capture_transform(scene_item, parent_group, name)
    if scene_item == nil then return nil end
    
    local source = obs.obs_sceneitem_get_source(scene_item)
    if source == nil then return nil end
    
    -- Local position (relative to parent)
    local pos = obs.vec2()
    obs.obs_sceneitem_get_pos(scene_item, pos)
    
    -- Scale
    local scale = obs.vec2()
    obs.obs_sceneitem_get_scale(scene_item, scale)
    
    -- Bounds
    local bounds = obs.vec2()
    obs.obs_sceneitem_get_bounds(scene_item, bounds)
    local bounds_type = obs.obs_sceneitem_get_bounds_type(scene_item)
    local uses_bounds = (bounds_type ~= obs.OBS_BOUNDS_NONE and bounds.x > 0 and bounds.y > 0)
    
    -- Base dimensions
    local base_w = obs.obs_source_get_width(source)
    local base_h = obs.obs_source_get_height(source)
    if base_w == 0 then base_w = 1920 end
    if base_h == 0 then base_h = 1080 end
    
    -- Group transform
    local gx, gy, gsx, gsy = get_group_transform(parent_group)
    local in_group = (parent_group ~= nil)
    
    -- Calculate LOCAL size (size in parent's coordinate system)
    local local_w, local_h
    if uses_bounds then
        local_w, local_h = bounds.x, bounds.y
    else
        local_w = base_w * scale.x
        local_h = base_h * scale.y
    end
    
    -- Calculate SCREEN position (absolute)
    local screen_x = gx + (pos.x * gsx)
    local screen_y = gy + (pos.y * gsy)
    
    -- Calculate SCREEN size (what you see on canvas)
    local screen_w = local_w * gsx
    local screen_h = local_h * gsy
    
    local t = {
        item = scene_item,
        parent_group = parent_group,
        name = name,
        in_group = in_group,
        
        -- Group info
        group_x = gx, group_y = gy,
        group_sx = gsx, group_sy = gsy,
        
        -- Local values
        local_x = pos.x, local_y = pos.y,
        local_w = local_w, local_h = local_h,
        
        -- Screen values (what you see)
        screen_x = screen_x, screen_y = screen_y,
        screen_w = screen_w, screen_h = screen_h,
        
        -- Original raw values for bounds/scale mode
        scale_x = scale.x, scale_y = scale.y,
        bounds_x = bounds.x, bounds_y = bounds.y,
        bounds_type = bounds_type,
        uses_bounds = uses_bounds,
        base_w = base_w, base_h = base_h
    }
    
    log_debug(name .. ": in_group=" .. (in_group and "Y" or "N") ..
              " group_pos(" .. string.format("%.0f,%.0f", gx, gy) .. ")" ..
              " group_scale(" .. string.format("%.2f,%.2f", gsx, gsy) .. ")" ..
              " local_pos(" .. string.format("%.0f,%.0f", pos.x, pos.y) .. ")" ..
              " local_size(" .. string.format("%.0f,%.0f", local_w, local_h) .. ")" ..
              " screen_pos(" .. string.format("%.0f,%.0f", screen_x, screen_y) .. ")" ..
              " screen_size(" .. string.format("%.0f,%.0f", screen_w, screen_h) .. ")" ..
              " uses_bounds=" .. (uses_bounds and "Y" or "N") ..
              " base=" .. string.format("%.0fx%.0f", base_w, base_h))
    
    return t
end

-- Apply LOCAL transform directly (no coordinate conversion)
local function apply_local_transform(item, local_x, local_y, local_w, local_h, bounds_type)
    if item == nil then return end
    
    local pos = obs.vec2()
    pos.x = local_x
    pos.y = local_y
    obs.obs_sceneitem_set_pos(item, pos)
    
    local bounds = obs.vec2()
    bounds.x = math.max(1, local_w)
    bounds.y = math.max(1, local_h)
    obs.obs_sceneitem_set_bounds(item, bounds)
    obs.obs_sceneitem_set_bounds_type(item, bounds_type)
end

-- Finalize sizing after swap - respect temp_override and preserve_aspect settings
local function finalize_sizing(t)
    if t == nil or t.item == nil then return end
    
    -- Determine what bounds type to use based on override/preserve settings
    local final_type
    
    if temp_override ~= 0 then
        -- Override is active - use forced setting
        if temp_override == 1 then
            final_type = obs.OBS_BOUNDS_SCALE_INNER
        else
            final_type = obs.OBS_BOUNDS_STRETCH
        end
    elseif t.uses_bounds then
        -- Restore original bounds type
        final_type = t.bounds_type
    else
        -- Use global preserve_aspect setting
        final_type = preserve_aspect and obs.OBS_BOUNDS_SCALE_INNER or obs.OBS_BOUNDS_STRETCH
    end
    
    obs.obs_sceneitem_set_bounds_type(t.item, final_type)
end


-- =============================================================================
-- Animation
-- =============================================================================

local function animation_tick()
    if not is_animating or anim_data == nil then return end
    
    local elapsed = (obs.os_gettime_ns() / 1000000) - anim_start_time
    local progress = math.min(1.0, elapsed / animation_duration)
    local eased = (easing_functions[easing_type] or ease_in_out)(progress)
    
    -- Animate A to B's LOCAL position/size
    local a = anim_data.a
    apply_local_transform(
        a.t.item,
        lerp(a.start_x, a.end_x, eased),
        lerp(a.start_y, a.end_y, eased),
        lerp(a.start_w, a.end_w, eased),
        lerp(a.start_h, a.end_h, eased),
        a.bounds_type
    )
    
    -- Animate B to A's LOCAL position/size
    local b = anim_data.b
    apply_local_transform(
        b.t.item,
        lerp(b.start_x, b.end_x, eased),
        lerp(b.start_y, b.end_y, eased),
        lerp(b.start_w, b.end_w, eased),
        lerp(b.start_h, b.end_h, eased),
        b.bounds_type
    )
    
    if progress >= 1.0 then
        is_animating = false
        obs.timer_remove(animation_tick)
        
        -- Finalize sizing
        finalize_sizing(anim_data.a.t)
        finalize_sizing(anim_data.b.t)
        
        log_info("Swap complete!")
    end
end

local function execute_swap(source_a_name, source_b_name, config_name)
    if is_animating then
        log_info("Already animating")
        return
    end
    
    -- Determine aspect ratio setting: temp_override supersedes global
    local use_preserve
    if temp_override == 1 then
        use_preserve = true   -- Force preserve
        log_info("Using TEMPORARY OVERRIDE: Preserve Aspect")
    elseif temp_override == 2 then
        use_preserve = false  -- Force stretch
        log_info("Using TEMPORARY OVERRIDE: Stretch")
    else
        use_preserve = preserve_aspect  -- Use global default
    end
    
    local item_a, parent_a = get_scene_item_with_parent(source_a_name)
    local item_b, parent_b = get_scene_item_with_parent(source_b_name)
    
    if item_a == nil then
        log_error("Source A '" .. source_a_name .. "' not found")
        return
    end
    if item_b == nil then
        log_error("Source B '" .. source_b_name .. "' not found")
        return
    end
    
    log_info("=== Swap: " .. source_a_name .. " <-> " .. source_b_name .. " ===")
    
    local t_a = capture_transform(item_a, parent_a, source_a_name)
    local t_b = capture_transform(item_b, parent_b, source_b_name)
    
    if t_a == nil or t_b == nil then
        log_error("Failed to capture transforms")
        return
    end
    
    log_info("A: " .. (t_a.in_group and "[GROUPED]" or "[ROOT]") ..
             " local(" .. math.floor(t_a.local_x) .. "," .. math.floor(t_a.local_y) .. 
             ") " .. math.floor(t_a.local_w) .. "x" .. math.floor(t_a.local_h))
    log_info("B: " .. (t_b.in_group and "[GROUPED]" or "[ROOT]") ..
             " local(" .. math.floor(t_b.local_x) .. "," .. math.floor(t_b.local_y) .. 
             ") " .. math.floor(t_b.local_w) .. "x" .. math.floor(t_b.local_h))
    
    -- Determine bounds type for animation
    local bounds_type_a, bounds_type_b
    
    -- If temp_override is active, ALWAYS use it (ignores source's original bounds)
    if temp_override ~= 0 then
        -- Override is active - force the setting on BOTH sources
        local forced_type = use_preserve and obs.OBS_BOUNDS_SCALE_INNER or obs.OBS_BOUNDS_STRETCH
        bounds_type_a = forced_type
        bounds_type_b = forced_type
    else
        -- No override - respect original bounds type if set, else use global
        if t_a.uses_bounds then
            bounds_type_a = t_a.bounds_type
        else
            bounds_type_a = use_preserve and obs.OBS_BOUNDS_SCALE_INNER or obs.OBS_BOUNDS_STRETCH
        end
        
        if t_b.uses_bounds then
            bounds_type_b = t_b.bounds_type
        else
            bounds_type_b = use_preserve and obs.OBS_BOUNDS_SCALE_INNER or obs.OBS_BOUNDS_STRETCH
        end
    end
    
    log_info("Bounds: A=" .. bounds_type_a .. " B=" .. bounds_type_b .. 
             " (override=" .. temp_override .. ")")
    
    -- Setup animation: swap LOCAL positions and sizes
    anim_data = {
        a = {
            t = t_a,
            start_x = t_a.local_x, start_y = t_a.local_y,
            start_w = t_a.local_w, start_h = t_a.local_h,
            end_x = t_b.local_x, end_y = t_b.local_y,
            end_w = t_b.local_w, end_h = t_b.local_h,
            bounds_type = bounds_type_a
        },
        b = {
            t = t_b,
            start_x = t_b.local_x, start_y = t_b.local_y,
            start_w = t_b.local_w, start_h = t_b.local_h,
            end_x = t_a.local_x, end_y = t_a.local_y,
            end_w = t_a.local_w, end_h = t_a.local_h,
            bounds_type = bounds_type_b
        }
    }
    
    anim_start_time = obs.os_gettime_ns() / 1000000
    is_animating = true
    obs.timer_add(animation_tick, 16)
end


-- =============================================================================
-- Config Management
-- =============================================================================

local function create_hotkey_callback(idx)
    return function(pressed)
        if pressed and swap_configs[idx] then
            local c = swap_configs[idx]
            execute_swap(c.source_a, c.source_b, c.name)
        end
    end
end

local function register_hotkey(config, idx)
    if config.hotkey_id and config.hotkey_id ~= obs.OBS_INVALID_HOTKEY_ID then
        obs.obs_hotkey_unregister(config.hotkey_id)
    end
    config.hotkey_id = obs.obs_hotkey_register_frontend("swap_" .. idx, "Swap: " .. config.name, create_hotkey_callback(idx))
    return config.hotkey_id
end

local function load_configs(settings)
    swap_configs = {}
    local arr = obs.obs_data_get_array(settings, "swap_configs")
    if arr == nil then return end
    
    for i = 0, obs.obs_data_array_count(arr) - 1 do
        local item = obs.obs_data_array_item(arr, i)
        local config = {
            name = obs.obs_data_get_string(item, "name"),
            source_a = obs.obs_data_get_string(item, "source_a"),
            source_b = obs.obs_data_get_string(item, "source_b"),
            hotkey_id = obs.OBS_INVALID_HOTKEY_ID
        }
        if config.name ~= "" then
            table.insert(swap_configs, config)
            register_hotkey(config, #swap_configs)
            local hk = obs.obs_data_get_array(item, "hotkey")
            if hk then
                obs.obs_hotkey_load(config.hotkey_id, hk)
                obs.obs_data_array_release(hk)
            end
        end
        obs.obs_data_release(item)
    end
    obs.obs_data_array_release(arr)
    log_info("Loaded " .. #swap_configs .. " configs")
end

local function save_configs(settings)
    local arr = obs.obs_data_array_create()
    for _, config in ipairs(swap_configs) do
        local item = obs.obs_data_create()
        obs.obs_data_set_string(item, "name", config.name)
        obs.obs_data_set_string(item, "source_a", config.source_a)
        obs.obs_data_set_string(item, "source_b", config.source_b)
        if config.hotkey_id and config.hotkey_id ~= obs.OBS_INVALID_HOTKEY_ID then
            local hk = obs.obs_hotkey_save(config.hotkey_id)
            obs.obs_data_set_array(item, "hotkey", hk)
            obs.obs_data_array_release(hk)
        end
        obs.obs_data_array_push_back(arr, item)
        obs.obs_data_release(item)
    end
    obs.obs_data_set_array(settings, "swap_configs", arr)
    obs.obs_data_array_release(arr)
end

local function add_config(name, src_a, src_b)
    for _, c in ipairs(swap_configs) do
        if c.name == name then
            log_error("Config '" .. name .. "' already exists")
            return false
        end
    end
    local config = { 
        name = name, 
        source_a = src_a, 
        source_b = src_b, 
        hotkey_id = obs.OBS_INVALID_HOTKEY_ID 
    }
    table.insert(swap_configs, config)
    register_hotkey(config, #swap_configs)
    log_info("Added: " .. name .. " (" .. src_a .. " <-> " .. src_b .. ")")
    return true
end

local function update_config(name, new_src_a, new_src_b)
    for _, c in ipairs(swap_configs) do
        if c.name == name then
            c.source_a = new_src_a
            c.source_b = new_src_b
            log_info("Updated: " .. name .. " -> " .. new_src_a .. " <-> " .. new_src_b)
            return true
        end
    end
    return false
end

local function remove_config(name)
    for i, c in ipairs(swap_configs) do
        if c.name == name then
            if c.hotkey_id and c.hotkey_id ~= obs.OBS_INVALID_HOTKEY_ID then
                obs.obs_hotkey_unregister(c.hotkey_id)
            end
            table.remove(swap_configs, i)
            log_info("Removed: " .. name)
            return true
        end
    end
    return false
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2>Source Swap v3.1</h2>
<p>Swap position AND size of two sources with smooth animation.</p>

<h3>Features:</h3>
<ul>
<li>[PERF] Temporary Aspect Override in settings!</li>
<li>Works for root sources and sources in groups</li>
<li>Unlimited configurations with hotkeys</li>
<li>No progressive shrinking</li>
</ul>

<p><b>Temp Override:</b> Set it to force Preserve or Stretch for ALL swaps 
until you set it back to Off.</p>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end

function script_properties()
    local props = obs.obs_properties_create()
    local sources = get_scene_source_names()
    
    -- Settings
    obs.obs_properties_add_text(props, "h1", "═══════════ SETTINGS ═══════════", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_int_slider(props, "duration", "Duration (ms)", 100, 2000, 50)
    
    local el = obs.obs_properties_add_list(props, "easing", "Easing", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(el, "Ease In/Out", "ease_in_out")
    obs.obs_property_list_add_string(el, "Ease Out", "ease_out")
    obs.obs_property_list_add_string(el, "Ease In", "ease_in")
    obs.obs_property_list_add_string(el, "Linear", "linear")
    obs.obs_property_list_add_string(el, "Back", "back")
    obs.obs_property_list_add_string(el, "Bounce", "bounce")
    
    obs.obs_properties_add_bool(props, "preserve_aspect", "Preserve Aspect Ratio (default)")
    
    -- Temporary override that supersedes ALL config settings
    local override = obs.obs_properties_add_list(props, "temp_override", "[PERF] Temporary Override", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_INT)
    obs.obs_property_list_add_int(override, "Off (use config/global)", 0)
    obs.obs_property_list_add_int(override, "Force PRESERVE aspect", 1)
    obs.obs_property_list_add_int(override, "Force STRETCH to fill", 2)
    
    obs.obs_properties_add_bool(props, "debug_mode", "Debug Logging")
    
    -- Add config
    obs.obs_properties_add_text(props, "h2", "═══════════ ADD SWAP ═══════════", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_button(props, "refresh", "→ Refresh Sources", function() return true end)
    obs.obs_properties_add_text(props, "new_name", "Config Name", obs.OBS_TEXT_DEFAULT)
    
    local la = obs.obs_properties_add_list(props, "new_a", "Source A", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    local lb = obs.obs_properties_add_list(props, "new_b", "Source B", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(la, "(Select)", "")
    obs.obs_property_list_add_string(lb, "(Select)", "")
    for _, s in ipairs(sources) do
        obs.obs_property_list_add_string(la, s.display, s.name)
        obs.obs_property_list_add_string(lb, s.display, s.name)
    end
    
    obs.obs_properties_add_button(props, "add_btn", "[ADD] Add Config", function()
        if not settings_ref then return false end
        local n = obs.obs_data_get_string(settings_ref, "new_name")
        local a = obs.obs_data_get_string(settings_ref, "new_a")
        local b = obs.obs_data_get_string(settings_ref, "new_b")
        if n == "" then log_error("Need name"); return false end
        if a == "" or b == "" then log_error("Select both sources"); return false end
        if a == b then log_error("Sources must differ"); return false end
        if add_config(n, a, b) then
            save_configs(settings_ref)
            obs.obs_data_set_string(settings_ref, "new_name", "")
            return true  -- Refresh UI
        end
        return false
    end)
    
    -- Current Configs
    obs.obs_properties_add_text(props, "h3", "═══════════ CONFIGS (" .. #swap_configs .. ") ═══════════", obs.OBS_TEXT_INFO)
    
    if #swap_configs == 0 then
        obs.obs_properties_add_text(props, "none", "No configs yet. Add one above!", obs.OBS_TEXT_INFO)
    else
        for i, c in ipairs(swap_configs) do
            local label = string.format("%d. %s: %s  %s", i, c.name, c.source_a, c.source_b)
            obs.obs_properties_add_text(props, "cfg_" .. i, label, obs.OBS_TEXT_INFO)
            obs.obs_properties_add_button(props, "swap_" .. i, "   → Swap Now", function()
                execute_swap(c.source_a, c.source_b, c.name)
                return false
            end)
        end
    end
    
    -- Edit
    obs.obs_properties_add_text(props, "h4", "═══════════ EDIT ═══════════", obs.OBS_TEXT_INFO)
    
    local ec = obs.obs_properties_add_list(props, "edit_cfg", "Config to Edit", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(ec, "(Select)", "")
    for _, c in ipairs(swap_configs) do
        obs.obs_property_list_add_string(ec, c.name, c.name)
    end
    
    local ea = obs.obs_properties_add_list(props, "edit_a", "New Source A", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    local eb = obs.obs_properties_add_list(props, "edit_b", "New Source B", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(ea, "(Select)", "")
    obs.obs_property_list_add_string(eb, "(Select)", "")
    for _, s in ipairs(sources) do
        obs.obs_property_list_add_string(ea, s.display, s.name)
        obs.obs_property_list_add_string(eb, s.display, s.name)
    end
    
    obs.obs_properties_add_button(props, "edit_btn", " Update Config", function()
        if not settings_ref then return false end
        local n = obs.obs_data_get_string(settings_ref, "edit_cfg")
        local a = obs.obs_data_get_string(settings_ref, "edit_a")
        local b = obs.obs_data_get_string(settings_ref, "edit_b")
        if n == "" then log_error("Select config"); return false end
        if a == "" or b == "" then log_error("Select sources"); return false end
        if a == b then log_error("Different sources"); return false end
        if update_config(n, a, b) then
            save_configs(settings_ref)
            return true  -- Refresh UI
        end
        return false
    end)
    
    -- Remove
    obs.obs_properties_add_text(props, "h5", "═══════════ REMOVE ═══════════", obs.OBS_TEXT_INFO)
    local rc = obs.obs_properties_add_list(props, "rem_cfg", "Config", obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(rc, "(Select)", "")
    for _, c in ipairs(swap_configs) do
        obs.obs_property_list_add_string(rc, c.name, c.name)
    end
    obs.obs_properties_add_button(props, "rem_btn", "✗ Remove", function()
        if not settings_ref then return false end
        local n = obs.obs_data_get_string(settings_ref, "rem_cfg")
        if n ~= "" and remove_config(n) then
            save_configs(settings_ref)
            return true  -- Refresh UI
        end
        return false
    end)
    
    -- Info
    obs.obs_properties_add_text(props, "h6", "═══════════ INFO ═══════════", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "tip", " ★ Hotkeys: Settings  Hotkeys  'Swap: [name]'", obs.OBS_TEXT_INFO)
    
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_int(settings, "duration", 400)
    obs.obs_data_set_default_string(settings, "easing", "ease_in_out")
    obs.obs_data_set_default_bool(settings, "preserve_aspect", true)
    obs.obs_data_set_default_int(settings, "temp_override", 0)  -- Off by default
    obs.obs_data_set_default_bool(settings, "debug_mode", false)
end

function script_update(settings)
    settings_ref = settings
    animation_duration = obs.obs_data_get_int(settings, "duration")
    easing_type = obs.obs_data_get_string(settings, "easing")
    preserve_aspect = obs.obs_data_get_bool(settings, "preserve_aspect")
    temp_override = obs.obs_data_get_int(settings, "temp_override")
    debug_mode = obs.obs_data_get_bool(settings, "debug_mode")
end

function script_load(settings)
    settings_ref = settings
    load_configs(settings)
    log_info("Source Swap v3.1 loaded")
end

function script_save(settings)
    save_configs(settings)
end

function script_unload()
    if is_animating then
        obs.timer_remove(animation_tick)
        is_animating = false
    end
    for _, c in ipairs(swap_configs) do
        if c.hotkey_id and c.hotkey_id ~= obs.OBS_INVALID_HOTKEY_ID then
            obs.obs_hotkey_unregister(c.hotkey_id)
        end
    end
    log_info("Unloaded")
end
