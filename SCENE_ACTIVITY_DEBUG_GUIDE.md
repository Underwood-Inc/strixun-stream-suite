# Scene Activity Tracking - Debug Guide

## Issues Fixed

### ✅ 1. Z-Index Issue (Scene Picker Not Appearing)
**Problem:** Scene picker dropdown was behind other elements
**Fix:** 
- Changed from `position: absolute` to `position: fixed`
- Increased z-index from `1000` to `10000`
- Added dynamic position calculation based on trigger button

### ✅ 2. Scroll Layout (Current Scene Should Stay Fixed)
**Problem:** Everything scrolled, including "Current Scene:" label
**Fix:**
- Restructured layout: `info-bar` → `info-item--fixed` + `info-bar__content` (scrollable)
- "Current Scene:" now stays fixed on the left
- Scene buttons scroll horizontally on the right

### ✅ 3. Sorting Not Working (No Activity-Based Ordering)
**Problem:** Scenes not sorted by activity count
**Fix:**
- Implemented **stable sort** algorithm:
  - Primary sort: Activity count (descending - most active first)
  - Secondary sort: OBS scene index (ascending - preserves original order)
  - Result: Active scenes bubble up, but scenes with equal activity maintain OBS order
- Added extensive console logging to debug
- Verified API calls to `streamkit-api.idling.app`
- Improved error handling

---

## Sorting Algorithm

### Stable Sort with Activity Priority

The scene list uses a **stable sort** algorithm that:

1. **Primary Sort:** Activity count (descending - most active first)
   - Scenes with more switches appear earlier
   - `activityB - activityA` (higher count = lower position)

2. **Secondary Sort (Tiebreaker):** OBS scene index (ascending - original order)
   - When activity counts are equal, preserve OBS order
   - `a.sceneIndex - b.sceneIndex`

### Example

**Initial OBS Order:**
```
0. STARTING SOON    (count: 0)
1. CAMERAS          (count: 15)
2. CHAT             (count: 8)
3. GAMEPLAY         (count: 0)
4. ENDING SOON      (count: 2)
```

**After Stable Sort:**
```
0. CAMERAS          (count: 15) ← Moved up (highest activity)
1. CHAT             (count: 8)  ← Moved up (2nd highest)
2. ENDING SOON      (count: 2)  ← Moved up (3rd highest)
3. STARTING SOON    (count: 0)  ← Kept OBS order (equal activity)
4. GAMEPLAY         (count: 0)  ← Kept OBS order (equal activity)
```

**Key Benefits:**
- ✅ Most-used scenes appear first (easy access)
- ✅ Unused scenes maintain their logical OBS order
- ✅ Predictable, stable ordering (no random shuffling)
- ✅ Respects streamer's OBS organization

---

## How to Debug

### Step 1: Check Console Logs
Open browser DevTools (F12) → Console tab

**Expected logs when connecting to OBS:**
```
[InfoBar] Raw scenes from OBS: [Array of scenes]
[Scene Activity] Fetching top scenes from: http://localhost:8796/scene-activity/top?limit=20
[Scene Activity] ✓ Fetched X active scenes: [Array with counts]
[InfoBar] Activity data from API: [Array with counts]
[InfoBar] BEFORE sort (OBS order): 
  ["STARTING SOON [idx:0]", "CAMERAS [idx:1]", "CHAT [idx:2]", "GAMEPLAY [idx:3]"]
[InfoBar] AFTER sort (activity-based): 
  ["CAMERAS [idx:1, count:15]", "CHAT [idx:2, count:8]", "STARTING SOON [idx:0, count:0]", "GAMEPLAY [idx:3, count:0]"]
```

**Sorting Explanation:**
- **CAMERAS** moved from position 1 → 0 (15 switches)
- **CHAT** moved from position 2 → 1 (8 switches)
- **STARTING SOON** stayed at relative position (0 switches, maintains OBS order)
- **GAMEPLAY** stayed at relative position (0 switches, maintains OBS order)

**Key Point:** Scenes with equal activity (e.g., both 0) maintain their original OBS order (sceneIndex).

**Expected logs when switching scenes:**
```
[Scene Activity] Recording scene switch to: "CAMERAS" at http://localhost:8796/scene-activity/record
[Scene Activity] ✓ Successfully recorded: CAMERAS
```

---

## Troubleshooting

### Scene Picker Not Opening
**Check:**
1. Open Console → Look for JavaScript errors
2. Check if `scenePickerTrigger` element exists
3. Verify z-index is `10000` (inspect element)
4. Check if `position: fixed` is applied

**Fix:**
- Hard refresh (Ctrl+Shift+R)
- Clear cache and reload

---

### Sorting Not Working
**Check Console for these issues:**

#### Issue: API 404 or Connection Refused
```
[Scene Activity] ✗ Failed to fetch top scenes: TypeError: Failed to fetch
```
**Cause:** Streamkit API is not running
**Solution:** 
```bash
cd serverless/streamkit-api
pnpm dev
# Should start on http://localhost:8796
```

#### Issue: API 401 Unauthorized
```
[Scene Activity] ✗ Failed to fetch top scenes: 401 Unauthorized
```
**Cause:** Not authenticated (no auth_token cookie)
**Solution:** 
- Log in to `auth.idling.app` first
- Ensure HttpOnly cookie is set

#### Issue: Empty Activity Data
```
[Scene Activity] ✓ Fetched 0 active scenes: []
```
**Cause:** No scene switches recorded yet
**Solution:** 
- Switch between scenes a few times
- Wait for API calls to complete
- Refresh the page

#### Issue: Sorting Order Unchanged
```
[InfoBar] BEFORE sort: ["A", "B", "C"]
[InfoBar] AFTER sort: ["A", "B", "C"]  ← Same order!
```
**Cause:** Activity counts are all 0 or equal
**Solution:** 
- Switch to different scenes multiple times
- Check that `recordSceneSwitch` is being called
- Verify KV data in Cloudflare dashboard

---

### Scene Buttons Not Scrolling
**Check:**
1. Open DevTools → Inspect `.info-bar__content`
2. Verify it has `overflow-x: auto`
3. Check if scene buttons exceed container width
4. Ensure `.info-item--fixed` is NOT inside `.info-bar__content`

**Fix:**
- Resize browser window to make buttons overflow
- Check CSS specificity (use `!important` temporarily to test)

---

## Testing Checklist

### Scene Picker
- [ ] Click gold scene name → Dropdown opens
- [ ] Dropdown appears below button (not behind other elements)
- [ ] Type in search → Filters scenes
- [ ] Arrow keys → Navigate scenes
- [ ] Enter → Switches to selected scene
- [ ] Esc or click outside → Closes dropdown

### Scene Activity Tracking
- [ ] Switch to Scene A multiple times → Should appear first in list
- [ ] Switch to Scene B once → Should appear after Scene A
- [ ] Refresh page → Order persists (data in KV)
- [ ] Check console logs → See "Successfully recorded" messages

### Scroll Layout
- [ ] "Current Scene:" label stays fixed when scrolling
- [ ] Scene buttons scroll horizontally
- [ ] Scrollbar appears below scene buttons (not above)
- [ ] Smooth scrolling (no jank)

---

## API Endpoints

### Local Development
- **Base URL:** `http://localhost:8796`
- **Record Scene Switch:** `POST /scene-activity/record`
- **Get Top Scenes:** `GET /scene-activity/top?limit=20`

### Production
- **Base URL:** `https://streamkit-api.idling.app`
- **Same endpoints as above**

### Testing API Directly
```bash
# Record a scene switch (requires auth_token cookie)
curl -X POST http://localhost:8796/scene-activity/record \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -d '{"sceneName": "CAMERAS"}'

# Get top scenes
curl http://localhost:8796/scene-activity/top?limit=20 \
  -H "Cookie: auth_token=YOUR_TOKEN"
```

---

## Known Limitations

1. **API Must Be Running:** Scene activity tracking requires `streamkit-api` to be deployed or running locally
2. **Authentication Required:** Must be logged in via `auth.idling.app` for API calls to work
3. **Initial State:** First load will show OBS order until scenes are switched
4. **KV Propagation:** Changes may take a few seconds to propagate in Cloudflare KV

---

## Quick Fix Commands

```bash
# Rebuild streamkit
cd /path/to/project
pnpm run build

# Start streamkit-api locally
cd serverless/streamkit-api
pnpm dev

# Check if API is running
curl http://localhost:8796/health

# Clear browser cache (or use Ctrl+Shift+R)
# Then reload streamkit
```

---

## File Locations

- **InfoBar Component:** `src/lib/components/InfoBar.svelte`
- **Scene Picker Component:** `src/lib/components/ScenePicker.svelte`
- **Scene Activity Module:** `src/modules/scene-activity.ts`
- **Sources Module:** `src/modules/sources.ts` (calls `recordSceneSwitch`)
- **API Worker:** `serverless/streamkit-api/worker.ts`
- **API Config:** `src/config/api.ts` (sets API URL)

---

## Success Indicators

### Visual
- ✅ Scene picker dropdown appears on click
- ✅ "Current Scene:" stays fixed when scrolling
- ✅ Most-used scenes appear first in horizontal list
- ✅ Activity counts visible in scene picker

### Console
- ✅ No JavaScript errors
- ✅ "Successfully recorded" messages on scene switch
- ✅ "Fetched X active scenes" with data
- ✅ "BEFORE sort" and "AFTER sort" show different orders

### Network Tab (DevTools)
- ✅ POST to `/scene-activity/record` returns 200/201
- ✅ GET to `/scene-activity/top` returns 200 with JSON data
- ✅ No CORS errors
- ✅ auth_token cookie present in request headers
