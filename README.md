Email Occasion Reminder – Setup & Troubleshooting

Quick start

- Copy `.env.example` to `.env.local` and fill values.
- Install deps: `npm install`
- Start dev server: `npm run dev`

Required environment variables (Vite)

- `VITE_SUPABASE_URL` – Your project URL, e.g. `https://<project-ref>.supabase.co`
- `VITE_SUPABASE_ANON_KEY` – Your Supabase anon key

Edge function: n8n-proxy

- Deploy function in your Supabase project to handle n8n status/toggle:
  - Path: `supabase/functions/n8n-proxy`
  - Secrets required (set in Supabase, not in the frontend `.env`):
    - `N8N_URL` – Base URL of your n8n instance, e.g. `https://n8n.example.com`
    - `N8N_API_KEY` – n8n API key
    - `N8N_WORKFLOW_ID` – Numeric workflow ID to control
- Example CLI (replace values):
  - `supabase functions deploy n8n-proxy --project-ref <project-ref>`
  - `supabase secrets set N8N_URL=... N8N_API_KEY=... N8N_WORKFLOW_ID=... --project-ref <project-ref>`

Realtime for `email_logs`

- Ensure the table is added to the `supabase_realtime` publication and RLS allows reads.
- Migration included to enable realtime: see `supabase/migrations/*_enable_realtime_email_logs.sql`.

Common errors

- 500 from `functions/v1/n8n-proxy` or HTML response:
  - Function not deployed or secrets missing; deploy and set `N8N_*` secrets.
  - Wrong `VITE_SUPABASE_URL` or project ref; verify `.env.local`.
- Realtime websocket fails:
  - Wrong anon key or URL; check `.env.local`.
  - Realtime not enabled for table; run migrations and check publication.
  - Network blocks (adblock/VPN); retry without blockers.

Notes

- The app now uses `supabase.functions.invoke('n8n-proxy', ...)` for robust function calls and better JSON handling.
