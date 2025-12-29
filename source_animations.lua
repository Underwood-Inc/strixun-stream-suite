--[[
================================================================================
OBS Source Animation System (Lua)
================================================================================

Adds custom animations to individual sources when their visibility is toggled.

Features:
    - Fade, Slide, Zoom, Pop animations
    - NO FLICKER! Uses persistent opacity filter
    - Full in-OBS configuration UI

Author: OBS Animation System
Version: 2.8.1 - Fixed visibility flicker on show animation
================================================================================
--]]

obs = obslua

-- =============================================================================
-- Configuration
-- =============================================================================

local POLL_INTERVAL_MS = 10  -- Fast polling to catch visibility changes ASAP (reduces flicker)
local ANIM_FRAME_MS = 16

local settings_ref = nil

-- Default settings
local default_anim_type = "fade"
local default_duration = 300
local default_easing = "ease_out"
local default_direction = "left"
local default_offset = 100
local default_animate_show = true
local default_animate_hide = true

-- Per-source configs
local source_configs = {}

-- Animation state
local visibility_cache = {}
local animating_sources = {}
local active_animations = {}
local timer_running = false
local poll_timer_running = false

-- Track sources that have our filter applied
local managed_sources = {}

-- Track sources we're hiding (to prevent re-trigger loops)
local hiding_sources = {}

-- CRITICAL: Store canonical (original) transforms to prevent drift
-- These are the "home" positions/scales that sources should return to
local canonical_transforms = {}


-- =============================================================================
-- Easing Functions
-- =============================================================================

local function ease_linear(t) return t end
local function ease_in(t) return t * t end
local function ease_out(t) return 1.0 - (1.0 - t) * (1.0 - t) end

local function ease_in_out(t)
    if t < 0.5 then return 2.0 * t * t
    else return 1.0 - math.pow(-2.0 * t + 2.0, 2) / 2.0 end
end

local function ease_in_cubic(t) return t * t * t end
local function ease_out_cubic(t) return 1.0 - math.pow(1.0 - t, 3) end

local function ease_in_out_cubic(t)
    if t < 0.5 then return 4.0 * t * t * t
    else return 1.0 - math.pow(-2.0 * t + 2.0, 3) / 2.0 end
end

local function ease_bounce(t)
    local n1, d1 = 7.5625, 2.75
    if t < 1.0 / d1 then return n1 * t * t
    elseif t < 2.0 / d1 then t = t - 1.5 / d1; return n1 * t * t + 0.75
    elseif t < 2.5 / d1 then t = t - 2.25 / d1; return n1 * t * t + 0.9375
    else t = t - 2.625 / d1; return n1 * t * t + 0.984375 end
end

local function ease_elastic(t)
    if t == 0.0 then return 0.0 end
    if t == 1.0 then return 1.0 end
    local c4 = (2.0 * math.pi) / 3.0
    return math.pow(2.0, -10.0 * t) * math.sin((t * 10.0 - 0.75) * c4) + 1.0
end

local function ease_back(t)
    local c1, c3 = 1.70158, 2.70158
    return 1.0 + c3 * math.pow(t - 1.0, 3) + c1 * math.pow(t - 1.0, 2)
end

local EASING_FUNCTIONS = {
    linear = ease_linear, ease_in = ease_in, ease_out = ease_out,
    ease_in_out = ease_in_out, ease_in_cubic = ease_in_cubic,
    ease_out_cubic = ease_out_cubic, ease_in_out_cubic = ease_in_out_cubic,
    bounce = ease_bounce, elastic = ease_elastic, back = ease_back
}

local function get_easing(name) return EASING_FUNCTIONS[name] or ease_out end


-- =============================================================================
-- Logging & Helpers
-- =============================================================================

local function log_info(msg) obs.script_log(obs.LOG_INFO, "[SourceAnim] " .. msg) end
local function log_error(msg) obs.script_log(obs.LOG_ERROR, "[SourceAnim] " .. msg) end
local function lerp(a, b, t) return a + (b - a) * t end


-- =============================================================================
-- Transform Helpers
-- =============================================================================

local function get_scene_item_pos(scene_item)
    local pos = obs.vec2()
    obs.obs_sceneitem_get_pos(scene_item, pos)
    return pos.x, pos.y
end

local function set_scene_item_pos(scene_item, x, y)
    local pos = obs.vec2()
    pos.x, pos.y = x, y
    obs.obs_sceneitem_set_pos(scene_item, pos)
end

local function get_scene_item_scale(scene_item)
    local scale = obs.vec2()
    obs.obs_sceneitem_get_scale(scene_item, scale)
    return scale.x, scale.y
end

local function set_scene_item_scale(scene_item, sx, sy)
    local scale = obs.vec2()
    scale.x, scale.y = math.max(0.001, sx), math.max(0.001, sy)
    obs.obs_sceneitem_set_scale(scene_item, scale)
end


-- =============================================================================
-- Canonical Transform Management (Prevents Position Drift!)
-- =============================================================================

-- Capture the canonical (home) transforms for a source
-- Only called when source is in its "rest" state (not animating)
local function capture_canonical_transform(scene_item, source_name)
    -- NEVER capture if currently animating - would capture mid-animation state
    if animating_sources[source_name] then
        return
    end
    
    local pos_x, pos_y = get_scene_item_pos(scene_item)
    local scale_x, scale_y = get_scene_item_scale(scene_item)
    
    canonical_transforms[source_name] = {
        x = pos_x,
        y = pos_y,
        scale_x = scale_x,
        scale_y = scale_y
    }
end

-- Get canonical transforms for a source
-- If not stored yet, capture current (assumes source is at rest)
local function get_canonical_transform(scene_item, source_name)
    if canonical_transforms[source_name] == nil then
        capture_canonical_transform(scene_item, source_name)
    end
    
    local ct = canonical_transforms[source_name]
    if ct then
        return ct.x, ct.y, ct.scale_x, ct.scale_y
    end
    
    -- Fallback to current position if something went wrong
    local pos_x, pos_y = get_scene_item_pos(scene_item)
    local scale_x, scale_y = get_scene_item_scale(scene_item)
    return pos_x, pos_y, scale_x, scale_y
end

-- Force update canonical transform (called when user explicitly repositions)
local function update_canonical_transform(scene_item, source_name)
    if animating_sources[source_name] then
        return  -- Don't update while animating
    end
    capture_canonical_transform(scene_item, source_name)
end

-- Clear canonical transform (forces recapture)
local function clear_canonical_transform(source_name)
    canonical_transforms[source_name] = nil
end


-- =============================================================================
-- Opacity Filter Management (Persistent Filter Approach)
-- =============================================================================

local OPACITY_FILTER_NAME = "_lua_anim_opacity"

-- Ensure the opacity filter exists on a source, create if not
local function ensure_opacity_filter(source, initial_opacity)
    if source == nil then return false end
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    
    if filter == nil then
        -- Create the filter
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

-- Set opacity on existing filter (fast path)
local function set_source_opacity(source, opacity)
    if source == nil then return end
    opacity = math.max(0.0, math.min(1.0, opacity))
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    if filter ~= nil then
        local filter_settings = obs.obs_source_get_settings(filter)
        obs.obs_data_set_double(filter_settings, "opacity", opacity)
        obs.obs_source_update(filter, filter_settings)
        obs.obs_data_release(filter_settings)
        obs.obs_source_release(filter)
    else
        -- Filter doesn't exist, create it
        ensure_opacity_filter(source, opacity)
    end
end

-- Get current opacity from filter
local function get_source_opacity(source)
    if source == nil then return 1.0 end
    
    local filter = obs.obs_source_get_filter_by_name(source, OPACITY_FILTER_NAME)
    if filter ~= nil then
        local filter_settings = obs.obs_source_get_settings(filter)
        local opacity = obs.obs_data_get_double(filter_settings, "opacity")
        obs.obs_data_release(filter_settings)
        obs.obs_source_release(filter)
        return opacity
    end
    return 1.0
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
-- Configuration Management
-- =============================================================================

local function get_source_config(source_name)
    if source_configs[source_name] ~= nil then
        return source_configs[source_name]
    end
    return {
        anim_type = default_anim_type,
        duration = default_duration,
        easing = default_easing,
        direction = default_direction,
        offset = default_offset,
        animate_show = default_animate_show,
        animate_hide = default_animate_hide
    }
end

local function load_source_configs(settings)
    source_configs = {}
    local configs_array = obs.obs_data_get_array(settings, "source_configs")
    if configs_array == nil then return end
    
    local count = obs.obs_data_array_count(configs_array)
    for i = 0, count - 1 do
        local item = obs.obs_data_array_item(configs_array, i)
        local source_name = obs.obs_data_get_string(item, "source_name")
        
        if source_name ~= nil and source_name ~= "" then
            source_configs[source_name] = {
                anim_type = obs.obs_data_get_string(item, "anim_type"),
                duration = obs.obs_data_get_int(item, "duration"),
                easing = obs.obs_data_get_string(item, "easing"),
                direction = obs.obs_data_get_string(item, "direction"),
                offset = obs.obs_data_get_int(item, "offset"),
                animate_show = obs.obs_data_get_bool(item, "animate_show"),
                animate_hide = obs.obs_data_get_bool(item, "animate_hide")
            }
            
            local c = source_configs[source_name]
            if c.anim_type == "" then c.anim_type = "fade" end
            if c.duration == 0 then c.duration = 300 end
            if c.easing == "" then c.easing = "ease_out" end
            if c.direction == "" then c.direction = "left" end
            if c.offset == 0 then c.offset = 100 end
        end
        obs.obs_data_release(item)
    end
    obs.obs_data_array_release(configs_array)
    
    local count_loaded = 0
    for _ in pairs(source_configs) do count_loaded = count_loaded + 1 end
    log_info("Loaded " .. count_loaded .. " source configs")
end

local function save_source_configs(settings)
    local configs_array = obs.obs_data_array_create()
    
    for source_name, config in pairs(source_configs) do
        local item = obs.obs_data_create()
        obs.obs_data_set_string(item, "source_name", source_name)
        obs.obs_data_set_string(item, "anim_type", config.anim_type)
        obs.obs_data_set_int(item, "duration", config.duration)
        obs.obs_data_set_string(item, "easing", config.easing)
        obs.obs_data_set_string(item, "direction", config.direction)
        obs.obs_data_set_int(item, "offset", config.offset)
        obs.obs_data_set_bool(item, "animate_show", config.animate_show)
        obs.obs_data_set_bool(item, "animate_hide", config.animate_hide)
        obs.obs_data_array_push_back(configs_array, item)
        obs.obs_data_release(item)
    end
    
    obs.obs_data_set_array(settings, "source_configs", configs_array)
    obs.obs_data_array_release(configs_array)
end


-- =============================================================================
-- Animation Engine
-- =============================================================================

local function start_animation(scene_item, source_name, config, is_showing)
    if is_showing and not config.animate_show then return false end
    if not is_showing and not config.animate_hide then return false end
    
    -- Cancel any existing animation for this source
    if active_animations[source_name] ~= nil then
        -- Animation was interrupted - canonical position is still valid
        active_animations[source_name] = nil
        animating_sources[source_name] = nil
    end
    
    local source = obs.obs_sceneitem_get_source(scene_item)
    if source == nil then return false end
    
    -- CRITICAL: Get canonical (home) transforms - NOT current transforms!
    -- This prevents drift when animations are interrupted or chained
    local canon_x, canon_y, canon_scale_x, canon_scale_y = get_canonical_transform(scene_item, source_name)
    
    -- CRITICAL: Ensure filter exists and set initial opacity BEFORE any visibility change
    if is_showing then
        -- For show: ensure filter is at 0% IMMEDIATELY
        ensure_opacity_filter(source, 0.0)
        set_source_opacity(source, 0.0)
        managed_sources[source_name] = true
    else
        -- For hide: mark as hiding and keep source visible during animation
        hiding_sources[source_name] = true
        obs.obs_sceneitem_set_visible(scene_item, true)
        -- Ensure filter exists at current opacity
        local current_opacity = get_source_opacity(source)
        if current_opacity < 0.5 then current_opacity = 1.0 end  -- Safety: if near 0, start from 1
        ensure_opacity_filter(source, current_opacity)
        managed_sources[source_name] = true
    end
    
    local anim = {
        scene_item = scene_item,
        source = source,
        source_name = source_name,
        anim_type = config.anim_type,
        duration = config.duration,
        easing_fn = get_easing(config.easing),
        is_showing = is_showing,
        start_time = obs.os_gettime_ns() / 1000000,
        -- ALWAYS use canonical (home) position - prevents drift!
        orig_x = canon_x, orig_y = canon_y,
        orig_scale_x = canon_scale_x, orig_scale_y = canon_scale_y,
        direction = config.direction or "left",
        offset = config.offset or 100,
        start_x = canon_x, start_y = canon_y,
        end_x = canon_x, end_y = canon_y,
        start_scale_x = canon_scale_x, start_scale_y = canon_scale_y,
        end_scale_x = canon_scale_x, end_scale_y = canon_scale_y,
        start_opacity = 0.0, end_opacity = 1.0
    }
    
    -- Configure animation based on type
    if anim.anim_type == "fade" then
        if is_showing then
            anim.start_opacity, anim.end_opacity = 0.0, 1.0
        else
            anim.start_opacity, anim.end_opacity = 1.0, 0.0
        end
        
    elseif anim.anim_type == "slide" then
        local ox, oy = 0, 0
        if anim.direction == "left" then ox = -anim.offset
        elseif anim.direction == "right" then ox = anim.offset
        elseif anim.direction == "up" then oy = -anim.offset
        elseif anim.direction == "down" then oy = anim.offset end
        
        if is_showing then
            -- Start from offset position, animate TO canonical position
            anim.start_x, anim.start_y = canon_x + ox, canon_y + oy
            anim.end_x, anim.end_y = canon_x, canon_y
            anim.start_opacity, anim.end_opacity = 0.0, 1.0
            set_scene_item_pos(scene_item, anim.start_x, anim.start_y)
        else
            -- Start from canonical position, animate TO offset position
            anim.start_x, anim.start_y = canon_x, canon_y
            anim.end_x, anim.end_y = canon_x + ox, canon_y + oy
            anim.start_opacity, anim.end_opacity = 1.0, 0.0
            -- Ensure we start from canonical position
            set_scene_item_pos(scene_item, canon_x, canon_y)
        end
        
    elseif anim.anim_type == "zoom" then
        if is_showing then
            anim.start_scale_x, anim.start_scale_y = 0.01, 0.01
            anim.end_scale_x, anim.end_scale_y = canon_scale_x, canon_scale_y
            anim.start_opacity, anim.end_opacity = 0.0, 1.0
            set_scene_item_scale(scene_item, 0.01, 0.01)
        else
            anim.start_scale_x, anim.start_scale_y = canon_scale_x, canon_scale_y
            anim.end_scale_x, anim.end_scale_y = 0.01, 0.01
            anim.start_opacity, anim.end_opacity = 1.0, 0.0
            set_scene_item_scale(scene_item, canon_scale_x, canon_scale_y)
        end
        
    elseif anim.anim_type == "pop" then
        anim.easing_fn = get_easing("back")
        if is_showing then
            anim.start_scale_x, anim.start_scale_y = 0.01, 0.01
            anim.end_scale_x, anim.end_scale_y = canon_scale_x, canon_scale_y
            anim.start_opacity, anim.end_opacity = 0.0, 1.0
            set_scene_item_scale(scene_item, 0.01, 0.01)
        else
            anim.start_scale_x, anim.start_scale_y = canon_scale_x, canon_scale_y
            anim.end_scale_x, anim.end_scale_y = 0.01, 0.01
            anim.start_opacity, anim.end_opacity = 1.0, 0.0
            set_scene_item_scale(scene_item, canon_scale_x, canon_scale_y)
        end
    end
    
    active_animations[source_name] = anim
    animating_sources[source_name] = true
    
    if not timer_running then
        obs.timer_add(animation_tick, ANIM_FRAME_MS)
        timer_running = true
    end
    
    local dir = is_showing and "IN" or "OUT"
    log_info("Animation " .. dir .. ": " .. anim.anim_type .. " on '" .. source_name .. "' (canonical: " .. canon_x .. "," .. canon_y .. ")")
    return true
end

function animation_tick()
    if next(active_animations) == nil then
        obs.timer_remove(animation_tick)
        timer_running = false
        return
    end
    
    local current_time = obs.os_gettime_ns() / 1000000
    local completed = {}
    
    for source_name, anim in pairs(active_animations) do
        local elapsed = current_time - anim.start_time
        local progress = math.min(1.0, elapsed / anim.duration)
        local eased = anim.easing_fn(progress)
        
        -- Apply opacity
        local opacity = lerp(anim.start_opacity, anim.end_opacity, eased)
        set_source_opacity(anim.source, opacity)
        
        -- Apply transforms
        if anim.anim_type == "slide" then
            set_scene_item_pos(anim.scene_item, 
                lerp(anim.start_x, anim.end_x, eased),
                lerp(anim.start_y, anim.end_y, eased))
            
        elseif anim.anim_type == "zoom" or anim.anim_type == "pop" then
            set_scene_item_scale(anim.scene_item,
                lerp(anim.start_scale_x, anim.end_scale_x, eased),
                lerp(anim.start_scale_y, anim.end_scale_y, eased))
        end
        
        if progress >= 1.0 then
            table.insert(completed, source_name)
        end
    end
    
    for _, source_name in ipairs(completed) do
        local anim = active_animations[source_name]
        if anim ~= nil then
            if anim.is_showing then
                -- Show complete - restore original transforms, set opacity to 1
                if anim.anim_type == "slide" then
                    set_scene_item_pos(anim.scene_item, anim.orig_x, anim.orig_y)
                elseif anim.anim_type == "zoom" or anim.anim_type == "pop" then
                    set_scene_item_scale(anim.scene_item, anim.orig_scale_x, anim.orig_scale_y)
                end
                set_source_opacity(anim.source, 1.0)
                visibility_cache[source_name] = true
            else
                -- Hide complete - restore transforms, set opacity to 0, THEN hide
                if anim.anim_type == "slide" then
                    set_scene_item_pos(anim.scene_item, anim.orig_x, anim.orig_y)
                elseif anim.anim_type == "zoom" or anim.anim_type == "pop" then
                    set_scene_item_scale(anim.scene_item, anim.orig_scale_x, anim.orig_scale_y)
                end
                
                -- Set opacity to 0 (for next time it becomes visible)
                set_source_opacity(anim.source, 0.0)
                
                -- NOW hide the source
                obs.obs_sceneitem_set_visible(anim.scene_item, false)
                visibility_cache[source_name] = false
                hiding_sources[source_name] = nil
            end
            
            active_animations[source_name] = nil
            animating_sources[source_name] = nil
        end
    end
end


-- =============================================================================
-- Visibility Monitoring
-- =============================================================================

local function find_scene_item_recursive(scene, source_name)
    if scene == nil then return nil end
    local items = obs.obs_scene_enum_items(scene)
    if items == nil then return nil end
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        if source ~= nil then
            local name = obs.obs_source_get_name(source)
            if name == source_name then
                obs.sceneitem_list_release(items)
                return item
            end
            if obs.obs_sceneitem_is_group(item) then
                local group_scene = obs.obs_sceneitem_group_get_scene(item)
                if group_scene ~= nil then
                    local found = find_scene_item_recursive(group_scene, source_name)
                    if found ~= nil then
                        obs.sceneitem_list_release(items)
                        return found
                    end
                end
            end
        end
    end
    obs.sceneitem_list_release(items)
    return nil
end

-- Pre-apply opacity filter to a source (prevents flash on show/hide)
-- ALSO captures canonical transforms if not animating
local function prepare_source(scene_item, source_name, is_visible)
    local source = obs.obs_sceneitem_get_source(scene_item)
    if source ~= nil then
        -- Set filter to appropriate opacity based on current visibility
        local opacity = is_visible and 1.0 or 0.0
        ensure_opacity_filter(source, opacity)
        managed_sources[source_name] = true
        
        -- CRITICAL: Capture canonical transforms when source is at rest
        -- This is the "home" position sources will always return to
        if not animating_sources[source_name] and canonical_transforms[source_name] == nil then
            capture_canonical_transform(scene_item, source_name)
            log_info("Captured canonical position for '" .. source_name .. "'")
        end
    end
end

local function check_visibility_changes()
    local current_scene_source = obs.obs_frontend_get_current_scene()
    if current_scene_source == nil then return end
    
    local scene = obs.obs_scene_from_source(current_scene_source)
    if scene == nil then
        obs.obs_source_release(current_scene_source)
        return
    end
    
    -- Check configured sources
    for source_name, config in pairs(source_configs) do
        -- Skip if currently animating or hiding
        if animating_sources[source_name] == nil and hiding_sources[source_name] == nil then
            local scene_item = find_scene_item_recursive(scene, source_name)
            if scene_item ~= nil then
                local is_visible = obs.obs_sceneitem_visible(scene_item)
                local was_visible = visibility_cache[source_name]
                
                if was_visible ~= nil and was_visible ~= is_visible then
                    -- VISIBILITY CHANGED - start animation
                    -- CRITICAL: Do NOT call prepare_source here!
                    -- start_animation will set up the filter at the correct initial opacity
                    -- Calling prepare_source first would set opacity to 1.0 for show animations,
                    -- causing a flicker before animation sets it to 0.0
                    local started = start_animation(scene_item, source_name, config, is_visible)
                    if not started then
                        -- Animation didn't start (disabled), just prepare normally
                        if not managed_sources[source_name] then
                            prepare_source(scene_item, source_name, is_visible)
                        end
                        visibility_cache[source_name] = is_visible
                    end
                elseif was_visible == nil then
                    -- FIRST TIME seeing this source - cache state and prepare filter
                    -- No animation happens on first cache, so safe to prepare at current visibility
                    visibility_cache[source_name] = is_visible
                    if not managed_sources[source_name] then
                        prepare_source(scene_item, source_name, is_visible)
                    end
                else
                    -- NO CHANGE - ensure source has filter if not managed yet
                    if not managed_sources[source_name] then
                        prepare_source(scene_item, source_name, is_visible)
                    end
                end
            end
        end
    end
    
    -- Check unconfigured sources (use defaults) - only if defaults are enabled
    if default_animate_show or default_animate_hide then
        local items = obs.obs_scene_enum_items(scene)
        if items ~= nil then
            for _, scene_item in ipairs(items) do
                local source = obs.obs_sceneitem_get_source(scene_item)
                if source ~= nil then
                    local source_name = obs.obs_source_get_name(source)
                    if source_name ~= nil and source_name ~= "" 
                       and source_configs[source_name] == nil 
                       and animating_sources[source_name] == nil 
                       and hiding_sources[source_name] == nil then
                        
                        local is_visible = obs.obs_sceneitem_visible(scene_item)
                        local was_visible = visibility_cache[source_name]
                        
                        if was_visible ~= nil and was_visible ~= is_visible then
                            -- VISIBILITY CHANGED - start animation
                            -- CRITICAL: Do NOT call prepare_source here!
                            local config = get_source_config(source_name)
                            local started = start_animation(scene_item, source_name, config, is_visible)
                            if not started then
                                -- Animation didn't start (disabled), prepare normally
                                if not managed_sources[source_name] then
                                    prepare_source(scene_item, source_name, is_visible)
                                end
                                visibility_cache[source_name] = is_visible
                            end
                        elseif was_visible == nil then
                            -- FIRST TIME - cache and prepare
                            visibility_cache[source_name] = is_visible
                            if not managed_sources[source_name] then
                                prepare_source(scene_item, source_name, is_visible)
                            end
                        else
                            -- NO CHANGE - ensure filter exists
                            if not managed_sources[source_name] then
                                prepare_source(scene_item, source_name, is_visible)
                            end
                        end
                    end
                end
            end
            obs.sceneitem_list_release(items)
        end
    end
    
    obs.obs_source_release(current_scene_source)
end

local function update_visibility_cache()
    visibility_cache = {}
    hiding_sources = {}
    managed_sources = {}
    -- NOTE: We do NOT clear canonical_transforms here!
    -- Canonical positions should persist across scene changes
    -- They're only cleared when source is removed or reconfigured
    
    local current_scene_source = obs.obs_frontend_get_current_scene()
    if current_scene_source == nil then return end
    
    local scene = obs.obs_scene_from_source(current_scene_source)
    if scene == nil then
        obs.obs_source_release(current_scene_source)
        return
    end
    
    local items = obs.obs_scene_enum_items(scene)
    if items ~= nil then
        for _, scene_item in ipairs(items) do
            local source = obs.obs_sceneitem_get_source(scene_item)
            if source ~= nil then
                local source_name = obs.obs_source_get_name(source)
                if source_name ~= nil and source_name ~= "" then
                    local is_visible = obs.obs_sceneitem_visible(scene_item)
                    visibility_cache[source_name] = is_visible
                    
                    -- Pre-apply filter to ALL sources
                    prepare_source(scene_item, source_name, is_visible)
                end
            end
        end
        obs.sceneitem_list_release(items)
    end
    
    obs.obs_source_release(current_scene_source)
end

local function on_frontend_event(event)
    if event == obs.OBS_FRONTEND_EVENT_SCENE_CHANGED or 
       event == obs.OBS_FRONTEND_EVENT_PREVIEW_SCENE_CHANGED then
        update_visibility_cache()
    end
end


-- =============================================================================
-- UI Helpers
-- =============================================================================

local function get_current_scene_source_names()
    local names = {}
    local current_scene_source = obs.obs_frontend_get_current_scene()
    if current_scene_source == nil then return names end
    
    local scene = obs.obs_scene_from_source(current_scene_source)
    if scene == nil then
        obs.obs_source_release(current_scene_source)
        return names
    end
    
    local function enumerate_items(s)
        local items = obs.obs_scene_enum_items(s)
        if items ~= nil then
            for _, item in ipairs(items) do
                local source = obs.obs_sceneitem_get_source(item)
                if source ~= nil then
                    local name = obs.obs_source_get_name(source)
                    if name ~= nil and name ~= "" then
                        table.insert(names, name)
                    end
                    if obs.obs_sceneitem_is_group(item) then
                        local group_scene = obs.obs_sceneitem_group_get_scene(item)
                        if group_scene ~= nil then enumerate_items(group_scene) end
                    end
                end
            end
            obs.sceneitem_list_release(items)
        end
    end
    
    enumerate_items(scene)
    obs.obs_source_release(current_scene_source)
    return names
end

local function add_anim_type_list(props, id, label)
    local list = obs.obs_properties_add_list(props, id, label, obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(list, "Fade", "fade")
    obs.obs_property_list_add_string(list, "Slide", "slide")
    obs.obs_property_list_add_string(list, "Zoom", "zoom")
    obs.obs_property_list_add_string(list, "Pop (Bouncy)", "pop")
    return list
end

local function add_easing_list(props, id, label)
    local list = obs.obs_properties_add_list(props, id, label, obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(list, "Ease Out ❓", "ease_out")
    obs.obs_property_list_add_string(list, "Ease In/Out", "ease_in_out")
    obs.obs_property_list_add_string(list, "Ease In", "ease_in")
    obs.obs_property_list_add_string(list, "Linear", "linear")
    obs.obs_property_list_add_string(list, "Bounce", "bounce")
    obs.obs_property_list_add_string(list, "Elastic", "elastic")
    obs.obs_property_list_add_string(list, "Back", "back")
    return list
end

local function add_direction_list(props, id, label)
    local list = obs.obs_properties_add_list(props, id, label, obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(list, "Left", "left")
    obs.obs_property_list_add_string(list, "Right", "right")
    obs.obs_property_list_add_string(list, "Up", "up")
    obs.obs_property_list_add_string(list, "Down", "down")
    return list
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2>Source Animation System v2.8.1</h2>
<p>Animate sources when visibility is toggled.</p>

<h3>v2.8.1 - Fixed Visibility Flicker Bug!</h3>
<p>Sources no longer flicker to full opacity before show animations begin. The prepare_source call is now properly deferred until AFTER animation setup.</p>

<h3>Animation Types:</h3>
<ul>
    <li><b>Fade</b> - Opacity transition</li>
    <li><b>Slide</b> - Move in/out</li>
    <li><b>Zoom</b> - Scale</li>
    <li><b>Pop</b> - Bouncy scale</li>
</ul>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- Default settings
    obs.obs_properties_add_text(props, "h2", "═══════════ DEFAULTS ═══════════", obs.OBS_TEXT_INFO)
    add_anim_type_list(props, "default_anim_type", "Type")
    obs.obs_properties_add_int_slider(props, "default_duration", "Duration (ms)", 100, 2000, 50)
    add_easing_list(props, "default_easing", "Easing")
    add_direction_list(props, "default_direction", "Direction (Slide)")
    obs.obs_properties_add_int_slider(props, "default_offset", "Offset (px)", 10, 500, 10)
    obs.obs_properties_add_bool(props, "default_animate_show", "Animate on SHOW")
    obs.obs_properties_add_bool(props, "default_animate_hide", "Animate on HIDE")
    
    -- Add source
    obs.obs_properties_add_text(props, "h3", "═══════════ ADD SOURCE ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "refresh_btn", "🔄 Refresh Sources",
        function(props, p) 
            update_visibility_cache()
            return true 
        end)
    
    local source_list = obs.obs_properties_add_list(props, "new_source", "Source",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(source_list, "(Select)", "")
    
    local scene_sources = get_current_scene_source_names()
    for _, name in ipairs(scene_sources) do
        obs.obs_property_list_add_string(source_list, name, name)
    end
    
    add_anim_type_list(props, "new_anim_type", "Type")
    obs.obs_properties_add_int_slider(props, "new_duration", "Duration (ms)", 100, 2000, 50)
    add_easing_list(props, "new_easing", "Easing")
    add_direction_list(props, "new_direction", "Direction")
    obs.obs_properties_add_int_slider(props, "new_offset", "Offset (px)", 10, 500, 10)
    obs.obs_properties_add_bool(props, "new_animate_show", "Animate on SHOW")
    obs.obs_properties_add_bool(props, "new_animate_hide", "Animate on HIDE")
    
    obs.obs_properties_add_button(props, "add_btn", "➕ Add/Update Source",
        function(props, p)
            if settings_ref == nil then return false end
            local name = obs.obs_data_get_string(settings_ref, "new_source")
            if name == "" then log_error("Select a source!"); return false end
            
            source_configs[name] = {
                anim_type = obs.obs_data_get_string(settings_ref, "new_anim_type"),
                duration = obs.obs_data_get_int(settings_ref, "new_duration"),
                easing = obs.obs_data_get_string(settings_ref, "new_easing"),
                direction = obs.obs_data_get_string(settings_ref, "new_direction"),
                offset = obs.obs_data_get_int(settings_ref, "new_offset"),
                animate_show = obs.obs_data_get_bool(settings_ref, "new_animate_show"),
                animate_hide = obs.obs_data_get_bool(settings_ref, "new_animate_hide")
            }
            
            -- RESET source state so filter gets re-initialized properly
            managed_sources[name] = nil
            visibility_cache[name] = nil
            canonical_transforms[name] = nil  -- Force recapture of home position
            
            save_source_configs(settings_ref)
            log_info("Added/Updated: " .. name .. " (state reset, will recapture position)")
            return true
        end)
    
    -- Remove source
    obs.obs_properties_add_text(props, "h4", "═══════════ REMOVE ═══════════", obs.OBS_TEXT_INFO)
    
    local remove_list = obs.obs_properties_add_list(props, "remove_source", "Source",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(remove_list, "(Select)", "")
    for name, _ in pairs(source_configs) do
        obs.obs_property_list_add_string(remove_list, name, name)
    end
    
    obs.obs_properties_add_button(props, "remove_btn", "❌ Remove Source",
        function(props, p)
            if settings_ref == nil then return false end
            local name = obs.obs_data_get_string(settings_ref, "remove_source")
            if name == "" then return false end
            if source_configs[name] then
                -- Remove the filter from the actual source
                local sources = obs.obs_enum_sources()
                if sources then
                    for _, source in ipairs(sources) do
                        if obs.obs_source_get_name(source) == name then
                            remove_opacity_filter(source)
                            break
                        end
                    end
                    obs.source_list_release(sources)
                end
                
                source_configs[name] = nil
                managed_sources[name] = nil
                visibility_cache[name] = nil
                canonical_transforms[name] = nil
                save_source_configs(settings_ref)
                log_info("Removed: " .. name .. " (filter and position data cleared)")
            end
            return true
        end)
    
    -- Status
    obs.obs_properties_add_text(props, "h5", "═══════════ STATUS ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "list_btn", "📋 List Configured Sources",
        function(props, p)
            log_info("=== Configured Sources ===")
            local count = 0
            for name, c in pairs(source_configs) do
                count = count + 1
                local ct = canonical_transforms[name]
                local pos_str = ct and string.format("(%.0f, %.0f)", ct.x, ct.y) or "(not captured)"
                log_info(count .. ". " .. name .. " -> " .. c.anim_type .. " @ " .. pos_str)
            end
            if count == 0 then log_info("None configured") end
            return false
        end)
    
    obs.obs_properties_add_button(props, "recapture_btn", "🎯 Recapture Home Positions",
        function(props, p)
            log_info("Recapturing home positions for all sources...")
            canonical_transforms = {}
            update_visibility_cache()
            log_info("Done! All sources will recapture their current position as 'home'.")
            return false
        end)
    
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, "default_anim_type", "fade")
    obs.obs_data_set_default_int(settings, "default_duration", 300)
    obs.obs_data_set_default_string(settings, "default_easing", "ease_out")
    obs.obs_data_set_default_string(settings, "default_direction", "left")
    obs.obs_data_set_default_int(settings, "default_offset", 100)
    obs.obs_data_set_default_bool(settings, "default_animate_show", true)
    obs.obs_data_set_default_bool(settings, "default_animate_hide", true)
    
    obs.obs_data_set_default_string(settings, "new_anim_type", "fade")
    obs.obs_data_set_default_int(settings, "new_duration", 300)
    obs.obs_data_set_default_string(settings, "new_easing", "ease_out")
    obs.obs_data_set_default_string(settings, "new_direction", "left")
    obs.obs_data_set_default_int(settings, "new_offset", 100)
    obs.obs_data_set_default_bool(settings, "new_animate_show", true)
    obs.obs_data_set_default_bool(settings, "new_animate_hide", true)
end

function script_update(settings)
    settings_ref = settings
    
    default_anim_type = obs.obs_data_get_string(settings, "default_anim_type")
    default_duration = obs.obs_data_get_int(settings, "default_duration")
    default_easing = obs.obs_data_get_string(settings, "default_easing")
    default_direction = obs.obs_data_get_string(settings, "default_direction")
    default_offset = obs.obs_data_get_int(settings, "default_offset")
    default_animate_show = obs.obs_data_get_bool(settings, "default_animate_show")
    default_animate_hide = obs.obs_data_get_bool(settings, "default_animate_hide")
    
    if default_anim_type == "" then default_anim_type = "fade" end
    if default_duration == 0 then default_duration = 300 end
    if default_easing == "" then default_easing = "ease_out" end
    if default_direction == "" then default_direction = "left" end
    if default_offset == 0 then default_offset = 100 end
end

function script_load(settings)
    settings_ref = settings
    log_info("Loading Source Animation System v2.8.1 (Visibility Flicker Fix)...")
    
    load_source_configs(settings)
    obs.obs_frontend_add_event_callback(on_frontend_event)
    
    -- Initial cache population
    update_visibility_cache()
    
    obs.timer_add(check_visibility_changes, POLL_INTERVAL_MS)
    poll_timer_running = true
    
    log_info("Loaded! Persistent filter approach active.")
end

function script_save(settings)
    save_source_configs(settings)
end

function script_unload()
    log_info("Unloading...")
    if poll_timer_running then obs.timer_remove(check_visibility_changes) end
    if timer_running then obs.timer_remove(animation_tick) end
    obs.obs_frontend_remove_event_callback(on_frontend_event)
    active_animations, animating_sources, visibility_cache, hiding_sources, managed_sources, canonical_transforms = {}, {}, {}, {}, {}, {}
    log_info("Unloaded.")
end
