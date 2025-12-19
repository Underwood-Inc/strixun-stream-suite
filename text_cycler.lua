--[[
    Text Cycler v1.0
    Cycles through text strings with optional transition animations
    
    Transitions:
    - None: Instant switch
    - Obfuscate: Minecraft enchantment table scramble effect
    - Typewriter: Types out character by character
    - Glitch: Random glitch characters
--]]

local obs = obslua
local bit = require("bit")

-- Constants
local SCRIPT_NAME = "TextCycler"
local FRAME_MS = 16 -- ~60 FPS

-- State
local settings_ref = nil
local source_name = ""
local text_lines = {}
local cycle_duration = 3000 -- ms per text
local transition_type = "none"
local transition_duration = 500 -- ms
local current_index = 1
local is_running = false
local is_transitioning = false
local transition_start = 0
local cycle_timer_active = false
local transition_timer_active = false
local debug_mode = false

-- Character sets for effects
local CHARS_STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
local CHARS_ENCHANT = "ᔑᒷᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ⚍⍊∴̇/||⨅" -- Minecraft Standard Galactic Alphabet-ish
local CHARS_GLITCH = "█▓▒░╔╗╚╝║═┌┐└┘│─┼▀▄▌▐■□▪▫●○◘◙◄►▲▼"

-- Logging
local function log_info(msg)
    obs.script_log(obs.LOG_INFO, "[" .. SCRIPT_NAME .. "] " .. msg)
end

local function log_debug(msg)
    if debug_mode then
        obs.script_log(obs.LOG_DEBUG, "[" .. SCRIPT_NAME .. "] " .. msg)
    end
end

-- Get random character from set
local function random_char(charset)
    local idx = math.random(1, #charset)
    -- Handle UTF-8 properly for enchant chars
    if charset == CHARS_ENCHANT then
        local chars = {}
        for char in charset:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
            table.insert(chars, char)
        end
        return chars[math.random(1, #chars)] or "?"
    end
    return charset:sub(idx, idx)
end

-- Get string length (UTF-8 aware)
local function utf8_len(str)
    local len = 0
    for _ in str:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        len = len + 1
    end
    return len
end

-- Get UTF-8 substring
local function utf8_sub(str, start_idx, end_idx)
    local result = {}
    local i = 0
    for char in str:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        i = i + 1
        if i >= start_idx and i <= end_idx then
            table.insert(result, char)
        end
    end
    return table.concat(result)
end

-- Set text on source
local function set_text(text)
    local source = obs.obs_get_source_by_name(source_name)
    if source then
        local settings = obs.obs_data_create()
        obs.obs_data_set_string(settings, "text", text)
        obs.obs_source_update(source, settings)
        obs.obs_data_release(settings)
        obs.obs_source_release(source)
        log_debug("Set text: " .. text:sub(1, 30) .. (text:len() > 30 and "..." or ""))
    end
end

-- Get current text from source
local function get_current_text()
    local source = obs.obs_get_source_by_name(source_name)
    if source then
        local settings = obs.obs_source_get_settings(source)
        local text = obs.obs_data_get_string(settings, "text")
        obs.obs_data_release(settings)
        obs.obs_source_release(source)
        return text
    end
    return ""
end

-- Obfuscate effect: scramble then reveal
local function obfuscate_text(target, progress)
    local len = utf8_len(target)
    if len == 0 then return target end
    
    -- How many characters are revealed (from left to right)
    local revealed = math.floor(progress * len)
    local result = {}
    
    local i = 0
    for char in target:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        i = i + 1
        if i <= revealed then
            -- Revealed character
            table.insert(result, char)
        else
            -- Still scrambled
            if char == " " then
                table.insert(result, " ")
            else
                table.insert(result, random_char(CHARS_ENCHANT))
            end
        end
    end
    
    return table.concat(result)
end

-- Typewriter effect
local function typewriter_text(target, progress)
    local len = utf8_len(target)
    local show = math.floor(progress * len)
    return utf8_sub(target, 1, show)
end

-- Glitch effect: random glitches then settle
local function glitch_text(target, progress)
    local len = utf8_len(target)
    if len == 0 then return target end
    
    local result = {}
    local glitch_chance = 1.0 - progress -- Less glitchy as we progress
    
    local i = 0
    for char in target:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        i = i + 1
        if char == " " then
            table.insert(result, " ")
        elseif math.random() < glitch_chance * 0.7 then
            table.insert(result, random_char(CHARS_GLITCH))
        else
            table.insert(result, char)
        end
    end
    
    return table.concat(result)
end

-- Scramble effect: all random then snap to final
local function scramble_text(target, progress)
    if progress >= 0.95 then return target end
    
    local len = utf8_len(target)
    if len == 0 then return target end
    
    local result = {}
    for char in target:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        if char == " " then
            table.insert(result, " ")
        else
            table.insert(result, random_char(CHARS_ENCHANT))
        end
    end
    
    return table.concat(result)
end

-- Wave reveal: characters appear in a wave pattern
local function wave_text(target, progress)
    local len = utf8_len(target)
    if len == 0 then return target end
    
    local result = {}
    local wave_width = 3
    local center = progress * (len + wave_width)
    
    local i = 0
    for char in target:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        i = i + 1
        local dist = math.abs(i - center)
        if dist < wave_width and char ~= " " then
            table.insert(result, random_char(CHARS_ENCHANT))
        elseif i < center - wave_width then
            table.insert(result, char)
        else
            table.insert(result, " ")
        end
    end
    
    return table.concat(result)
end

-- Apply transition effect
local function apply_transition(target, progress)
    if transition_type == "obfuscate" then
        return obfuscate_text(target, progress)
    elseif transition_type == "typewriter" then
        return typewriter_text(target, progress)
    elseif transition_type == "glitch" then
        return glitch_text(target, progress)
    elseif transition_type == "scramble" then
        return scramble_text(target, progress)
    elseif transition_type == "wave" then
        return wave_text(target, progress)
    else
        return target
    end
end

-- Transition animation tick
local function transition_tick()
    if not is_transitioning then
        if transition_timer_active then
            obs.timer_remove(transition_tick)
            transition_timer_active = false
        end
        return
    end
    
    local elapsed = obs.os_gettime_ns() / 1000000 - transition_start
    local progress = math.min(elapsed / transition_duration, 1.0)
    
    local target = text_lines[current_index] or ""
    local display = apply_transition(target, progress)
    set_text(display)
    
    if progress >= 1.0 then
        is_transitioning = false
        set_text(target) -- Ensure final text is exact
        obs.timer_remove(transition_tick)
        transition_timer_active = false
        log_debug("Transition complete, showing: " .. target)
    end
end

-- Start transition to next text
local function start_transition()
    if #text_lines == 0 then return end
    
    -- Move to next text
    current_index = current_index + 1
    if current_index > #text_lines then
        current_index = 1
    end
    
    local target = text_lines[current_index]
    log_debug("Transitioning to index " .. current_index .. ": " .. target)
    
    if transition_type == "none" or transition_duration <= 0 then
        set_text(target)
    else
        is_transitioning = true
        transition_start = obs.os_gettime_ns() / 1000000
        if not transition_timer_active then
            obs.timer_add(transition_tick, FRAME_MS)
            transition_timer_active = true
        end
    end
end

-- Main cycle timer
local function cycle_tick()
    if not is_running then
        if cycle_timer_active then
            obs.timer_remove(cycle_tick)
            cycle_timer_active = false
        end
        return
    end
    
    start_transition()
end

-- Start cycling
local function start_cycling()
    if #text_lines == 0 then
        log_info("No text lines configured")
        return
    end
    
    if source_name == "" then
        log_info("No source selected")
        return
    end
    
    is_running = true
    current_index = 0 -- Will become 1 on first transition
    
    -- Set first text immediately
    start_transition()
    
    -- Start cycle timer
    if not cycle_timer_active then
        obs.timer_add(cycle_tick, cycle_duration)
        cycle_timer_active = true
    end
    
    log_info("Started cycling " .. #text_lines .. " texts")
end

-- Stop cycling
local function stop_cycling()
    is_running = false
    is_transitioning = false
    
    if cycle_timer_active then
        obs.timer_remove(cycle_tick)
        cycle_timer_active = false
    end
    
    if transition_timer_active then
        obs.timer_remove(transition_tick)
        transition_timer_active = false
    end
    
    log_info("Stopped cycling")
end

-- Parse text lines from settings string
local function parse_lines(text)
    local lines = {}
    for line in text:gmatch("[^\r\n]+") do
        local trimmed = line:match("^%s*(.-)%s*$")
        if trimmed and trimmed ~= "" then
            table.insert(lines, trimmed)
        end
    end
    return lines
end

-- Get text sources in current scene
local function get_text_sources()
    local sources = {}
    local scene_source = obs.obs_frontend_get_current_scene()
    if not scene_source then return sources end
    
    local scene = obs.obs_scene_from_source(scene_source)
    if scene then
        local items = obs.obs_scene_enum_items(scene)
        if items then
            for _, item in ipairs(items) do
                local src = obs.obs_sceneitem_get_source(item)
                if src then
                    local id = obs.obs_source_get_id(src)
                    -- Text sources
                    if id == "text_gdiplus" or id == "text_ft2_source" or 
                       id == "text_gdiplus_v2" or id == "text_ft2_source_v2" then
                        table.insert(sources, obs.obs_source_get_name(src))
                    end
                end
            end
            obs.sceneitem_list_release(items)
        end
    end
    obs.obs_source_release(scene_source)
    
    return sources
end

-- ============ OBS Script Interface ============

function script_description()
    return [[<center><h2>Text Cycler v1.0</h2></center>
<p>Cycles through text strings with transition animations.</p>
<p><b>Transitions:</b> None, Obfuscate (Minecraft enchant), Typewriter, Glitch, Scramble, Wave</p>
<hr>
<p><i>Part of OBS Animation Suite</i></p>]]
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- Source selection
    local src_list = obs.obs_properties_add_list(props, "source", "Text Source",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(src_list, "-- Select Source --", "")
    for _, name in ipairs(get_text_sources()) do
        obs.obs_property_list_add_string(src_list, name, name)
    end
    
    obs.obs_properties_add_button(props, "refresh_btn", "🔄 Refresh Sources", function()
        return true
    end)
    
    -- Text lines
    obs.obs_properties_add_text(props, "texts", "Text Lines (one per line)", 
        obs.OBS_TEXT_MULTILINE)
    
    -- Timing
    obs.obs_properties_add_int(props, "cycle_duration", "Duration per text (ms)", 
        500, 60000, 100)
    
    -- Transition
    local trans_list = obs.obs_properties_add_list(props, "transition", "Transition",
        obs.OBS_COMBO_TYPE_LIST, obs.OBS_COMBO_FORMAT_STRING)
    obs.obs_property_list_add_string(trans_list, "None (instant)", "none")
    obs.obs_property_list_add_string(trans_list, "Obfuscate (Minecraft)", "obfuscate")
    obs.obs_property_list_add_string(trans_list, "Typewriter", "typewriter")
    obs.obs_property_list_add_string(trans_list, "Glitch", "glitch")
    obs.obs_property_list_add_string(trans_list, "Scramble", "scramble")
    obs.obs_property_list_add_string(trans_list, "Wave", "wave")
    
    obs.obs_properties_add_int(props, "trans_duration", "Transition duration (ms)", 
        100, 5000, 50)
    
    -- Controls
    obs.obs_properties_add_button(props, "start_btn", "▶️ Start Cycling", function()
        start_cycling()
        return false
    end)
    
    obs.obs_properties_add_button(props, "stop_btn", "⏹️ Stop", function()
        stop_cycling()
        return false
    end)
    
    obs.obs_properties_add_button(props, "preview_btn", "👁️ Preview Transition", function()
        if source_name ~= "" and #text_lines > 0 then
            current_index = 0
            start_transition()
        end
        return false
    end)
    
    -- Debug
    obs.obs_properties_add_bool(props, "debug", "Debug Logging")
    
    return props
end

function script_defaults(settings)
    obs.obs_data_set_default_string(settings, "texts", "Hello World\nWelcome\nSubscribe!")
    obs.obs_data_set_default_int(settings, "cycle_duration", 3000)
    obs.obs_data_set_default_string(settings, "transition", "obfuscate")
    obs.obs_data_set_default_int(settings, "trans_duration", 500)
    obs.obs_data_set_default_bool(settings, "debug", false)
end

function script_update(settings)
    settings_ref = settings
    
    local was_running = is_running
    if was_running then
        stop_cycling()
    end
    
    source_name = obs.obs_data_get_string(settings, "source")
    text_lines = parse_lines(obs.obs_data_get_string(settings, "texts"))
    cycle_duration = obs.obs_data_get_int(settings, "cycle_duration")
    transition_type = obs.obs_data_get_string(settings, "transition")
    transition_duration = obs.obs_data_get_int(settings, "trans_duration")
    debug_mode = obs.obs_data_get_bool(settings, "debug")
    
    log_debug("Updated: source=" .. source_name .. ", lines=" .. #text_lines .. 
              ", transition=" .. transition_type)
    
    if was_running and source_name ~= "" and #text_lines > 0 then
        start_cycling()
    end
end

function script_load(settings)
    math.randomseed(os.time())
    log_info("Text Cycler loaded")
end

function script_unload()
    stop_cycling()
    log_info("Text Cycler unloaded")
end
