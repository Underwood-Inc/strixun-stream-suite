# Resend Domain Verification with GitHub Pages

> **Guide to verifying your domain with Resend when using GitHub Pages**

---

## 🎯 Understanding Domain Verification

**Important**: Domain verification happens at the **DNS level** (your domain registrar), not in GitHub Pages itself. Here's how it works:

### Two Scenarios:

1. **Custom Domain** (e.g., `yourdomain.com`)
   - ✅ **Can verify** with Resend
   - DNS records added at your domain registrar
   - GitHub Pages just hosts the site

2. **Default GitHub Pages** (e.g., `username.github.io`)
   - ❌ **Cannot verify** (not your domain)
   - ✅ **Can still use Resend** with default domain (`onboarding@resend.dev`)

---

## ✅ Scenario 1: Custom Domain Setup

If you have a custom domain connected to GitHub Pages, you can verify it with Resend.

### Step 1: Check Your Current Setup

**Do you have a custom domain?**
- Check your GitHub repository: **Settings → Pages → Custom domain**
- If you see a custom domain (e.g., `yourdomain.com`), you can verify it
- If you only see `username.github.io`, skip to Scenario 2

### Step 2: Find Your Domain Registrar

Your domain's DNS is managed by your **domain registrar** (where you bought the domain), not GitHub Pages.

**Common registrars:**
- **Cloudflare** (if you use Cloudflare DNS)
- **Namecheap**
- **GoDaddy**
- **Google Domains**
- **Name.com**
- **Others**

**How to find it:**
1. Check your email for domain purchase receipt
2. Check where you manage your domain's DNS settings
3. Look for "DNS Management" or "DNS Settings" in your account

### Step 3: Add Resend DNS Records

1. **Go to Resend Dashboard**
   - Navigate to: **https://resend.com/domains**
   - Click **"Add Domain"**
   - Enter your domain (e.g., `yourdomain.com`)
   - Click **"Add"**

2. **Resend Will Provide DNS Records**

   You'll see something like:
   ```
   Type: TXT
   Name: resend._domainkey
   Value: (long string provided by Resend)
   
   Type: CNAME
   Name: resend
   Value: (provided by Resend)
   ```

3. **Add Records to Your Domain Registrar**

   **Example: Cloudflare DNS**
   ```
   1. Go to Cloudflare Dashboard
   2. Select your domain
   3. Go to "DNS" → "Records"
   4. Click "Add record"
   5. Add each record Resend provided:
      - Type: TXT
      - Name: resend._domainkey
      - Content: (paste value from Resend)
      - TTL: Auto
   6. Repeat for CNAME record
   ```

   **Example: Namecheap**
   ```
   1. Log into Namecheap
   2. Go to "Domain List"
   3. Click "Manage" next to your domain
   4. Go to "Advanced DNS"
   5. Add each record:
      - Type: TXT Record
      - Host: resend._domainkey
      - Value: (paste from Resend)
      - TTL: Automatic
   ```

4. **Wait for DNS Propagation**
   - Usually takes **5-60 minutes**
   - Can take up to **24-48 hours** in rare cases
   - Check status: **https://dnschecker.org**

5. **Verify in Resend**
   - Go back to Resend dashboard
   - Click **"Verify"** next to your domain
   - ✅ Should verify successfully!

### Step 4: Update Your Worker Code

Once verified, update your email sending code to use your domain:

```javascript
// serverless/worker.js
const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        from: 'Strixun Stream Suite <noreply@yourdomain.com>', // ✅ Your verified domain
        to: email,
        subject: 'Your Verification Code',
        html: generateOTPEmailHTML(otp),
    }),
});
```

---

## ⚠️ Scenario 2: No Custom Domain (github.io only)

If you're using the default GitHub Pages domain (`username.github.io`), you **cannot verify it** because:
- It's GitHub's domain, not yours
- You don't control its DNS records
- GitHub won't let you add custom DNS records

### But You Can Still Use Resend! ✅

**Use Resend's Default Domain:**
- Resend provides: `onboarding@resend.dev`
- Works immediately (no verification needed)
- Perfect for testing and development
- Free tier includes this

**Code Example:**
```javascript
// serverless/worker.js
const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        from: 'onboarding@resend.dev', // ✅ Resend's default domain
        to: email,
        subject: 'Your Verification Code',
        html: generateOTPEmailHTML(otp),
    }),
});
```

**Limitations:**
- Emails come from `onboarding@resend.dev` (not your domain)
- Slightly lower deliverability (but still good)
- Can't customize the "from" address

**When to Upgrade:**
- If you get a custom domain later, you can verify it then
- No code changes needed (just update the `from` field)

---

## 🔍 How to Check Your Current Setup

### Check GitHub Pages Domain

1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Look at **"Custom domain"** field:
   - **Has custom domain?** → Follow Scenario 1
   - **Empty or shows github.io?** → Follow Scenario 2

### Check Your Domain Registrar

**If you have a custom domain:**

1. **Find where DNS is managed:**
   ```bash
   # Use this command to find nameservers
   nslookup -type=NS yourdomain.com
   ```

2. **Common scenarios:**
   - **Cloudflare nameservers** → DNS managed in Cloudflare
   - **Namecheap nameservers** → DNS managed in Namecheap
   - **GoDaddy nameservers** → DNS managed in GoDaddy

3. **Where to add DNS records:**
   - Wherever your nameservers point
   - Usually your domain registrar
   - Sometimes a separate DNS provider (like Cloudflare)

---

## 📋 Quick Decision Tree

```
Do you have a custom domain?
│
├─ YES → Can you access DNS settings?
│   │
│   ├─ YES → Add Resend DNS records → Verify domain ✅
│   │
│   └─ NO → Contact domain registrar or use onboarding@resend.dev
│
└─ NO → Use onboarding@resend.dev (no verification needed) ✅
```

---

## 🚀 Recommended Approach

### For Development/Testing:
- ✅ **Use `onboarding@resend.dev`** (no setup needed)
- ✅ Works immediately
- ✅ Perfect for getting started

### For Production:
- ✅ **Get a custom domain** (if you don't have one)
  - Cost: ~$10-15/year (very affordable)
  - Options: Namecheap, Cloudflare, Google Domains
- ✅ **Verify domain with Resend**
- ✅ **Use `noreply@yourdomain.com`** for better deliverability

---

## 💡 Pro Tips

1. **Start Simple**: Use `onboarding@resend.dev` to get started quickly
2. **Upgrade Later**: Add custom domain verification when ready
3. **Check DNS Propagation**: Use https://dnschecker.org to verify records
4. **Test First**: Always test email sending before going to production
5. **Monitor Deliverability**: Check Resend dashboard for delivery rates

---

## 🔧 Troubleshooting

### "Domain verification failed"

**Possible causes:**
- DNS records not propagated yet (wait 5-60 minutes)
- Wrong DNS records added (double-check values)
- DNS records in wrong location (check nameservers)
- Typo in domain name

**Solutions:**
- Wait for DNS propagation
- Verify records match exactly what Resend provided
- Check DNS records are in the right place (where nameservers point)
- Use DNS checker tool to verify records are live

### "Can't find DNS settings"

**If you don't know where your DNS is managed:**
1. Check your domain registrar account
2. Look for "DNS Management" or "DNS Settings"
3. Check if you're using Cloudflare (common for GitHub Pages)
4. Contact your domain registrar support

### "Using github.io, can't verify"

**This is normal!** You can't verify GitHub's domain. Just use `onboarding@resend.dev` - it works perfectly fine for most use cases.

---

## 📚 Additional Resources

- **Resend Domain Verification**: https://resend.com/docs/dashboard/domains/introduction
- **GitHub Pages Custom Domain**: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
- **DNS Checker Tool**: https://dnschecker.org
- **Cloudflare DNS Setup**: https://developers.cloudflare.com/dns/

---

**Last Updated**: 2025-01-01  
**Status**: Ready to Use ✅

