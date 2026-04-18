# dataficto

Static site for `https://fictodata.ru` with protected access to the "Резолюции" section through Supabase + Yandex OAuth.

## Auth Notes

- Login button uses Supabase custom provider: `custom:yandex`.
- Access to "Резолюции" is checked on each open. If session is missing, page stays blocked and shows an inline notice.
- OAuth errors are rendered as a page banner (no browser `alert` popups).

## Yandex Userinfo Proxy

Yandex `/info` returns `id`, while Supabase expects `sub` as provider identity.  
Use Edge Function `yandex-userinfo-proxy` to map response fields:

- `id -> sub`
- `default_email -> email`
- `login/real_name -> preferred_username/name`

### Security and Key Rotation

1. Store function secret in Supabase:
   - `YINFO_PROXY_KEY=<strong-random-value>`
2. Use this in provider `Userinfo URL` query param:
   - `...?key=<strong-random-value>`
3. Rotate key periodically:
   - Set new secret in Supabase.
   - Update `Userinfo URL` in custom provider.
   - Save provider settings and retest login.

Use a long random key (at least 32 chars). Do not reuse sample values like `long-random-secret`.
