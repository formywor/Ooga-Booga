# Personal sites — proposed hosting architecture (not deployed)

Users may choose a ScriptNovaa subdomain or their own domain. This is separate from the existing GitHub Pages website and Galaxy's local demonstration.

## Two service choices

- Managed timed hosting: ScriptNovaa hosts a site, validates its Galaxy session through the API, and stops serving protected content after expiry or revocation. Show remaining time initially and whenever another 10% of the original duration has elapsed. Refreshing must not restart the duration.
- Independent hosting: users deploy their own files to their own provider. They may choose not to use ScriptNovaa's API, but then ScriptNovaa cannot enforce token expiry. A JavaScript timer alone is cosmetic, not access control.

## Address and security requirements

1. Reserve unique DNS-safe slugs in the database. `iii_dev` could request `iii-dev`, but collisions must be checked, not silently merged. Reserve `www`, `api`, `admin`, `mail`, and other system names.
2. Use a separate multi-tenant hosting service with wildcard TLS and domain routing. Do not point wildcard DNS at GitHub Pages. Existing root website and API routes must remain unchanged.
3. Verify custom-domain ownership before activation. Issue HTTPS certificates and safely release domain mappings when a site is removed.
4. Keep arbitrary uploaded HTML/scripts isolated from the main account origin. Use host-only authentication cookies (never domain-wide cookies), explicit allowed origins, no shared credentials, and a separate untrusted-content domain if user scripts are supported.
5. Enforce quotas, authorization, rate limits and expiry on the server for every protected resource. Give hosted pages narrowly scoped session grants, never account login tokens, PINs or recovery codes.
6. Explain that previously downloaded content cannot be remotely erased. Local/self-hosted code is user-controlled. Public scriptnovaa.com itself is not made private by showing it in a timed demo.

Start with a fixed ScriptNovaa demonstration template, not arbitrary uploads or a general website proxy. Replit and Vercel are possible deployment providers, not announced commercial partners. Hosting capacity, provider account, DNS access and costs must be confirmed before launch. No personal subdomains have been provisioned by this change.
