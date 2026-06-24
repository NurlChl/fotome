# Admin Console Restructure Plan

## Overview
Memisahkan tab-tab admin console menjadi halaman terpisah di sidebar dan menambahkan fitur edit/delete untuk events.

## Changes Required

### 1. Sidebar Navigation Structure ✅ (DONE)
**Before:**
- Dashboard
- Create Event  
- Admin Console (single page with tabs)
- My Photos
- Order History
- Settings

**After:**
- **Dashboard Section:**
  - Dashboard
  - Create Event

- **Admin Section** (conditional based on permissions):
  - Users (permission: manageUsers)
  - All Events (permission: manageEvents)
  - Payouts (permission: managePayouts)
  - Admins (superadmin only)

- **Account Section:**
  - Settings (dashboard version)

### 2. New Pages to Create
- [ ] `/dashboard/users` - User management page
- [ ] `/dashboard/events` - All events management page (with edit/delete)
- [ ] `/dashboard/payouts` - Payouts management page
- [ ] `/dashboard/admins` - Admin management page (move from tabs)
- [ ] `/dashboard/settings` - Settings khusus dashboard

### 3. API Endpoints to Add/Update
- [ ] `PUT /api/admin/admins` - Update admin
- [ ] `DELETE /api/admin/admins` - Delete admin
- [ ] `PUT /api/admin/events/[id]` - Edit event
- [ ] `DELETE /api/admin/events/[id]` - Delete event
- [ ] Update `GET /api/admin/dashboard` - Return all events for admin/superadmin

### 4. Events Page Features
- [ ] Show ALL events (not just own events) for admin/superadmin
- [ ] Add Edit button for each event
- [ ] Add Delete button for each event
- [ ] Add thin borders to table rows/columns
- [ ] Edit modal for updating event details
- [ ] Confirmation dialog for delete

### 5. Table Styling Updates
- [ ] Add thin borders: `border border-neutral-900` 
- [ ] Between rows: `divide-y divide-neutral-900`
- [ ] Table wrapper: `border border-neutral-900 rounded-xl`

## Implementation Order

1. ✅ Update sidebar structure
2. Create individual pages for admin sections
3. Add API endpoints for edit/delete
4. Update styling with thin borders
5. Test all permissions

## Notes
- Superadmin can see and edit ALL events
- Admin can see and edit events based on permissions
- Regular photographer only sees their own events in main dashboard
- Settings page will be dashboard-specific (no redirect to /settings)
