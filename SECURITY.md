# Security Policy

## Reporting a vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please email us at: **parnishklpo@gmail.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

You will receive a response within 48 hours. We will work with you to understand and resolve the issue promptly.

**Please do not:**
- Publicly disclose the vulnerability before it has been patched
- Access or modify data that doesn't belong to you
- Perform denial-of-service attacks

We appreciate responsible disclosure and will credit researchers in our release notes.

---

## Security architecture

Job Agent is designed with security-first principles:

### Authentication
- Passwords are hashed with bcrypt (cost factor 12)
- JWT access tokens expire after 60 minutes
- Refresh tokens expire after 7 days
- Password minimum requirements: 8+ characters, at least one letter and one number

### API security
- All endpoints (except `/auth/register` and `/auth/login`) require JWT authentication
- Rate limiting on login: 10 requests/minute per IP
- CORS restricted to configured origins only
- Security headers on all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security` (production only)
- API docs (Swagger/ReDoc) are disabled in production
- Request IDs via `X-Request-ID` for tracing

### Data
- All secrets loaded from environment variables — never hardcoded
- Database queries use parameterized statements (SQLAlchemy ORM) — SQL injection protected
- User data is isolated — queries always filter by `user_id`

### Scraping
- Browser automation (Playwright) runs in a sandboxed subprocess
- No credentials stored for external job boards

---

## Deployment recommendations

If you deploy this publicly:

1. **Change `SECRET_KEY`** to a random 32+ character string
2. **Use HTTPS** — set `ENVIRONMENT=production`
3. **Restrict `CORS_ORIGINS`** to your actual frontend domain
4. **Use strong database passwords** and restrict DB port access
5. **Never commit `.env` files** to version control
6. **Rotate API keys** regularly
7. **Keep dependencies updated** — run `pip install -U -r requirements.txt` periodically
