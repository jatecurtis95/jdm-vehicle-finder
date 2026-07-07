# Dealer System Implementation

## Overview
Added a complete dealer vehicle submission system to JDM Finder. Dealers can login, submit vehicles for admin review, and admins get a dedicated review queue.

## What's Been Implemented

### Phase 1: Database Schema & Authentication ✅

**Database Migration** (`migrations/0013_dealer_system.sql`):
- `dealers` table: Login accounts for vehicle suppliers
  - email, name, company, state, password fields
  - invite_token/invite_exp for set-password flow
  - session_ver for session invalidation
  - active flag, timestamps
  
- `dealer_vehicles` table: Vehicle submissions for review
  - dealer_id, make, model, year, grade, mileage_km, price_aud, location
  - photos (JSON array), description
  - status: 'pending' | 'approved' | 'rejected' | 'archived'
  - admin_notes for rejection reasons
  - Indexed by dealer_id, status, created_at

**Authentication** (`src/auth.js`):
- `dealerByInviteToken()` - lookup dealer from set-password token
- `setDealerPassword()` - dealer sets password from invite
- Extended `authenticate()` to check dealers table
- Extended `currentSessionVer()` and `bumpSessionVer()` for dealer sessions
- Extended session cookie validation to support dealer role

### Phase 2: Admin Functions ✅

**Dealer Management** (`src/admin.js`):
- `createDealer(env, form)` - admin creates new dealer account
- `resendDealerInvite(env, id)` - resend set-password link
- `toggleDealer(env, id)` - activate/deactivate dealer
- `deleteDealer(env, id)` - remove dealer and all their submissions

**Vehicle Submission** (`src/admin.js`):
- `submitDealerVehicle(env, form, session)` - dealer submits a vehicle
- `approveDealerVehicle(env, vehicleId, session)` - admin approves submission
- `rejectDealerVehicle(env, vehicleId, notes, session)` - admin rejects with notes
- `getDealerVehicleSubmissions(env, status, limit, offset)` - list for admin review
- `getDealerVehicles(env, dealerId, status)` - get specific dealer's submissions

### Phase 3: Routes & UI Scaffolding ✅

**Dealer Login & Portal** (`src/index.js`):
- `/login` - Extended to handle dealer authentication
- `/set-password` - Extended to handle dealer invites
- `/dealer/portal` - Dealer dashboard (placeholder)
- `/dealer/vehicle/submit` - POST dealer vehicle submission

**Admin Management Routes** (`src/index.js`):
- `POST /dealer` - Create dealer account
- `POST /dealer/invite` - Resend dealer invite
- `POST /dealer/toggle` - Activate/deactivate dealer
- `POST /dealer/delete` - Delete dealer account
- `POST /dealer-vehicle/approve` - Approve vehicle submission
- `POST /dealer-vehicle/reject` - Reject vehicle submission
- `GET /admin?view=dealers` - List all dealers (JSON preview)
- `GET /admin?view=dealer-submissions` - Review pending submissions (JSON preview)

**Home Routing**:
- Dealers route to `/dealer/portal` after login
- Admin, agent routes to `/admin`
- Client routes to `/portal`

## What Still Needs Implementation

### UI/Rendering Functions (High Priority)

1. **Dealer Portal UI** - `dealerPortalPage()` in admin.js
   - Vehicle submission form (make, model, year, price, location, description, photos)
   - List of dealer's submissions with status badges
   - Bulk actions (delete, resubmit)
   - Notifications when submissions are approved/rejected

2. **Admin Dealer Management UI** - `dealersPage()` in admin.js
   - List of all dealers (name, company, state, active status, created_at)
   - Quick actions: invite link, toggle active, delete
   - Bulk actions
   - Filter by active/inactive
   - Search by name/email

3. **Admin Dealer Submissions UI** - `dealerSubmissionsPage()` in admin.js
   - Queue of pending vehicle submissions (admin review inbox)
   - Vehicle card: make/model/year, dealer name, price, location, description
   - Status filter tabs: Pending | Approved | Rejected
   - Approve/reject actions with optional notes
   - Pagination
   - Search/filter by dealer, make, model

### Integration Points

1. **Email System** - Dealer invite emails
   - Reuse `agentInviteHtml()` or create `dealerInviteHtml()`
   - Send via `sendInvite()` helper (already wired in index.js)

2. **Photo Handling**
   - Form submission needs to handle file uploads
   - Store as JSON array of URLs in dealer_vehicles.photos
   - Need photo upload endpoint or integrate with existing asset handling

3. **Notification System**
   - When admin approves: email dealer with approval notification
   - When admin rejects: email dealer with rejection reason + notes
   - Optional: Slack/push notification to admin when new submission arrives

### Admin Dashboard Integration

1. Add "Dealer Submissions" section to admin dashboard
2. Show count of pending submissions
3. Quick link in main nav
4. Activity feed showing recent dealer actions

### Optional Enhancements

1. **Dealer Vehicle Visibility**
   - Approved dealer vehicles appear in buyer portal?
   - Or stay in separate "dealer inventory" section?
   - Currently designed as separate - dealers don't feed into auto-matching

2. **Dealer Analytics**
   - Submission history
   - Approval rate
   - Performance dashboard

3. **Bulk Operations**
   - Dealers can mark vehicles as sold/archived
   - Dealers can resubmit rejected vehicles with updates

4. **Approval Workflow**
   - Add "needs info" status (ask dealer for more details)
   - Dealer response queue
   - Approval notes visible to dealer

## Database Setup

To apply the schema migration:

```bash
# Local development
wrangler d1 execute jdm-vehicle-finder --local --file migrations/0013_dealer_system.sql

# Production
wrangler d1 execute jdm-vehicle-finder --remote --file migrations/0013_dealer_system.sql
```

## Testing Checklist

- [ ] Dealer can reset password from invite link
- [ ] Dealer login works with email + password
- [ ] Dealer can submit a vehicle with all fields
- [ ] Dealer submissions appear in admin queue (status pending)
- [ ] Admin can approve submission (status → approved)
- [ ] Admin can reject submission with notes (status → rejected)
- [ ] Dealer can see their submissions
- [ ] Approved dealers stay in system when marked inactive
- [ ] Deleting dealer removes all their submissions
- [ ] Session invalidation works (logout works, cookie expires)

## Files Modified

- `src/auth.js` - Added dealer auth functions
- `src/admin.js` - Added dealer management & submission handlers
- `src/index.js` - Added routes and dealer portal handler
- `migrations/0013_dealer_system.sql` - Database schema

## Next Steps

1. **Immediate**: Create dealerPortalPage() and dealersPage() UI rendering
2. **Short-term**: Implement dealerSubmissionsPage() with approval workflow
3. **Medium-term**: Add photo upload and dealer notifications
4. **Long-term**: Integration with buyer portal / dealer inventory visibility

## Code Examples

### Creating a dealer (admin):
```javascript
const result = await createDealer(env, formData);
// { ok: true, token, email, name }
```

### Dealer submitting a vehicle:
```javascript
const result = await submitDealerVehicle(env, formData, session);
// { ok: true, id, vehicle } | { ok: false, error }
```

### Admin approving submission:
```javascript
await approveDealerVehicle(env, vehicleId, session);
// Updates status to 'approved', sets approved_at & approved_by
```

### Getting submissions for review:
```javascript
const submissions = await getDealerVehicleSubmissions(env, "pending", 50, 0);
// Returns array of pending dealer vehicles with dealer details
```
