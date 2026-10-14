# Clever Link Master

Build a production-ready Dynamic QR + NFC Redirect Manager for DevCrafted. Use a real database and secure admin auth. Public route /r/:slug must look up the current destination URL and perform a server-side HTTP redirect. Admin can create, edit, deactivate and delete redirects with client/business name, unique slug, destination URL, notes and timestamps. The permanent /r/:slug URL must be the ONLY URL encoded into generated QR codes and written to NFC tags. Generate real downloadable QR codes (PNG/SVG), copy permanent URL, test redirect, search/filter. Changing the destination later must never change the slug, QR or NFC value. Add click analytics with timestamp, device category and referrer where available, without unnecessary personal data. Validate http/https destinations, protect admin mutations, never hardcode passwords or expose secrets, and never use localStorage as source of truth. Include clear empty/loading/error states and a professional responsive DevCrafted SaaS-style dashboard. Do not integrate Google APIs; admins paste Google Review URLs manually. Add a clearly labeled demo redirect slug demo pointing to https://www.google.com/ for testing only.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://clever-link-master.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/114fc1be-df17-4341-911b-78bcc990b3ed).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
