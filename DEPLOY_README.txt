NightOutStays Full Combined Version — 04 Sep 2026

This is the complete project package based on NightOutStays(2).zip with all fixes completed so far merged into one project.

Included in this combined version:
- Guest/Host critical messaging flow
- Special-rate request and Host special-offer workflow
- Booking message type compatibility
- Pay Now payment page and payment-details API
- Guest Support duplicate-header fix
- Host registration/login role handling
- Public login limited to Guest + Host; Admin uses /admin/login
- Password show/hide controls
- Admin Host-request notifications and pending-host badge logic
- Pending Host can add draft properties
- Pending Host properties remain non-public until approval
- Admin notifications authorization/session refresh fix
- Guest calendar interest-count work already present in the current full project
- Current homepage/search/map work already present in the current full project

IMPORTANT DATABASE NOTE:
The matching critical database migrations were already applied to the connected live Supabase project during development. The SQL migration files remain under supabase/migrations for source control/history. Do not manually paste and re-run them in production unless you are intentionally rebuilding another database.

DEPLOY:
Upload/deploy this full project as one replacement version. Keep your existing Vercel environment variables, especially SUPABASE_SERVICE_ROLE_KEY and Razorpay variables.

Recommended test order after deployment:
1. Admin login
2. Fresh Host registration
3. Pending Host login
4. Pending Host property upload
5. Admin Host-request notification + Hosts badge
6. Admin Host approval
7. Property visibility/moderation
8. Guest booking
9. Host approval
10. Guest special-rate request
11. Host special offer
12. Guest accept
13. Pay Now / Razorpay
14. Notification and message badge behavior
