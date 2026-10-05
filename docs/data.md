**English** | [한국어](data.ko.md)

# Data we collect

No values that identify an individual are stored. IP addresses and browser strings are used only as hashes and the originals are not kept,
and referrers are classified only by **source type** rather than stored as full URLs (no search terms or paths are stored).

## Tables

| Table | What | Granularity | Retention |
|---|---|---|---|
| `submissions` | Photo reports. Number, rarity tier, zone, time taken, time received, status, photo, location | Per record | Permanent |
| `screening` | First-pass AI screening results. Verdict, shark, person, confidence, reason, engine, processing time | Per record | Permanent |
| `observations` | Operator's on-site observations (seen/miss) | Per record | Permanent |
| `pings` | On-site taps. Time, type, zone, device hash | Per record | 6 hours |
| `notices` | Safety notices and announcements | Per record | Permanent |
| `visits` | Visits (view/uniq) | **Date** | Permanent |
| `visitors` | Hashes for determining that day's unique visitors | Date + hash | 7 days |
| `visitors_hourly` | Hashes for determining that hour's unique visitors | Hour + hash | 8 days |
| `stats_hourly` | **Hourly** aggregates of every metric | Hour + kind | Permanent |
| `sources` | Traffic sources | Date + source | Permanent |
| `routes` | First landing screen | Date + screen | Permanent |
| `meta` | Card number counter, etc. | Key-value | Permanent |

## Kinds in `stats_hourly`

Counted under `YYYY-MM-DDTHH` keys in Korea Standard Time.

| Kind | Meaning | When |
|---|---|---|
| `view` | Page view | When the page is opened (excluding 30-second auto-refreshes and in-app screen navigation) |
| `uniq` | Unique visitors that hour | Each device counted once per hour |
| `report` | Photo report | Successful submission |
| `card` | Published card | Approved by the operator or the AI |
| `ping_seen` / `ping_miss` | On-site taps | Button pressed inside the park |
| `ping_far` | Rejected for being outside the radius | To judge whether the radius is getting in the way |
| `geo_fail` | Location check failed | In-app browsers, etc. |
| `share` / `save` | Link shared / image saved | Buttons on the card screen |
| `card_view` | Arrived via a card link | Human visits to `/c/<id>` (crawlers excluded) |

## Traffic source categories

`threads` `instagram` `kakao` `facebook` `naver` `google` `youtube` `twitter`
`card_link` (shared card link) `direct` (typed URL or QR code) `internal` (within the site) `other`

## Where to view it

Admin page: `https://admin.bukangi.com/#/admin`

- **By hour**: unique visitors, page views, photo reports, on-site taps, and shares/saves as bars on the same time axis. 24 hours to 7 days
- **Where visitors come from**: traffic sources and first landing screen. Today to 30 days

## Things to know

- **Hourly aggregates start at 16:00 on 2026-09-22.** Visits before that were recorded only per date and cannot be backfilled.
  Photo reports have timestamps, so they were backfilled.
- `visits` (per date) and `stats_hourly` (per hour) started at different times, so their totals differ. For per-date totals, `visits` is correct.
- Headless browsers and bots are excluded from the counts.

## Not counted yet

- Time on page, scroll depth (overkill at the current scale)
- Distribution by card rarity tier (can be aggregated from `submissions.rarity` at any time)
- Sighting distribution by zone (can be aggregated from `submissions.zone` and `pings.zone`)

## Google Analytics (since 2026-10-02)

Alongside our own counters, the production site also sends data to GA4 (measurement ID `G-FC9Y0PHC14`, set at build time with `VITE_GA_ID`). The code is in `src/lib/ga.ts`. If `VITE_GA_ID` is empty, nothing is loaded.

- Enabled only on the production host (bukangi.com). Staging/local hosts, the admin page, the card-render page and automated browsers send nothing
- Screens are sent as virtual paths: `/`, `/certify`, `/card`, `/hall`, `/tiers`. Card IDs are never included
- Events: `report` (rarity), `ping` (seen/miss), `share`, `save`, `geo_fail`, `card_view`
- GA recognizes the same browser with a cookie. The home page footer shows a cookie notice (only when GA is enabled)
- iPhone Safari deletes script-set cookies after 7 days (1 day when the visitor arrives via a link with a tracking parameter), so GA's user and returning-user counts can run higher than reality. Read people counts side by side with our own counters
- To check on the staging host, add `?ga_test`. That turns on debug mode, so hits show only in GA DebugView and never mix into reports
- GA setting: in the data stream's Enhanced measurement, turn off "Page changes based on browser history events" (the code sends screen changes itself, so this avoids duplicates)
- Time on page and scroll depth are still not counted by our own counters, but on the production site with GA enabled they are visible in GA
