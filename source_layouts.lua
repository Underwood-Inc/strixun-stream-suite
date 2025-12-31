--[[
================================================================================
OBS Source Layout Presets (Lua)
================================================================================

Save and apply layout presets - snapshot all source positions/sizes in a scene
and smoothly animate between layouts.

Features:
    - Save current scene as named layout preset
    - Apply layouts with smooth multi-source animation
    - Staggered animations for cinematic transitions
    - Smart source diffing (handles missing/new sources)
    - Hotkey support for quick layout switching
    - Visibility state management

Author: OBS Animation System
Version: 1.0.0
================================================================================
--]]

obs = obslua

-- =============================================================================
-- Configuration
-- =============================================================================

local ANIM_FRAME_MS = 16            -- ~60fps animation
local DEFAULT_DURATION = 500        -- Default animation duration (ms)
local DEFAULT_EASING = "ease_out"
local DEFAULT_STAGGER = 0           -- No stagger by default
local MAX_LAYOUTS = 20              -- Maximum layouts per scene

-- Script state
local settings_ref = nil
local layout_presets = {}           -- { scene_name = { layout_name = LayoutPreset, ... }, ... }
local is_animating = false
local animation_data = nil
local anim_start_time = 0
local timer_running = false

-- Hotkey IDs
local hotkey_ids = {}


-- =============================================================================
-- Easing Functions (borrowed from source_animations.lua)
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
    linear = ease_linear,
    ease_in = ease_in,
    ease_out = ease_out,
    ease_in_out = ease_in_out,
    ease_in_cubic = ease_in_cubic,
    ease_out_cubic = ease_out_cubic,
    ease_in_out_cubic = ease_in_out_cubic,
    bounce = ease_bounce,
    elastic = ease_elastic,
    back = ease_back
}

local function get_easing(name)
    return EASING_FUNCTIONS[name] or ease_out
end


-- =============================================================================
-- Logging & Helpers
-- =============================================================================

local function log_info(msg)
    obs.script_log(obs.LOG_INFO, "[Layouts] " .. msg)
end

local function log_error(msg)
    obs.script_log(obs.LOG_ERROR, "[Layouts] " .. msg)
end

local function log_warning(msg)
    obs.script_log(obs.LOG_WARNING, "[Layouts] " .. msg)
end

local function lerp(a, b, t)
    return a + (b - a) * t
end

local function generate_id()
    -- Simple ID generator
    return string.format("%d_%d", os.time(), math.random(1000, 9999))
end


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
    scale.x = math.max(0.001, sx)
    scale.y = math.max(0.001, sy)
    obs.obs_sceneitem_set_scale(scene_item, scale)
end

local function get_scene_item_bounds(scene_item)
    local bounds = obs.vec2()
    obs.obs_sceneitem_get_bounds(scene_item, bounds)
    local bounds_type = obs.obs_sceneitem_get_bounds_type(scene_item)
    return bounds.x, bounds.y, bounds_type
end

local function set_scene_item_bounds(scene_item, bx, by, bounds_type)
    local bounds = obs.vec2()
    bounds.x = math.max(1, bx)
    bounds.y = math.max(1, by)
    obs.obs_sceneitem_set_bounds(scene_item, bounds)
    if bounds_type then
        obs.obs_sceneitem_set_bounds_type(scene_item, bounds_type)
    end
end

local function get_scene_item_rotation(scene_item)
    return obs.obs_sceneitem_get_rot(scene_item)
end

local function set_scene_item_rotation(scene_item, rot)
    obs.obs_sceneitem_set_rot(scene_item, rot)
end


-- =============================================================================
-- Scene Item Discovery
-- =============================================================================

--- Find a scene item by name (recursive, handles groups)
-- @param scene The OBS scene object
-- @param source_name The name to find
-- @param parent_group Optional parent group scene_item
-- @return scene_item, parent_group (or nil, nil if not found)
local function find_scene_item_recursive(scene, source_name, parent_group)
    if scene == nil then return nil, nil end
    
    local items = obs.obs_scene_enum_items(scene)
    if items == nil then return nil, nil end
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        if source ~= nil then
            local name = obs.obs_source_get_name(source)
            
            if name == source_name then
                obs.sceneitem_list_release(items)
                return item, parent_group
            end
            
            -- Check inside groups
            if obs.obs_sceneitem_is_group(item) then
                local group_scene = obs.obs_sceneitem_group_get_scene(item)
                if group_scene ~= nil then
                    local found, found_parent = find_scene_item_recursive(group_scene, source_name, item)
                    if found ~= nil then
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


--- Capture the transform state of a single scene item
-- @param scene_item The OBS scene item
-- @param source_name The source name
-- @param parent_group Optional parent group
-- @return table with all transform data
local function capture_source_state(scene_item, source_name, parent_group)
    if scene_item == nil then return nil end
    
    local source = obs.obs_sceneitem_get_source(scene_item)
    if source == nil then return nil end
    
    local pos_x, pos_y = get_scene_item_pos(scene_item)
    local scale_x, scale_y = get_scene_item_scale(scene_item)
    local bounds_x, bounds_y, bounds_type = get_scene_item_bounds(scene_item)
    local rotation = get_scene_item_rotation(scene_item)
    local visible = obs.obs_sceneitem_visible(scene_item)
    
    -- Get source dimensions
    local source_width = obs.obs_source_get_width(source)
    local source_height = obs.obs_source_get_height(source)
    if source_width == 0 then source_width = 1920 end
    if source_height == 0 then source_height = 1080 end
    
    -- Determine if using bounds mode
    local uses_bounds = (bounds_type ~= obs.OBS_BOUNDS_NONE and bounds_x > 0 and bounds_y > 0)
    
    -- Group info
    local in_group = (parent_group ~= nil)
    local group_name = nil
    if in_group then
        local group_source = obs.obs_sceneitem_get_source(parent_group)
        if group_source then
            group_name = obs.obs_source_get_name(group_source)
        end
    end
    
    return {
        -- Core identification
        sourceName = source_name,
        
        -- Visibility
        visible = visible,
        
        -- Position
        positionX = pos_x,
        positionY = pos_y,
        
        -- Scale
        scaleX = scale_x,
        scaleY = scale_y,
        
        -- Bounds
        usesBounds = uses_bounds,
        boundsWidth = bounds_x,
        boundsHeight = bounds_y,
        boundsType = bounds_type,
        
        -- Source dimensions
        sourceWidth = source_width,
        sourceHeight = source_height,
        
        -- Rotation
        rotation = rotation,
        
        -- Group info
        inGroup = in_group,
        groupName = group_name
    }
end


--- Enumerate all sources in a scene with their transforms
-- @param scene The OBS scene
-- @param parent_group Optional parent group for recursion
-- @return table { source_name = source_state, ... }
local function enumerate_scene_sources(scene, parent_group)
    local sources = {}
    
    if scene == nil then return sources end
    
    local items = obs.obs_scene_enum_items(scene)
    if items == nil then return sources end
    
    for _, item in ipairs(items) do
        local source = obs.obs_sceneitem_get_source(item)
        if source ~= nil then
            local name = obs.obs_source_get_name(source)
            
            if name ~= nil and name ~= "" then
                local state = capture_source_state(item, name, parent_group)
                if state then
                    sources[name] = state
                end
                
                -- Recurse into groups
                if obs.obs_sceneitem_is_group(item) then
                    local group_scene = obs.obs_sceneitem_group_get_scene(item)
                    if group_scene ~= nil then
                        local group_sources = enumerate_scene_sources(group_scene, item)
                        for group_source_name, group_state in pairs(group_sources) do
                            sources[group_source_name] = group_state
                        end
                    end
                end
            end
        end
    end
    
    obs.sceneitem_list_release(items)
    return sources
end


-- =============================================================================
-- Layout Capture
-- =============================================================================

--- Capture the current scene state as a layout preset
-- @param layout_name string: Name for the layout
-- @param options table: Optional { duration, easing, stagger, applyVisibility }
-- @return boolean: Success
local function capture_layout(layout_name, options)
    options = options or {}
    
    if layout_name == nil or layout_name == "" then
        log_error("Layout name is required")
        return false
    end
    
    -- Get current scene
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then
        log_error("No current scene")
        return false
    end
    
    local scene_name = obs.obs_source_get_name(scene_source)
    local scene = obs.obs_scene_from_source(scene_source)
    
    if scene == nil then
        obs.obs_source_release(scene_source)
        log_error("Could not get scene object")
        return false
    end
    
    -- Enumerate all sources
    local sources = enumerate_scene_sources(scene, nil)
    
    -- Count sources
    local source_count = 0
    for _ in pairs(sources) do source_count = source_count + 1 end
    
    if source_count == 0 then
        obs.obs_source_release(scene_source)
        log_warning("No sources found in scene")
        return false
    end
    
    -- Create the layout preset
    local now = os.date("!%Y-%m-%dT%H:%M:%SZ")
    local preset = {
        id = generate_id(),
        name = layout_name,
        sceneName = scene_name,
        createdAt = now,
        updatedAt = now,
        
        animation = {
            duration = options.duration or DEFAULT_DURATION,
            easing = options.easing or DEFAULT_EASING,
            stagger = options.stagger or DEFAULT_STAGGER
        },
        
        options = {
            applyVisibility = options.applyVisibility ~= false,  -- Default true
            warnOnMissing = options.warnOnMissing ~= false,      -- Default true
            ignoreNewSources = options.ignoreNewSources ~= false -- Default true
        },
        
        sources = sources
    }
    
    -- Store in layout_presets
    if layout_presets[scene_name] == nil then
        layout_presets[scene_name] = {}
    end
    
    -- Check for existing layout with same name (update it)
    local existing = layout_presets[scene_name][layout_name]
    if existing then
        preset.id = existing.id
        preset.createdAt = existing.createdAt
        log_info("Updated layout: " .. layout_name .. " (" .. source_count .. " sources)")
    else
        log_info("Created layout: " .. layout_name .. " (" .. source_count .. " sources)")
    end
    
    layout_presets[scene_name][layout_name] = preset
    
    -- Save to OBS settings
    if settings_ref then
        save_layout_presets(settings_ref)
    end
    
    obs.obs_source_release(scene_source)
    return true
end


-- =============================================================================
-- Layout Application & Animation
-- =============================================================================

--- Build an animation plan comparing current state to target preset
-- @param preset The target layout preset
-- @param current_sources Current scene sources { name = state, ... }
-- @return table { sources_to_animate, missing_sources, new_sources }
local function build_animation_plan(preset, current_sources)
    local plan = {
        sources_to_animate = {},  -- { name, from, to, visibilityChange }
        missing_sources = {},     -- Sources in preset but not in scene
        new_sources = {}          -- Sources in scene but not in preset
    }
    
    -- Check each source in the preset
    for source_name, target_state in pairs(preset.sources) do
        local current_state = current_sources[source_name]
        
        if current_state == nil then
            -- Source is in preset but missing from scene
            table.insert(plan.missing_sources, source_name)
        else
            -- Source exists in both - plan animation
            local visibility_change = "none"
            if preset.options.applyVisibility then
                if target_state.visible and not current_state.visible then
                    visibility_change = "show"
                elseif not target_state.visible and current_state.visible then
                    visibility_change = "hide"
                end
            end
            
            table.insert(plan.sources_to_animate, {
                name = source_name,
                from = current_state,
                to = target_state,
                visibilityChange = visibility_change
            })
        end
    end
    
    -- Find sources in scene but not in preset
    for source_name, _ in pairs(current_sources) do
        if preset.sources[source_name] == nil then
            table.insert(plan.new_sources, source_name)
        end
    end
    
    return plan
end


--- Apply a transform state to a scene item
-- @param scene_item The OBS scene item
-- @param state The target state from SourceLayoutState
local function apply_transform_state(scene_item, state)
    if scene_item == nil or state == nil then return end
    
    -- Position
    set_scene_item_pos(scene_item, state.positionX, state.positionY)
    
    -- Bounds or scale
    if state.usesBounds then
        set_scene_item_bounds(scene_item, state.boundsWidth, state.boundsHeight, state.boundsType)
    else
        set_scene_item_scale(scene_item, state.scaleX, state.scaleY)
    end
    
    -- Rotation
    if state.rotation then
        set_scene_item_rotation(scene_item, state.rotation)
    end
end


--- Lerp between two transform states
-- @param from Source state
-- @param to Target state
-- @param t Progress (0-1)
-- @return Interpolated state table
local function lerp_transform_state(from, to, t)
    local result = {
        positionX = lerp(from.positionX, to.positionX, t),
        positionY = lerp(from.positionY, to.positionY, t),
        usesBounds = to.usesBounds,
        boundsType = to.boundsType,
        rotation = lerp(from.rotation or 0, to.rotation or 0, t)
    }
    
    if to.usesBounds then
        result.boundsWidth = lerp(from.boundsWidth or from.sourceWidth * from.scaleX, to.boundsWidth, t)
        result.boundsHeight = lerp(from.boundsHeight or from.sourceHeight * from.scaleY, to.boundsHeight, t)
    else
        result.scaleX = lerp(from.scaleX, to.scaleX, t)
        result.scaleY = lerp(from.scaleY, to.scaleY, t)
    end
    
    return result
end


--- Animation tick function
function layout_animation_tick()
    if not is_animating or animation_data == nil then
        obs.timer_remove(layout_animation_tick)
        timer_running = false
        return
    end
    
    local current_time = obs.os_gettime_ns() / 1000000
    local duration = animation_data.duration
    
    -- Process each source animation
    local all_complete = true
    
    for _, anim in ipairs(animation_data.animations) do
        -- Calculate progress including stagger delay
        local source_start_time = animation_data.start_time + (anim.delay or 0)
        local elapsed = current_time - source_start_time
        
        if elapsed < 0 then
            -- Hasn't started yet (stagger delay)
            all_complete = false
        else
            local progress = math.min(1.0, elapsed / duration)
            local eased = animation_data.easing_fn(progress)
            
            -- Apply interpolated transform
            if anim.scene_item ~= nil then
                local interpolated = lerp_transform_state(anim.from, anim.to, eased)
                apply_transform_state(anim.scene_item, interpolated)
            end
            
            if progress < 1.0 then
                all_complete = false
            elseif not anim.finalized then
                -- Animation complete for this source - finalize
                anim.finalized = true
                
                -- Apply exact final state
                if anim.scene_item ~= nil then
                    apply_transform_state(anim.scene_item, anim.to)
                    
                    -- Handle visibility change (show after move)
                    if anim.visibilityChange == "show" then
                        obs.obs_sceneitem_set_visible(anim.scene_item, true)
                    end
                end
            end
        end
    end
    
    if all_complete then
        is_animating = false
        animation_data = nil
        obs.timer_remove(layout_animation_tick)
        timer_running = false
        log_info("Layout animation complete")
    end
end


--- Apply a saved layout preset with animation
-- @param layout_name string: Name of the layout to apply
-- @param options table: Optional overrides { duration, easing, stagger }
-- @return boolean: Success
local function apply_layout(layout_name, options)
    options = options or {}
    
    if is_animating then
        log_warning("Animation already in progress")
        return false
    end
    
    -- Get current scene
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then
        log_error("No current scene")
        return false
    end
    
    local scene_name = obs.obs_source_get_name(scene_source)
    local scene = obs.obs_scene_from_source(scene_source)
    
    if scene == nil then
        obs.obs_source_release(scene_source)
        log_error("Could not get scene object")
        return false
    end
    
    -- Find the layout preset
    local scene_layouts = layout_presets[scene_name]
    if scene_layouts == nil then
        obs.obs_source_release(scene_source)
        log_error("No layouts saved for scene: " .. scene_name)
        return false
    end
    
    local preset = scene_layouts[layout_name]
    if preset == nil then
        obs.obs_source_release(scene_source)
        log_error("Layout not found: " .. layout_name)
        return false
    end
    
    -- Get current source states
    local current_sources = enumerate_scene_sources(scene, nil)
    
    -- Build animation plan
    local plan = build_animation_plan(preset, current_sources)
    
    -- Log warnings for missing sources
    if preset.options.warnOnMissing and #plan.missing_sources > 0 then
        log_warning("Missing sources: " .. table.concat(plan.missing_sources, ", "))
    end
    
    -- Log info about new sources
    if #plan.new_sources > 0 then
        log_info("Sources not in preset (leaving alone): " .. table.concat(plan.new_sources, ", "))
    end
    
    if #plan.sources_to_animate == 0 then
        obs.obs_source_release(scene_source)
        log_warning("No sources to animate")
        return false
    end
    
    -- Get animation settings
    local duration = options.duration or preset.animation.duration or DEFAULT_DURATION
    local easing = options.easing or preset.animation.easing or DEFAULT_EASING
    local stagger = options.stagger or preset.animation.stagger or DEFAULT_STAGGER
    
    -- Build animation data
    local animations = {}
    local delay = 0
    
    for _, source_anim in ipairs(plan.sources_to_animate) do
        local scene_item, parent_group = find_scene_item_recursive(scene, source_anim.name, nil)
        
        if scene_item then
            -- Handle visibility change (hide before move)
            if source_anim.visibilityChange == "hide" then
                -- Will hide after animation ends
            elseif source_anim.visibilityChange == "show" then
                -- Ensure visible during animation (will be positioned offscreen initially)
                -- Actually set visible after we move it
            end
            
            table.insert(animations, {
                name = source_anim.name,
                scene_item = scene_item,
                from = source_anim.from,
                to = source_anim.to,
                visibilityChange = source_anim.visibilityChange,
                delay = delay,
                finalized = false
            })
            
            delay = delay + stagger
        end
    end
    
    -- Start animation
    animation_data = {
        preset = preset,
        scene = scene,
        animations = animations,
        duration = duration,
        easing_fn = get_easing(easing),
        start_time = obs.os_gettime_ns() / 1000000
    }
    
    is_animating = true
    
    if not timer_running then
        obs.timer_add(layout_animation_tick, ANIM_FRAME_MS)
        timer_running = true
    end
    
    log_info("Applying layout: " .. layout_name .. " (" .. #animations .. " sources, " .. duration .. "ms)")
    
    obs.obs_source_release(scene_source)
    return true
end


-- =============================================================================
-- Layout Management
-- =============================================================================

--- Get all layouts for the current scene
-- @return table: { layout_name = layout_preset, ... }
local function get_current_scene_layouts()
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then return {} end
    
    local scene_name = obs.obs_source_get_name(scene_source)
    obs.obs_source_release(scene_source)
    
    return layout_presets[scene_name] or {}
end


--- List layout names for current scene
-- @return table: Array of layout names
local function list_layouts()
    local layouts = get_current_scene_layouts()
    local names = {}
    
    for name, _ in pairs(layouts) do
        table.insert(names, name)
    end
    
    table.sort(names)
    return names
end


--- Delete a layout
-- @param layout_name string
-- @return boolean
local function delete_layout(layout_name)
    local scene_source = obs.obs_frontend_get_current_scene()
    if scene_source == nil then return false end
    
    local scene_name = obs.obs_source_get_name(scene_source)
    obs.obs_source_release(scene_source)
    
    if layout_presets[scene_name] and layout_presets[scene_name][layout_name] then
        layout_presets[scene_name][layout_name] = nil
        log_info("Deleted layout: " .. layout_name)
        
        if settings_ref then
            save_layout_presets(settings_ref)
        end
        return true
    end
    
    return false
end


--- Get a specific layout's details
-- @param layout_name string
-- @return table or nil
local function get_layout(layout_name)
    local layouts = get_current_scene_layouts()
    return layouts[layout_name]
end


-- =============================================================================
-- Persistence
-- =============================================================================

local function save_layout_presets(settings)
    -- Convert to JSON-friendly format
    local data = obs.obs_data_create()
    
    for scene_name, scene_layouts in pairs(layout_presets) do
        local scene_data = obs.obs_data_create()
        
        for layout_name, preset in pairs(scene_layouts) do
            local layout_data = obs.obs_data_create()
            
            -- Basic info
            obs.obs_data_set_string(layout_data, "id", preset.id)
            obs.obs_data_set_string(layout_data, "name", preset.name)
            obs.obs_data_set_string(layout_data, "sceneName", preset.sceneName)
            obs.obs_data_set_string(layout_data, "createdAt", preset.createdAt)
            obs.obs_data_set_string(layout_data, "updatedAt", preset.updatedAt)
            
            -- Animation settings
            local anim_data = obs.obs_data_create()
            obs.obs_data_set_int(anim_data, "duration", preset.animation.duration)
            obs.obs_data_set_string(anim_data, "easing", preset.animation.easing)
            obs.obs_data_set_int(anim_data, "stagger", preset.animation.stagger)
            obs.obs_data_set_obj(layout_data, "animation", anim_data)
            obs.obs_data_release(anim_data)
            
            -- Options
            local opts_data = obs.obs_data_create()
            obs.obs_data_set_bool(opts_data, "applyVisibility", preset.options.applyVisibility)
            obs.obs_data_set_bool(opts_data, "warnOnMissing", preset.options.warnOnMissing)
            obs.obs_data_set_bool(opts_data, "ignoreNewSources", preset.options.ignoreNewSources)
            obs.obs_data_set_obj(layout_data, "options", opts_data)
            obs.obs_data_release(opts_data)
            
            -- Sources
            local sources_data = obs.obs_data_create()
            for source_name, state in pairs(preset.sources) do
                local source_data = obs.obs_data_create()
                
                obs.obs_data_set_bool(source_data, "visible", state.visible)
                obs.obs_data_set_double(source_data, "positionX", state.positionX)
                obs.obs_data_set_double(source_data, "positionY", state.positionY)
                obs.obs_data_set_double(source_data, "scaleX", state.scaleX)
                obs.obs_data_set_double(source_data, "scaleY", state.scaleY)
                obs.obs_data_set_bool(source_data, "usesBounds", state.usesBounds)
                obs.obs_data_set_double(source_data, "boundsWidth", state.boundsWidth)
                obs.obs_data_set_double(source_data, "boundsHeight", state.boundsHeight)
                obs.obs_data_set_int(source_data, "boundsType", state.boundsType)
                obs.obs_data_set_double(source_data, "sourceWidth", state.sourceWidth)
                obs.obs_data_set_double(source_data, "sourceHeight", state.sourceHeight)
                obs.obs_data_set_double(source_data, "rotation", state.rotation or 0)
                obs.obs_data_set_bool(source_data, "inGroup", state.inGroup)
                obs.obs_data_set_string(source_data, "groupName", state.groupName or "")
                
                obs.obs_data_set_obj(sources_data, source_name, source_data)
                obs.obs_data_release(source_data)
            end
            obs.obs_data_set_obj(layout_data, "sources", sources_data)
            obs.obs_data_release(sources_data)
            
            obs.obs_data_set_obj(scene_data, layout_name, layout_data)
            obs.obs_data_release(layout_data)
        end
        
        obs.obs_data_set_obj(data, scene_name, scene_data)
        obs.obs_data_release(scene_data)
    end
    
    local json = obs.obs_data_get_json(data)
    obs.obs_data_set_string(settings, "layout_presets_json", json)
    obs.obs_data_release(data)
    
    log_info("Saved layout presets")
end


local function load_layout_presets(settings)
    layout_presets = {}
    
    local json = obs.obs_data_get_string(settings, "layout_presets_json")
    if json == nil or json == "" then
        log_info("No saved layouts found")
        return
    end
    
    local data = obs.obs_data_create_from_json(json)
    if data == nil then
        log_error("Failed to parse layouts JSON")
        return
    end
    
    -- Iterate scenes (we need to get keys manually since Lua OBS API doesn't have iterator)
    -- This is a limitation - we'll need to track scene names separately
    -- For now, we'll store a list of scene names
    
    -- Actually, let's parse the JSON differently using the string directly
    -- This is a workaround for OBS Lua API limitations
    
    obs.obs_data_release(data)
    
    -- Alternative: Store as array of presets
    local presets_array = obs.obs_data_get_array(settings, "layout_presets")
    if presets_array == nil then
        log_info("No layouts array found")
        return
    end
    
    local count = obs.obs_data_array_count(presets_array)
    for i = 0, count - 1 do
        local item = obs.obs_data_array_item(presets_array, i)
        
        local scene_name = obs.obs_data_get_string(item, "sceneName")
        local layout_name = obs.obs_data_get_string(item, "name")
        
        if scene_name ~= "" and layout_name ~= "" then
            if layout_presets[scene_name] == nil then
                layout_presets[scene_name] = {}
            end
            
            -- Reconstruct preset
            local anim = obs.obs_data_get_obj(item, "animation")
            local opts = obs.obs_data_get_obj(item, "options")
            local sources_data = obs.obs_data_get_obj(item, "sources")
            
            local preset = {
                id = obs.obs_data_get_string(item, "id"),
                name = layout_name,
                sceneName = scene_name,
                createdAt = obs.obs_data_get_string(item, "createdAt"),
                updatedAt = obs.obs_data_get_string(item, "updatedAt"),
                animation = {
                    duration = anim and obs.obs_data_get_int(anim, "duration") or DEFAULT_DURATION,
                    easing = anim and obs.obs_data_get_string(anim, "easing") or DEFAULT_EASING,
                    stagger = anim and obs.obs_data_get_int(anim, "stagger") or DEFAULT_STAGGER
                },
                options = {
                    applyVisibility = opts and obs.obs_data_get_bool(opts, "applyVisibility") or true,
                    warnOnMissing = opts and obs.obs_data_get_bool(opts, "warnOnMissing") or true,
                    ignoreNewSources = opts and obs.obs_data_get_bool(opts, "ignoreNewSources") or true
                },
                sources = {}
            }
            
            -- Load sources from sources_list array
            local sources_list = obs.obs_data_get_array(item, "sources_list")
            if sources_list then
                local src_count = obs.obs_data_array_count(sources_list)
                for j = 0, src_count - 1 do
                    local src = obs.obs_data_array_item(sources_list, j)
                    local src_name = obs.obs_data_get_string(src, "sourceName")
                    
                    if src_name ~= "" then
                        preset.sources[src_name] = {
                            sourceName = src_name,
                            visible = obs.obs_data_get_bool(src, "visible"),
                            positionX = obs.obs_data_get_double(src, "positionX"),
                            positionY = obs.obs_data_get_double(src, "positionY"),
                            scaleX = obs.obs_data_get_double(src, "scaleX"),
                            scaleY = obs.obs_data_get_double(src, "scaleY"),
                            usesBounds = obs.obs_data_get_bool(src, "usesBounds"),
                            boundsWidth = obs.obs_data_get_double(src, "boundsWidth"),
                            boundsHeight = obs.obs_data_get_double(src, "boundsHeight"),
                            boundsType = obs.obs_data_get_int(src, "boundsType"),
                            sourceWidth = obs.obs_data_get_double(src, "sourceWidth"),
                            sourceHeight = obs.obs_data_get_double(src, "sourceHeight"),
                            rotation = obs.obs_data_get_double(src, "rotation"),
                            inGroup = obs.obs_data_get_bool(src, "inGroup"),
                            groupName = obs.obs_data_get_string(src, "groupName")
                        }
                    end
                    
                    obs.obs_data_release(src)
                end
                obs.obs_data_array_release(sources_list)
            end
            
            if anim then obs.obs_data_release(anim) end
            if opts then obs.obs_data_release(opts) end
            if sources_data then obs.obs_data_release(sources_data) end
            
            layout_presets[scene_name][layout_name] = preset
        end
        
        obs.obs_data_release(item)
    end
    
    obs.obs_data_array_release(presets_array)
    
    -- Count loaded
    local total = 0
    for scene_name, scene_layouts in pairs(layout_presets) do
        for layout_name, _ in pairs(scene_layouts) do
            total = total + 1
        end
    end
    
    log_info("Loaded " .. total .. " layout presets")
end


-- Improved save that uses arrays (more compatible)
local function save_layout_presets_v2(settings)
    local presets_array = obs.obs_data_array_create()
    
    for scene_name, scene_layouts in pairs(layout_presets) do
        for layout_name, preset in pairs(scene_layouts) do
            local item = obs.obs_data_create()
            
            -- Basic info
            obs.obs_data_set_string(item, "id", preset.id)
            obs.obs_data_set_string(item, "name", preset.name)
            obs.obs_data_set_string(item, "sceneName", preset.sceneName)
            obs.obs_data_set_string(item, "createdAt", preset.createdAt)
            obs.obs_data_set_string(item, "updatedAt", preset.updatedAt)
            
            -- Animation settings
            local anim_data = obs.obs_data_create()
            obs.obs_data_set_int(anim_data, "duration", preset.animation.duration)
            obs.obs_data_set_string(anim_data, "easing", preset.animation.easing)
            obs.obs_data_set_int(anim_data, "stagger", preset.animation.stagger)
            obs.obs_data_set_obj(item, "animation", anim_data)
            obs.obs_data_release(anim_data)
            
            -- Options
            local opts_data = obs.obs_data_create()
            obs.obs_data_set_bool(opts_data, "applyVisibility", preset.options.applyVisibility)
            obs.obs_data_set_bool(opts_data, "warnOnMissing", preset.options.warnOnMissing)
            obs.obs_data_set_bool(opts_data, "ignoreNewSources", preset.options.ignoreNewSources)
            obs.obs_data_set_obj(item, "options", opts_data)
            obs.obs_data_release(opts_data)
            
            -- Sources as array
            local sources_array = obs.obs_data_array_create()
            for source_name, state in pairs(preset.sources) do
                local src = obs.obs_data_create()
                
                obs.obs_data_set_string(src, "sourceName", source_name)
                obs.obs_data_set_bool(src, "visible", state.visible)
                obs.obs_data_set_double(src, "positionX", state.positionX)
                obs.obs_data_set_double(src, "positionY", state.positionY)
                obs.obs_data_set_double(src, "scaleX", state.scaleX)
                obs.obs_data_set_double(src, "scaleY", state.scaleY)
                obs.obs_data_set_bool(src, "usesBounds", state.usesBounds)
                obs.obs_data_set_double(src, "boundsWidth", state.boundsWidth)
                obs.obs_data_set_double(src, "boundsHeight", state.boundsHeight)
                obs.obs_data_set_int(src, "boundsType", state.boundsType)
                obs.obs_data_set_double(src, "sourceWidth", state.sourceWidth)
                obs.obs_data_set_double(src, "sourceHeight", state.sourceHeight)
                obs.obs_data_set_double(src, "rotation", state.rotation or 0)
                obs.obs_data_set_bool(src, "inGroup", state.inGroup)
                obs.obs_data_set_string(src, "groupName", state.groupName or "")
                
                obs.obs_data_array_push_back(sources_array, src)
                obs.obs_data_release(src)
            end
            obs.obs_data_set_array(item, "sources_list", sources_array)
            obs.obs_data_array_release(sources_array)
            
            obs.obs_data_array_push_back(presets_array, item)
            obs.obs_data_release(item)
        end
    end
    
    obs.obs_data_set_array(settings, "layout_presets", presets_array)
    obs.obs_data_array_release(presets_array)
    
    log_info("Saved layout presets (v2 format)")
end


-- =============================================================================
-- Hotkey Handlers
-- =============================================================================

local function create_layout_hotkey_callback(layout_name)
    return function(pressed)
        if pressed then
            apply_layout(layout_name)
        end
    end
end


local function register_layout_hotkey(layout_name, index)
    local hotkey_name = "layout_apply_" .. index
    local hotkey_desc = "Apply Layout: " .. layout_name
    
    local callback = create_layout_hotkey_callback(layout_name)
    local id = obs.obs_hotkey_register_frontend(hotkey_name, hotkey_desc, callback)
    
    return id
end


local function update_hotkeys()
    -- Unregister existing hotkeys
    for _, id in pairs(hotkey_ids) do
        if id and id ~= obs.OBS_INVALID_HOTKEY_ID then
            obs.obs_hotkey_unregister(id)
        end
    end
    hotkey_ids = {}
    
    -- Register new hotkeys for current scene layouts
    local layouts = list_layouts()
    for i, name in ipairs(layouts) do
        if i <= 9 then  -- Only register 1-9
            hotkey_ids[name] = register_layout_hotkey(name, i)
        end
    end
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2> Source Layout Presets v1.0</h2>
<p>Save and apply layout presets with smooth animations.</p>

<h3>Features:</h3>
<ul>
    <li><b>Save Layouts</b> - Capture all source positions/sizes in current scene</li>
    <li><b>Apply Layouts</b> - Smoothly animate to saved positions</li>
    <li><b>Staggered Animation</b> - Cinematic sequential transitions</li>
    <li><b>Hotkeys</b> - Quick-switch between layouts</li>
</ul>

<h3>Usage:</h3>
<ol>
    <li>Arrange your sources how you want them</li>
    <li>Enter a name and click "Save Current Layout"</li>
    <li>Rearrange sources or apply a different layout</li>
    <li>Click "Apply" to animate back to saved positions</li>
</ol>

<p><b>Tip:</b> Assign hotkeys in Settings  Hotkeys for quick switching!</p>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end


function script_properties()
    local props = obs.obs_properties_create()
    
    -- ==========================================================================
    -- Save Layout Section
    -- ==========================================================================
    obs.obs_properties_add_text(props, "h1",
        "═══════════ SAVE LAYOUT ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_text(props, "new_layout_name", "Layout Name", obs.OBS_TEXT_DEFAULT)
    
    obs.obs_properties_add_button(props, "capture_btn", " Save Current Layout",
        function(properties, property)
            if settings_ref == nil then return false end
            
            local name = obs.obs_data_get_string(settings_ref, "new_layout_name")
            if name == "" then
                log_error("Enter a layout name first, ye scurvy dog!")
                return false
            end
            
            local duration = obs.obs_data_get_int(settings_ref, "default_duration")
            local easing = obs.obs_data_get_string(settings_ref, "default_easing")
            local stagger = obs.obs_data_get_int(settings_ref, "default_stagger")
            
            local success = capture_layout(name, {
                duration = duration,
                easing = easing,
                stagger = stagger
            })
            
            if success then
                obs.obs_data_set_string(settings_ref, "new_layout_name", "")
                update_hotkeys()
            end
            
            return true
        end)
    
    -- ==========================================================================
    -- Apply Layout Section
    -- ==========================================================================
    obs.obs_properties_add_text(props, "h2",
        "═══════════ APPLY LAYOUT ═══════════", obs.OBS_TEXT_INFO)
    
    local layout_list = obs.obs_properties_add_list(props, "selected_layout", "Layout",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(layout_list, "(Select a layout)", "")
    
    local layouts = list_layouts()
    for _, name in ipairs(layouts) do
        local preset = get_layout(name)
        local source_count = 0
        if preset and preset.sources then
            for _ in pairs(preset.sources) do source_count = source_count + 1 end
        end
        local display = name .. " (" .. source_count .. " sources)"
        obs.obs_property_list_add_string(layout_list, display, name)
    end
    
    obs.obs_properties_add_button(props, "apply_btn", "▶ Apply Selected Layout",
        function(properties, property)
            if settings_ref == nil then return false end
            
            local name = obs.obs_data_get_string(settings_ref, "selected_layout")
            if name == "" then
                log_error("Select a layout first!")
                return false
            end
            
            apply_layout(name)
            return false
        end)
    
    -- ==========================================================================
    -- Animation Settings
    -- ==========================================================================
    obs.obs_properties_add_text(props, "h3",
        "═══════════ ANIMATION SETTINGS ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_int_slider(props, "default_duration", "Duration (ms)", 100, 2000, 50)
    
    local easing_list = obs.obs_properties_add_list(props, "default_easing", "Easing",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(easing_list, "Ease Out ", "ease_out")
    obs.obs_property_list_add_string(easing_list, "Ease In/Out", "ease_in_out")
    obs.obs_property_list_add_string(easing_list, "Ease In", "ease_in")
    obs.obs_property_list_add_string(easing_list, "Linear", "linear")
    obs.obs_property_list_add_string(easing_list, "Bounce", "bounce")
    obs.obs_property_list_add_string(easing_list, "Elastic", "elastic")
    obs.obs_property_list_add_string(easing_list, "Back", "back")
    
    obs.obs_properties_add_int_slider(props, "default_stagger", "Stagger (ms)", 0, 200, 10)
    
    -- ==========================================================================
    -- Manage Layouts
    -- ==========================================================================
    obs.obs_properties_add_text(props, "h4",
        "═══════════ MANAGE ═══════════", obs.OBS_TEXT_INFO)
    
    local delete_list = obs.obs_properties_add_list(props, "delete_layout", "Delete Layout",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(delete_list, "(Select)", "")
    for _, name in ipairs(layouts) do
        obs.obs_property_list_add_string(delete_list, name, name)
    end
    
    obs.obs_properties_add_button(props, "delete_btn", "[EMOJI]️ Delete Selected",
        function(properties, property)
            if settings_ref == nil then return false end
            
            local name = obs.obs_data_get_string(settings_ref, "delete_layout")
            if name == "" then return false end
            
            delete_layout(name)
            update_hotkeys()
            return true
        end)
    
    obs.obs_properties_add_button(props, "list_btn", "[EMOJI] List All Layouts",
        function(properties, property)
            log_info("=== Layouts for Current Scene ===")
            local layouts = list_layouts()
            if #layouts == 0 then
                log_info("No layouts saved")
            else
                for i, name in ipairs(layouts) do
                    local preset = get_layout(name)
                    local source_count = 0
                    if preset and preset.sources then
                        for _ in pairs(preset.sources) do source_count = source_count + 1 end
                    end
                    log_info(i .. ". " .. name .. " (" .. source_count .. " sources)")
                end
            end
            return false
        end)
    
    obs.obs_properties_add_button(props, "refresh_btn", "[EMOJI] Refresh",
        function(properties, property)
            return true
        end)
    
    -- ==========================================================================
    -- Info
    -- ==========================================================================
    obs.obs_properties_add_text(props, "h5",
        "═══════════ INFO ═══════════", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "hotkey_info",
        "[EMOJI] Hotkeys: Settings  Hotkeys  'Apply Layout: [name]'", obs.OBS_TEXT_INFO)
    
    return props
end


function script_defaults(settings)
    obs.obs_data_set_default_int(settings, "default_duration", DEFAULT_DURATION)
    obs.obs_data_set_default_string(settings, "default_easing", DEFAULT_EASING)
    obs.obs_data_set_default_int(settings, "default_stagger", DEFAULT_STAGGER)
end


function script_update(settings)
    settings_ref = settings
end


function script_load(settings)
    settings_ref = settings
    log_info("Loading Source Layout Presets v1.0...")
    
    load_layout_presets(settings)
    update_hotkeys()
    
    log_info("Loaded! Ready to save and apply layouts.")
end


function script_save(settings)
    save_layout_presets_v2(settings)
    
    -- Save hotkey bindings
    for name, id in pairs(hotkey_ids) do
        if id and id ~= obs.OBS_INVALID_HOTKEY_ID then
            local hotkey_save = obs.obs_hotkey_save(id)
            obs.obs_data_set_array(settings, "hotkey_" .. name, hotkey_save)
            obs.obs_data_array_release(hotkey_save)
        end
    end
end


function script_unload()
    log_info("Unloading Source Layout Presets...")
    
    -- Stop any running animation
    if timer_running then
        obs.timer_remove(layout_animation_tick)
        timer_running = false
    end
    is_animating = false
    animation_data = nil
    
    -- Unregister hotkeys
    for _, id in pairs(hotkey_ids) do
        if id and id ~= obs.OBS_INVALID_HOTKEY_ID then
            obs.obs_hotkey_unregister(id)
        end
    end
    hotkey_ids = {}
    
    log_info("Unloaded.")
end

