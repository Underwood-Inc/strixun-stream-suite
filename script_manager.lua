--[[
================================================================================
OBS Animation Scripts Manager (Lua)
================================================================================

A unified dashboard to manage and configure all animation scripts in this suite.
Toggle scripts on/off and see their status at a glance.

Scripts Managed:
    - Source Animations (visibility animations)
    - Source Swap (swap two sources with animation)

Author: OBS Animation System
Version: 1.0.0
================================================================================
--]]

obs = obslua

-- =============================================================================
-- Configuration
-- =============================================================================

local SCRIPT_PATH = ""

-- Script enable/disable states (persisted)
local source_anim_enabled = true
local source_swap_enabled = true

-- Script info
local scripts = {
    {
        id = "source_animations",
        name = "Source Animations",
        file = "source_animations.lua",
        description = "Animates sources when visibility is toggled (fade, slide, zoom, pop)",
        enabled = true
    },
    {
        id = "source_swap",
        name = "Source Swap",
        file = "source_swap.lua",
        description = "Smoothly swap position and size of two sources",
        enabled = true
    },
    {
        id = "source_layouts",
        name = "Source Layouts",
        file = "source_layouts.lua",
        description = "Save and apply layout presets with smooth multi-source animation",
        enabled = true
    },
    {
        id = "quick_controls",
        name = "Quick Controls",
        file = "quick_controls.lua",
        description = "Hotkey to cycle aspect override mode",
        enabled = true
    },
    {
        id = "text_cycler",
        name = "Text Cycler",
        file = "text_cycler.lua",
        description = "Cycle text with animated transitions (obfuscate, typewriter, glitch)",
        enabled = true
    }
}

-- Settings reference
local settings_ref = nil


-- =============================================================================
-- Logging
-- =============================================================================

local function log_info(msg)
    obs.script_log(obs.LOG_INFO, "[ScriptMgr] " .. msg)
end

local function log_warning(msg)
    obs.script_log(obs.LOG_WARNING, "[ScriptMgr] " .. msg)
end

local function log_error(msg)
    obs.script_log(obs.LOG_ERROR, "[ScriptMgr] " .. msg)
end


-- =============================================================================
-- Script Status Checking
-- =============================================================================

local function check_script_loaded(script_file)
    -- We can't directly check if a script is loaded in OBS
    -- But we can check if the file exists
    local full_path = SCRIPT_PATH .. script_file
    local file = io.open(full_path, "r")
    if file ~= nil then
        file:close()
        return true
    end
    return false
end

local function get_script_status()
    local status = {}
    
    for _, script in ipairs(scripts) do
        local exists = check_script_loaded(script.file)
        table.insert(status, {
            name = script.name,
            file = script.file,
            exists = exists,
            enabled = script.enabled
        })
    end
    
    return status
end


-- =============================================================================
-- OBS Script Interface
-- =============================================================================

function script_description()
    return [[<h2>[EMOJI] Stream Suite Script Manager</h2>
<p>Central dashboard for Strixun's Stream Suite scripts.</p>

<h3>Included Scripts:</h3>
<table>
<tr><td><b>Source Animations</b></td><td>Animate on visibility toggle</td></tr>
<tr><td><b>Source Swap</b></td><td>Swap two sources with animation</td></tr>
<tr><td><b>Source Layouts</b></td><td>Save/apply layout presets</td></tr>
<tr><td><b>Text Cycler</b></td><td>Animated text cycling effects</td></tr>
<tr><td><b>Quick Controls</b></td><td>Hotkeys and quick actions</td></tr>
</table>

<h3>How to Use:</h3>
<ol>
    <li>Load all scripts you want to use via <b>Tools [EMOJI] Scripts [EMOJI] +</b></li>
    <li>This manager shows status and quick info</li>
    <li>Click on individual scripts to configure them</li>
</ol>

<h3>Quick Tips:</h3>
<ul>
    <li>First visibility toggle caches state - animation starts on second toggle</li>
    <li>Check <b>View [EMOJI] Script Log</b> for debugging info</li>
    <li>Use the buttons below to check script status</li>
</ul>
<hr>
<p><i>Part of Strixun's Stream Suite</i></p>
]]
end

function script_properties()
    local props = obs.obs_properties_create()
    
    -- ==========================================================================
    -- Status Section
    -- ==========================================================================
    obs.obs_properties_add_text(props, "header_status", 
        "═══════════ SCRIPT STATUS ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "check_status_btn", "[ANALYTICS] Check All Scripts Status",
        function(properties, property)
            log_info("=== Animation Scripts Status ===")
            
            local status = get_script_status()
            for _, s in ipairs(status) do
                local status_str = s.exists and "[EMOJI] File exists" or "[EMOJI] File not found"
                log_info(s.name .. " (" .. s.file .. "): " .. status_str)
            end
            
            log_info("")
            log_info("To load scripts: Tools [EMOJI] Scripts [EMOJI] + [EMOJI] Select .lua file")
            log_info("To configure: Select the script in the Scripts list")
            log_info("=================================")
            return false
        end)
    
    -- ==========================================================================
    -- Quick Links
    -- ==========================================================================
    obs.obs_properties_add_text(props, "header_scripts", 
        "═══════════ AVAILABLE SCRIPTS ═══════════", obs.OBS_TEXT_INFO)
    
    -- Source Animations Info
    obs.obs_properties_add_text(props, "info_source_anim", 
        "[PACKAGE] SOURCE ANIMATIONS (source_animations.lua)", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "info_source_anim_desc", 
        "   Adds fade/slide/zoom/pop animations when sources become visible or hidden.", 
        obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "test_source_anim_btn", "   [EMOJI] Test Source Animation Log",
        function(properties, property)
            log_info("[Source Animations] If loaded, check that:")
            log_info("  1. 'Animate on SHOW' or 'Animate on HIDE' is enabled")
            log_info("  2. Source is configured (or default animation is set)")
            log_info("  3. Toggle visibility TWICE (first caches, second animates)")
            return false
        end)
    
    -- Source Swap Info
    obs.obs_properties_add_text(props, "info_source_swap", 
        "[PACKAGE] SOURCE SWAP (source_swap.lua)", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "info_source_swap_desc", 
        "   Smoothly swap position/size of two sources. Great for PiP layouts!", 
        obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "test_source_swap_btn", "   [EMOJI] Test Source Swap Log",
        function(properties, property)
            log_info("[Source Swap] If loaded, check that:")
            log_info("  1. Both Source A and Source B are selected")
            log_info("  2. Both sources exist in the CURRENT scene")
            log_info("  3. Use 'Show Source Transforms' button to debug")
            return false
        end)
    
    -- Text Cycler Info
    obs.obs_properties_add_text(props, "info_text_cycler", 
        "[PACKAGE] TEXT CYCLER (text_cycler.lua)", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "info_text_cycler_desc", 
        "   Cycle text with transitions: obfuscate, typewriter, glitch, wave.", 
        obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "test_text_cycler_btn", "   [EMOJI] Test Text Cycler Log",
        function(properties, property)
            log_info("[Text Cycler] If loaded, check that:")
            log_info("  1. A TEXT source is selected (not image/media)")
            log_info("  2. At least one text line is entered")
            log_info("  3. Click 'Start Cycling' to begin")
            return false
        end)
    
    -- Source Layouts Info
    obs.obs_properties_add_text(props, "info_source_layouts", 
        "[PACKAGE] SOURCE LAYOUTS (source_layouts.lua)", obs.OBS_TEXT_INFO)
    obs.obs_properties_add_text(props, "info_source_layouts_desc", 
        "   Save and apply layout presets - animate all sources to saved positions.", 
        obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "test_source_layouts_btn", "   [EMOJI] Test Source Layouts Log",
        function(properties, property)
            log_info("[Source Layouts] If loaded, check that:")
            log_info("  1. Arrange sources how you want them")
            log_info("  2. Enter a name and click 'Save Current Layout'")
            log_info("  3. Select a layout and click 'Apply' to animate")
            log_info("  4. Assign hotkeys in Settings [EMOJI] Hotkeys")
            return false
        end)
    
    -- ==========================================================================
    -- Troubleshooting
    -- ==========================================================================
    obs.obs_properties_add_text(props, "header_trouble", 
        "═══════════ TROUBLESHOOTING ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_button(props, "open_log_btn", "[CLIPBOARD] Show Common Issues",
        function(properties, property)
            log_info("=== Common Issues & Solutions ===")
            log_info("")
            log_info("[ERROR] Animation not playing on visibility toggle:")
            log_info("   [EMOJI] First toggle CACHES the state, second toggle animates")
            log_info("   [EMOJI] Check 'Animate on SHOW/HIDE' is enabled")
            log_info("   [EMOJI] Try clicking 'Refresh Source Lists'")
            log_info("")
            log_info("[ERROR] Hide animation not working:")
            log_info("   [EMOJI] Update to v2.1+ of source_animations.lua")
            log_info("   [EMOJI] Check 'Animate on HIDE' is enabled")
            log_info("")
            log_info("[ERROR] Swap not working:")
            log_info("   [EMOJI] Both sources must be in CURRENT scene")
            log_info("   [EMOJI] Click 'List Sources in Current Scene' to verify")
            log_info("   [EMOJI] Source names are CASE-SENSITIVE")
            log_info("")
            log_info("[ERROR] Script errors:")
            log_info("   [EMOJI] View [EMOJI] Script Log for details")
            log_info("   [EMOJI] Remove and re-add the script")
            log_info("=================================")
            return false
        end)
    
    obs.obs_properties_add_button(props, "show_path_btn", "[FOLDER] Show Script Folder Path",
        function(properties, property)
            log_info("Script folder: " .. SCRIPT_PATH)
            return false
        end)
    
    -- ==========================================================================
    -- Version Info
    -- ==========================================================================
    obs.obs_properties_add_text(props, "header_version", 
        "═══════════ VERSION INFO ═══════════", obs.OBS_TEXT_INFO)
    
    obs.obs_properties_add_text(props, "version_info", 
        "Manager v1.3 | Animations v2.8.1 | Swap v3.1 | Layouts v1.0 | TextCycler v1.0", 
        obs.OBS_TEXT_INFO)
    
    return props
end

function script_defaults(settings)
    -- No defaults needed for manager
end

function script_update(settings)
    settings_ref = settings
end

function script_load(settings)
    SCRIPT_PATH = script_path()
    settings_ref = settings
    
    log_info("Animation Scripts Manager loaded!")
    log_info("Script folder: " .. SCRIPT_PATH)
    log_info("Use the buttons in the script panel to check status and troubleshoot.")
end

function script_save(settings)
    -- Nothing to save
end

function script_unload()
    log_info("Animation Scripts Manager unloaded.")
end

