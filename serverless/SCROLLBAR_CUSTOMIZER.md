# [UI] Scrollbar Customizer - Free CDN Tool

> **Make your website's scrollbars look amazing with just one line of code!**

A free, easy-to-use tool that lets you customize scrollbars on any website. Just add one script tag to your HTML and your scrollbars will instantly look better. No coding knowledge required!

---

## [DEPLOY] Quick Start (Super Simple!)

### Option 1: Just Apply Default Styling (Easiest)

Want beautiful scrollbars without any customization? Just add this one line to your website's `<head>` section:

```html
<script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar.js"></script>
```

**That's it!** Your scrollbars will automatically get a sleek, modern look with:
- Thin, elegant scrollbars (6px wide)
- Smooth hover effects
- No layout shifting when scrollbars appear/disappear

### Option 2: Customize with Visual Controls

Want to customize the colors, size, and style? Use the customizer version:

```html
<script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar-customizer.js"></script>
```

This adds a **floating control panel** (top-right corner) where you can:
- Adjust scrollbar width with a slider
- Pick custom colors for the scrollbar thumb and hover state
- Change the border radius (how rounded the corners are)
- Toggle content adjustment on/off

**All changes apply instantly** - no page refresh needed! Just move the sliders and pick colors, and you'll see your scrollbars update in real-time.

---

## [CLIPBOARD] Step-by-Step Guide

### For Complete Beginners

1. **Open your website's HTML file** (or your website editor)
2. **Find the `<head>` section** (usually near the top, between `<head>` and `</head>`)
3. **Add one of these lines** (copy and paste exactly as shown):

   **For default styling:**
   ```html
   <script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar.js"></script>
   ```

   **For customization controls:**
   ```html
   <script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar-customizer.js"></script>
   ```

4. **Save your file** and refresh your website
5. **Done!** Your scrollbars now look amazing

### Example: Adding to a Basic HTML Page

Here's what your HTML might look like:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Awesome Website</title>
    
    <!-- Add this line for beautiful scrollbars -->
    <script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar.js"></script>
</head>
<body>
    <h1>Welcome to My Website</h1>
    <p>This page has custom scrollbars now!</p>
</body>
</html>
```

---

## [CONTROL] Using the Customizer UI

If you chose the **customizer version** (`scrollbar-customizer.js`), you'll see a floating panel in the top-right corner when you load your page.

### Controls Explained

| Control | What It Does |
|---------|-------------|
| **Width Slider** | Makes scrollbars thicker or thinner (4px to 20px) |
| **Thumb Color** | The main color of the scrollbar (the draggable part) |
| **Hover Color** | The color when you hover your mouse over the scrollbar |
| **Track Color** | The background behind the scrollbar (set to black for transparent) |
| **Radius Slider** | How rounded the scrollbar corners are (0px = square, 10px = very rounded) |
| **Content Adjustment Toggle** | Prevents your page from shifting when scrollbars appear/disappear (recommended: ON) |
| **Reset Button** | Restores all settings to defaults |

### Tips

- **Changes are instant** - No need to save or refresh, just adjust and see!
- **Works on any page** - The customizer works on any website where you add the script
- **No technical knowledge needed** - Just move sliders and pick colors!

---

## [WEB] CDN URLs

### Base Styling (Defaults Only)
```
https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar.js
```

### Customizer (With UI Controls)
```
https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar-customizer.js
```

> **Note:** If you're using a custom Cloudflare Worker domain, replace `strixuns-script-suite.workers.dev` with your actual domain.

---

## [FEATURE] Default Styling

When you use the base version, your scrollbars get these default settings:

- **Width**: 6px (thin and elegant)
- **Track**: Transparent (invisible background)
- **Thumb Color**: `#3d3627` (dark brown)
- **Hover Color**: `#888` (gray)
- **Border Radius**: 3px (slightly rounded)
- **Content Adjustment**: Enabled (prevents layout shift)

These defaults work great for most websites, but you can always use the customizer version to change them!

---

## [CONFIG] Advanced Usage (For Developers)

If you want to customize programmatically instead of using the UI:

```html
<script src="https://strixun-twitch-api.strixuns-script-suite.workers.dev/cdn/scrollbar.js"></script>
<script>
  // Wait for the script to load
  if (window.ScrollbarCustomizerInstance) {
    // Update settings
    window.ScrollbarCustomizerInstance.updateConfig({
      width: 8,
      thumbColor: '#ff0000',
      thumbHoverColor: '#cc0000',
      borderRadius: 5
    });
  }
</script>
```

### Available Methods

- `updateConfig({ width: 10, thumbColor: '#ff0000' })` - Update scrollbar settings
- `toggleContentAdjustment(true/false)` - Enable/disable content adjustment
- `destroy()` - Remove all customizations

---

## [GLOBAL] Browser Support

Works on all modern browsers:
- [SUCCESS] Chrome
- [SUCCESS] Firefox
- [SUCCESS] Safari
- [SUCCESS] Edge
- [WARNING] Internet Explorer (limited support)

---

## [IDEA] What is "Content Adjustment"?

Content adjustment is a feature that prevents your page from "jumping" or shifting when scrollbars appear or disappear. 

**Example:** When you have a short page (no scrollbar) and then add content (scrollbar appears), without content adjustment, your page content might shift slightly to the left. With content adjustment enabled, the content stays in the same position.

**Recommendation:** Keep it enabled (it's on by default) unless you have a specific reason to disable it.

---

## [QUESTION] Frequently Asked Questions

### Do I need to know how to code?
**No!** Just copy and paste the script tag into your HTML. That's it!

### Will this slow down my website?
**No!** The script is tiny and loads super fast from Cloudflare's global CDN.

### Can I use this on multiple pages?
**Yes!** Add the script tag to every page where you want custom scrollbars.

### Can I customize the colors?
**Yes!** Use the `scrollbar-customizer.js` version and use the color pickers in the UI panel.

### Does this work with WordPress/Wix/Squarespace?
**Yes!** As long as you can add a script tag to your website's header, it will work. Check your website builder's documentation for how to add custom HTML/scripts.

### Is this free?
**Yes!** Completely free to use on any website.

### Can I remove it later?
**Yes!** Just delete the script tag from your HTML and refresh your page.

---

## [BUG] Troubleshooting

### Scrollbars don't appear customized
- Make sure you added the script tag to the `<head>` section
- Check that the URL is correct (no typos)
- Try refreshing your page (Ctrl+F5 or Cmd+Shift+R)

### Customizer UI doesn't show up
- Make sure you're using `scrollbar-customizer.js` (not just `scrollbar.js`)
- Check your browser console for any errors
- Try refreshing the page

### Colors aren't updating
- Make sure you're using the customizer version
- Try clicking the Reset button and adjusting again

---

## [NOTE] License

Part of the Strixun Stream Suite project. Free to use on any website.

---

## [EMOJI] Need Help?

If you run into any issues:
1. Check the troubleshooting section above
2. Make sure you copied the script tag exactly (including `https://`)
3. Try the base version first (`scrollbar.js`) to make sure it works, then try the customizer

---

**Made with [EMOJI][EMOJI] for the web community**
