# Twitch Clips Player - Strixun Stream Suite

## What is this?

A Twitch Clips Player browser source overlay for OBS Studio. Part of the [Strixun Stream Suite](https://github.com/Underwood-Inc/strixun-stream-suite).

This grabs your Twitch clips and plays them one after the other in a loop. Keep your viewers entertained on your BRB or starting soon scenes.

## Quick Start

1. **Open the Control Panel** - Use `control_panel.html` in your browser or as an OBS dock
2. **Go to Setup** → Configure your Twitch API settings
3. **Go to Clips** → Create a clips player configuration
4. **Copy the generated URL** → Add as Browser Source in OBS

[Live Demo](https://underwood-inc.github.io/strixun-stream-suite/)

## Features

- **Chat Controls**: !clipskip, !clippause, !clipplay, !clipreload (Mods/Streamer only)
- **Following Mode**: Show clips from channels you follow
- **Custom Commands**: Trigger clips with custom chat commands
- **Date Range Filter**: Only show recent clips
- **Details Panel**: Customizable lower-third with clip info
- **Multiple Themes**: Pre-built CSS themes

## Setup Requirements

1. **Cloudflare Worker** - Deploy your own API proxy (see `serverless/SETUP.md`)
2. **Twitch App** - Create app at [dev.twitch.tv/console](https://dev.twitch.tv/console)
3. **Configure in Control Panel** - Enter your Client ID and API Server URL

## URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `api` | string | **Required** - Your Cloudflare Worker URL |
| `channel` | string | Channel name or comma-separated list |
| `mainChannel` | string | Main channel for chat commands |
| `limit` | integer | Max clips to fetch (max 100) |
| `dateRange` | integer | Only clips from last N days |
| `preferFeatured` | boolean | Prefer featured clips |
| `showText` | boolean | Show channel name overlay |
| `showDetails` | boolean | Show details panel |
| `detailsText` | string | Custom details template (supports {channel}, {title}, {game}, {creator_name}, {created_at}) |
| `customText` | string | Custom overlay message (supports {channel}) |
| `command` | string | Custom chat command to trigger playback |
| `showFollowing` | boolean | Show clips from followed channels |
| `ref` | base64 | Access token (for following/chat features) |
| `themeOption` | integer | CSS theme selection |

## OBS Browser Source Settings

- **Shutdown source when not visible**: ✅ Enabled
- **Refresh browser when scene becomes active**: ✅ Enabled

This prevents background playback and refreshes clips when the scene activates.

## Custom CSS (Optional)

Add to OBS browser source CSS properties:

```css
video {
    width: 1280px;
    height: 720px;
    background-color: #000000;
}

#container {
    padding: 0;
    margin: 0;
}

#details-container {
    top: 44vw;
}
```

## Credits

Based on [twitch_clips_player](https://github.com/teklynk/twitch_clips_player) by teklynk.
