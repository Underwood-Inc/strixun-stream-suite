# GitHub Pages SSL Setup for streamkit.idling.app

> **Quick guide to fix SSL/HTTPS for your GitHub Pages custom domain**

---

## ★ What You Need to Do

### Step 1: Add DNS CNAME Record

Go to your DNS provider (likely **Cloudflare** since you're using `idling.app`):

1. **Cloudflare Dashboard**  **DNS**  **Records**
2. Click **Add record**
3. Configure:
   - **Type**: `CNAME`
   - **Name**: `streamkit`
   - **Target**: `underwood-inc.github.io`
   - **Proxy status**: **DNS only** (gray cloud) ⚠ **CRITICAL: Must be gray, not orange!**
   - **TTL**: Auto
4. Click **Save**

**⚠ IMPORTANT**: The proxy status **MUST be gray (DNS only)** for GitHub to provision SSL. Orange cloud (proxied) will prevent SSL certificate provisioning!

### Step 2: Verify in GitHub Pages Settings

1. Go to **GitHub Repository**  **Settings**  **Pages**
2. Under **Custom domain**, you should see `streamkit.idling.app`
3. Wait for DNS check to complete (yellow dot  green checkmark)
4. This usually takes **1-5 minutes**

### Step 3: Wait for SSL Certificate

GitHub **automatically provisions SSL certificates** once DNS is correct:
- **Time**: Usually 1-10 minutes after DNS propagates
- **No action needed** - GitHub does this automatically
- You'll see the certificate status in GitHub Pages settings

### Step 4: Enable HTTPS Enforcement

Once SSL certificate is ready:
1. Go to **GitHub Repository**  **Settings**  **Pages**
2. Under **Enforce HTTPS**, check the box ✓
3. Your site will now **only** be accessible via HTTPS

---

## ★ Verify DNS is Working

### Check DNS Resolution

```bash
# Should return underwood-inc.github.io or GitHub IPs
nslookup streamkit.idling.app

# Or use dig
dig streamkit.idling.app CNAME
```

### Check SSL Certificate

```bash
# Should show valid GitHub certificate
openssl s_client -connect streamkit.idling.app:443 -servername streamkit.idling.app
```

Or visit: https://www.ssllabs.com/ssltest/analyze.html?d=streamkit.idling.app

---

## ⚠ Common Issues

### "DNS Check Successful" BUT "HTTPS Unavailable" ⚠ **MOST COMMON ISSUE**

**According to [GitHub's official documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages#https-errors):**

**Possible Causes & Fixes:**

1. **CAA Records Blocking Let's Encrypt** (Most Likely Issue)
   - If you have CAA (Certificate Authority Authorization) records, they **must** allow `letsencrypt.org`
   - **Fix**: Go to **Cloudflare Dashboard**  **DNS**  **Records**
   - Check for any CAA records
   - If CAA records exist, ensure at least one has value `letsencrypt.org`
   - If no CAA records exist, GitHub can provision SSL automatically

2. **Remove and Re-add Custom Domain** (Triggers SSL Provisioning)
   - Go to **GitHub Repository**  **Settings**  **Pages**
   - Under **Custom domain**, click **Remove**
   - Wait **1-2 minutes**
   - Re-add `streamkit.idling.app`
   - This forces GitHub to re-check and provision SSL

3. **Wait Time** (Can Take Up to 1 Hour)
   - GitHub says: "It can take up to an hour for your site to become available over HTTPS"
   - If you just configured DNS, wait the full hour before troubleshooting further

4. **DNS Record Type**
   - Must be one of: `CNAME`, `ALIAS`, `ANAME`, or `A` records
   - Verify your DNS record type is correct

### "DNS Check in Progress" (Yellow Dot)

**Cause**: DNS hasn't propagated yet or record is incorrect

**Fix**:
1. Verify CNAME record exists: `streamkit`  `underwood-inc.github.io`
2. Wait 5-10 minutes for propagation
3. Check DNS from multiple locations: https://dnschecker.org

### "HTTPS Unavailable" Error (After DNS is Correct)

**According to [GitHub's documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages#https-errors):**

**Fix Steps (In Order):**

1. **Check CAA Records** (Most Common Blocker)
   ```bash
   # Check for CAA records
   dig streamkit.idling.app CAA
   ```
   - If CAA records exist, ensure `letsencrypt.org` is allowed
   - If blocking Let's Encrypt, HTTPS will never work

2. **Remove and Re-add Custom Domain**
   - GitHub says: "After you update existing DNS settings, you may need to remove and re-add your custom domain to trigger the process of enabling HTTPS"
   - **GitHub Repository**  **Settings**  **Pages**  **Remove** domain
   - Wait 1-2 minutes
   - Re-add `streamkit.idling.app`

3. **Wait Up to 1 Hour**
   - GitHub: "It can take up to an hour for your site to become available over HTTPS"
   - Don't panic if it's been less than an hour

4. **Verify DNS Record Type**
   - Must be: `CNAME`, `ALIAS`, `ANAME`, or `A` records
   - Check your DNS provider settings

### "NET::ERR_CERT_COMMON_NAME_INVALID"

**Cause**: SSL certificate doesn't match domain or DNS misconfigured

**Fix**:
1. Verify CNAME record: `streamkit`  `underwood-inc.github.io`
2. Remove custom domain in GitHub Pages settings
3. Wait 1 minute
4. Re-add `streamkit.idling.app` in GitHub Pages settings
5. Wait for DNS check and SSL provisioning

---

## ★ DNS Record Summary

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name** | `streamkit` |
| **Target** | `underwood-inc.github.io` |
| **Proxy** | **DNS only (gray cloud)** ⚠ **NOT proxied!** |
| **TTL** | Auto |

**⚠ CRITICAL**: Proxy must be **disabled (gray cloud)** for GitHub SSL to work!

---

## ★ After Setup

Once SSL is working:
- ✓ Site accessible at `https://streamkit.idling.app`
- ✓ HTTPS enforcement enabled
- ✓ No browser security warnings
- ✓ All traffic encrypted

---

## ★ Troubleshooting Checklist

- [ ] CNAME record exists: `streamkit`  `underwood-inc.github.io`
- [ ] DNS propagated (check with https://dnschecker.org)
- [ ] Custom domain set in GitHub Pages settings
- [ ] DNS check shows green checkmark (not yellow dot)
- [ ] Waited 10+ minutes for SSL certificate provisioning
- [ ] Removed and re-added domain if still not working

---

**Last Updated**: 2025-01-01  
**Status**: Ready to Use ✓

