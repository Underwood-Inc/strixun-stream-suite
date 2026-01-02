# ★ Security Guide - URL Shortener Encryption

## Encryption

All encryption uses **JWT tokens** (per-user, per-session). No service encryption key is needed.

See `packages/api-framework/encryption/` for implementation details.

---

##  Security Checklist

- [x] Removed runtime key injection
- [x] Using build-time injection only
- [ ] Documented security trade-offs
- [ ] Considered removing client-side encryption
- [ ] Considered asymmetric encryption
- [ ] Key rotation plan in place
- [ ] Monitoring for key extraction

---

## ★ Related Documentation

- `shared-config/otp-encryption.ts` - Key retrieval function
- `shared-config/README.md` - Configuration guide
- `SECURITY_AUDIT_REPORT.md` - Full security audit
- `serverless/shared/encryption/` - Encryption utilities

---

## ⚠ Important Notes

1. **Never commit `.env` files** with real keys to version control
2. **Rotate keys** if they're ever exposed or compromised
3. **Monitor** for unusual activity that might indicate key extraction
4. **Consider** removing client-side encryption entirely (HTTPS is sufficient)
5. **Document** any security trade-offs in your security policy

---

## ★ Migration Path

If you want to remove client-side encryption:

1. Update OTP login component to send plain JSON
2. Remove encryption key configuration
3. Update server handlers to accept plain JSON (backward compatible)
4. Test thoroughly
5. Deploy

The server already supports both encrypted and plain requests (backward compatibility), so migration is straightforward.

