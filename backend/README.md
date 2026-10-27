# Sly Escape scoreboard backend (Supabase)

1. Sign up at https://supabase.com/dashboard/sign-up (email + password, or "Continue with GitHub"). Email sign-up sends a confirmation link to that inbox.
2. New project: name `sly-escape`, pick a strong database password (save it), region close to players, Free plan.
3. SQL Editor > New query > paste `supabase.sql` > Run. (Safe to re-run.)
4. Project Settings > API: copy the Project URL and the `anon` public key (or the new "publishable" key).
5. Put them in `index.html` > `SCOREBOARD={url:'…',anonKey:'…'}`, bump the build, publish.

Optional instead of steps 2-4: create a Personal Access Token (Account > Access Tokens) and hand it over; the project can then be
created and the SQL applied from the CLI / Management API (`supabase login --token …`, `supabase projects create …`).

Notes
- Free projects pause after ~7 days with no database activity (a few game requests per day keep it awake); resume from the dashboard.
- The anon key is public by design. Clients can only: read the top-50 view, call submit_score (validates map, score ceiling,
  nickname format, 5 s rate limit, keeps the best score), get_top and my_rank. No client updates/deletes; player IDs are not readable.
- Moderation: SQL Editor > `delete from public.scores where nickname = '…';`
- Map score ceilings live in `map_limits` (generated from the level data: total object points × 10 max combo × 1.25).
