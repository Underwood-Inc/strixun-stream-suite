# Environment Variables Setup

**Last Updated**: 2025-12-29

## File Integrity Keyphrase

The file integrity system uses HMAC-SHA256 with a secret keyphrase to create cryptographic signatures. This keyphrase must be set as an environment variable.

### Required Environment Variable

**`FILE_INTEGRITY_KEYPHRASE`** - Secret keyphrase for HMAC-SHA256 file integrity signatures

### Setting the Keyphrase

#### Cloudflare Workers (Production)

```bash
# Set the secret in your Cloudflare Worker
wrangler secret put FILE_INTEGRITY_KEYPHRASE

# When prompted, enter a strong, random keyphrase
# Example: Use a long random string like:
# openssl rand -hex 32
```

#### Local Development (.env file)

Create a `.env` file in the `serverless/mods-api` directory:

```bash
FILE_INTEGRITY_KEYPHRASE=your-secret-keyphrase-here
```

**[WARNING] Important:** Never commit the `.env` file to git! It should be in `.gitignore`.

#### GitHub Actions / CI/CD

Add `FILE_INTEGRITY_KEYPHRASE` as a GitHub Secret:

1. Go to your repository settings
2. Navigate to "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Name: `FILE_INTEGRITY_KEYPHRASE`
5. Value: Your secret keyphrase

Then use it in your workflow:

```yaml
env:
  FILE_INTEGRITY_KEYPHRASE: ${{ secrets.FILE_INTEGRITY_KEYPHRASE }}
```

### Generating a Strong Keyphrase

Use a cryptographically secure random generator:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### Security Notes

- **Never hardcode** the keyphrase in source code
- **Use different keyphrases** for development, staging, and production
- **Rotate the keyphrase** periodically (requires re-hashing all files)
- **Keep it secret** - anyone with the keyphrase can forge signatures

### Fallback Behavior

If `FILE_INTEGRITY_KEYPHRASE` is not set:
- A warning will be logged
- A development fallback will be used (not secure for production)
- File integrity verification will still work, but signatures can be forged

**[WARNING] Production Warning:** Always set `FILE_INTEGRITY_KEYPHRASE` in production environments!
