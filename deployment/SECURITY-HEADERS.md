# Production security headers

GitHub Pages does not let a repository configure HTTP response headers. The
`frame-ancestors` meta value in HTML is not a replacement for an HTTP header.

To enforce anti-clickjacking protection while keeping the GitHub Pages source,
put `scriptnovaa.com` behind Cloudflare and deploy `cloudflare-security-worker.js`.
Before production, confirm the upstream repository path in that file, then test:

```text
Content-Security-Policy: ... frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

The site JavaScript also refuses to render when framed. That is only a
defense-in-depth fallback; the response headers are the authoritative control.
