NightOutStays Guest ↔ Host Realtime Messaging Final Fix

Paste the supplied app folder into the NightOutStays project root and choose Merge/Replace.

Files included:
- app/host/messages/page.js
- app/account/messages/page.js

Improvements:
- Supabase Realtime INSERT subscription on both Host and Guest message screens
- 4-second fallback sync if Realtime disconnects or misses an event
- Sync on browser focus, tab visibility return, and network reconnect
- Send button remains locked while sending to prevent duplicate sends
- Guest optimistic message insert is deduplicated by message ID
- Host selection is preserved during background sync
- Guest conversation list is sorted by latest message
- Existing unread/read handling remains in place

Recommended commit: Fix guest host realtime messaging
