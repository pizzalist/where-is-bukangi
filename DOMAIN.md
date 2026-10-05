**English** | [한국어](DOMAIN.ko.md)

# Connecting a Domain, the Easy Way

## In one line

**You can go live right now without buying a domain.** Buying one later is not too late.

---

## Step 1: Go live first, without a domain (30 min, free)

Upload to Cloudflare Pages and you get an address like `bukang.pages.dev` for free.

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free)
2. Left menu **Workers & Pages** → **Create** → **Pages** → **Upload assets**
3. Name the project `bukang` (the address becomes `bukang.pages.dev`)
4. Run `npm run build` and **drag and drop the whole `dist` folder** it produces
5. Done. You get the address right away

This address has **unlimited traffic and costs ₩0**. It won't change even if hundreds of thousands of people visit.

---

## Step 2: Connect the Mac mini (30 min)

Right now the app handles photo uploads and approvals on the Mac mini. Pages only serves the frontend, so
you need to open a tunnel so the Mac mini can be reached from outside.

```bash
brew install cloudflared
cloudflared tunnel login          # log in to Cloudflare when the browser opens
cloudflared tunnel create bukang  # create the tunnel
```

This prints a tunnel ID. Fill it into `ops/cloudflared-config.example.yml`, then:

```bash
cp ops/cloudflared-config.example.yml ~/.cloudflared/config.yml
cloudflared tunnel run bukang
```

**Leave the router settings alone.** No need to open ports or anything like that.
That's because the tunnel doesn't punch in from outside; the Mac mini makes an outbound connection.

---

## Step 3: Buy a domain (optional, 30 min)

You can wait until you see traffic picking up.

| Where | Cost | Notes |
|---|---|---|
| Cloudflare Registrar (`.com`) | about ₩15,000/year | **Sold at cost, so it's the cheapest.** Since you already use Cloudflare, it connects automatically |
| Gabia / Whois (Korean registrars) (`.kr`) | about ₩22,000/year | After buying, just switch the nameservers to Cloudflare |

When picking a name, **don't include "공식" ("official") or "부산항" ("Busan Port").** If it's mistaken for impersonating the port authority, it'll be taken down within a day.
Something like `bukang.kr` or `bukangi.com` is safe.

### After buying
1. Cloudflare dashboard → **Websites** → **Add a site** → enter the domain
2. If you bought it at Gabia or Whois, change the nameservers to the two Cloudflare gives you (takes a few hours to propagate)
3. **Workers & Pages** → `bukang` → **Custom domains** → connect the domain
4. Connect `api.<domain>` to the tunnel (`cloudflared tunnel route dns bukang api.<domain>`)

---

## Order of steps

```
Now                     →  upload dist to Pages             →  public at bukang.pages.dev
Next                    →  connect cloudflared on Mac mini  →  photo upload and approval work
Once traffic shows up   →  buy and connect a domain         →  bukang.kr
```

With just Step 1, people can visit and look around. You need Step 2 to accept reports.
Step 3 is not urgent.

---

## Where the money goes

| Item | Cost |
|---|---|
| Cloudflare Pages (frontend) | **₩0** (unlimited) |
| Cloudflare Tunnel (Mac mini connection) | **₩0** |
| Photo storage (Mac mini disk) | **₩0** |
| Domain | ₩15,000–22,000/year (optional) |
| AI photo screening (claude CLI) | **₩0** (subscription) |
| AI photo screening (if switched to the API) | about ₩60 per day at 300 screenings a day |

**Apart from the domain, it's effectively ₩0.** Because photos live on the Mac mini, there are no costs that scale with traffic.
