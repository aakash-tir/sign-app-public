# Hosting — Cloudflare Pages

> Decision: deploy the PWA to **Cloudflare Pages** (ADR-006, accepted). This doc
> explains what that is and how we'll use it, for readers new to Cloudflare.
> Set up in **M7** — nothing to do now.

## What is Cloudflare?

Cloudflare is a company that runs a large global network of servers ("the edge")
in hundreds of cities. It's best known for making websites **faster** (a CDN —
content delivery network — that keeps copies of a site close to users) and
**safer** (sitting in front of sites to absorb attacks). It has since grown into a
full platform for hosting and running web apps. We only use one piece of it.

## What is Cloudflare Pages?

**Cloudflare Pages** is a free service for hosting **static front-end apps** — a
folder of HTML/CSS/JS, which is exactly what our PWA compiles to. You connect a
Git repo; on every push Cloudflare runs the build and publishes the output to its
global edge, served over HTTPS at a free `*.pages.dev` address (custom domains
optional).

## Why it fits this project

| Need | How Pages meets it |
| --- | --- |
| **HTTPS is mandatory** — a PWA can't use the camera or its offline service worker without it. | Automatic free HTTPS on `*.pages.dev`; no certificate setup. |
| **Repo is private** | Pages builds and deploys from a **private** repo for free. (This is the reason we avoid GitHub Pages — *private* Pages needs a paid GitHub plan.) |
| **No backend** — recognition runs on-device, so we only need fast static file serving. | Pages is purpose-built for static hosting; its global edge serves the chunky MediaPipe/model assets from a server near each user → faster first load. |
| **Per-PR testing** | Every pull request gets a **preview deployment** (its own temporary URL) — test a milestone on a real phone before merging. |
| **Cost** | Free tier is ample for this app. |

## What we are NOT using

Cloudflare also offers Workers (serverless functions), D1/KV (databases), R2
(storage), etc. We use **none** of these — consistent with our on-device,
serverless, local-first design (see [`architecture.md`](architecture.md)). If we
ever add optional cloud sync, Workers + D1 would be a natural fit, but that's out
of current scope.

## How deployment will work (M7, step by step)

1. Push the repo to a **private GitHub repository** (done in M0).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to
   Git**, authorize, and pick the repo.
3. Configure the build:
   - **Build command:** `npm run build` (run in the `frontend/` directory; set the
     project root/`frontend` as the build root).
   - **Build output directory:** `frontend/dist` (Vite's default output).
4. Cloudflare builds and gives a live `https://<project>.pages.dev` URL.
5. From then on, **every push auto-deploys**, and **every PR gets a preview URL**.
6. (Optional, later) attach a custom domain.

> A short walkthrough will be provided in the chat when we reach M7.

## Alternatives (equivalent, if ever needed)

- **Netlify** and **Vercel** — virtually identical static-hosting experience,
  also free tiers, also deploy from private repos.
- **GitHub Pages** — only viable if the repo is made public or on a paid GitHub
  plan; otherwise unsuitable here.
