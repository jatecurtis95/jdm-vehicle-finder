# Dealer System - Quick Reference Guide

## For Admin: Creating and Managing Dealers

### Create a New Dealer
1. Go to: `https://jdmfinder.com.au/admin?view=dealers`
2. Fill out the form at the top:
   - **Name** (required) - e.g. "John Smith"
   - **Email** (required) - e.g. "dealer@example.com"
   - **Company** (optional) - e.g. "Smith's Imports"
   - **State** (optional) - e.g. "NSW"
3. Click "Add Dealer"
4. Dealer receives invite email automatically

### Resend Invite Email
- On the dealer list, find the dealer
- Click "Resend Invite" button
- New email sent with fresh 7-day password setup link

### Activate / Deactivate Dealer
- Click "Activate" or "Deactivate" button per dealer
- Deactivated dealers cannot log in
- Useful for temporarily disabling account

### Delete Dealer
- Click "Delete" button (requires confirmation)
- ⚠️ Removes dealer account + ALL their vehicle submissions
- Cannot be undone

---

## For Dealer: Using the Portal

### First Time Setup
1. Check your email for JDM Finder invite
2. Click "Set your password" button or copy the link
3. Enter your password (twice to confirm)
4. You'll be logged in to your portal automatically

### Submit a Vehicle
1. Log in at: `https://jdmfinder.com.au/login`
   - Email: your registered email
   - Password: the one you set up
2. Click "Submit a Vehicle"
3. Fill out the form:
   - **Make** (required) - e.g. "NISSAN"
   - **Model** (required) - e.g. "SKYLINE"
   - **Year** (optional) - e.g. 1995
   - **Grade** (optional) - e.g. "5"
   - **Mileage** (optional) - in kilometers
   - **Price** (required) - in AUD, must be > 0
   - **Location** (optional) - e.g. "Sydney NSW"
   - **Description** (optional) - any details about the car
4. Click "Submit for Review"
5. You'll see "Thanks! Your vehicle has been submitted..."

### Check Vehicle Status
1. In your portal, scroll down to "Your Submissions"
2. You'll see all your vehicles with status badges:
   - **Pending** (orange) - waiting for admin review
   - **Approved** (green) - approved and live
   - **Rejected** (red) - rejected, see notes below
3. If rejected, admin notes will show why
4. You can resubmit with corrections

### Logout
- Click "Logout" or close your browser
- Your session ends (you'll need to log in again next time)

---

## For Admin: Reviewing Vehicle Submissions

### Access Review Queue
1. Go to: `https://jdmfinder.com.au/admin?view=dealer-submissions`
2. Default shows "Pending" tab (vehicles awaiting review)
3. Use tabs to filter: Pending, Approved, Rejected, Archived

### Review a Vehicle
Each vehicle card shows:
- **Make/Model/Year** - the car details
- **Price** - in AUD
- **Mileage** - in kilometers
- **Grade** - if provided
- **Location** - if provided
- **Dealer Info** - name, company, email
- **Description** - if dealer added any notes
- **Actions** - Approve or Reject buttons

### Approve a Vehicle
1. Find the vehicle in "Pending" tab
2. Click "Approve" button
3. Vehicle status changes to "approved" instantly
4. Moves to "Approved" tab
5. Dealer sees green badge in their portal

### Reject a Vehicle
1. Find the vehicle in "Pending" tab
2. Enter optional rejection notes in the text box (why you rejected it)
3. Click "Reject" button
4. Vehicle status changes to "rejected"
5. Moves to "Rejected" tab
6. Dealer sees rejection notes in their portal + can resubmit

### See Previously Approved/Rejected
- Click "Approved" tab to see all approved vehicles
- Click "Rejected" tab to see all rejected vehicles
- Click "Archived" tab to see archived vehicles
- Dealer info always visible for follow-up

---

## URL Reference

| Page | URL | Access |
|------|-----|--------|
| Dealer Login | `/login` | Anyone |
| Dealer Portal | `/dealer/portal` | Logged-in dealers only |
| Submit Vehicle | `/dealer/vehicle/submit` | Dealers (POST form) |
| Admin Dealers | `/admin?view=dealers` | Admin only |
| Dealer Submissions | `/admin?view=dealer-submissions` | Admin only |
| Set Password | `/set-password?token=...` | From invite email |

---

## Common Issues & Solutions

### Dealer Didn't Receive Email
1. Check spam/junk folder
2. Verify email address was spelled correctly
3. Admin: click "Resend Invite" to send new email
4. Dealer: watch for it (may take a few minutes)

### Dealer Can't Log In
**Problem**: Email or password incorrect
- Solution: Try again, check caps lock

**Problem**: "Account not found"
- Solution: Verify you're using the registered email address
- Admin: Check dealer is active (not deactivated)
- Admin: Try resend invite to reset

**Problem**: "Incorrect password"
- Solution: Password is case-sensitive, try again
- Admin: Resend invite for dealer to reset password

### Password Reset
- Dealer clicks "Forgot password?" → not implemented yet
- Admin solution: click "Resend Invite" in dealer list
- Dealer gets new 7-day password setup link

### Submitted Vehicle Not Appearing
1. Dealer: Refresh page (ctrl+R or cmd+R)
2. Admin: Refresh page, look in `/admin?view=dealer-submissions?status=pending`
3. Check browser console for errors (F12 → Console tab)
4. Verify dealer is active (admin: check dealer list)

### Vehicle Appears But Can't Approve/Reject
- Only admin role can approve/reject
- Verify you're logged in as admin
- Page should show dealer management options

---

## Best Practices

**For Admin**
- ✅ Check resend invite before deleting (in case email bounced)
- ✅ Use rejection notes to help dealer improve submissions
- ✅ Deactivate instead of delete if you might need the account back
- ✅ Organize active dealers (use state/company filters if list is large)

**For Dealer**
- ✅ Fill in all optional details (helps admin evaluate vehicle)
- ✅ Provide accurate pricing and mileage
- ✅ Check back regularly for approval status
- ✅ Read rejection notes carefully if resubmitting

---

## Technical Notes

**Database**
- All data stored in D1 (Cloudflare SQLite)
- Automatic backups (Cloudflare managed)

**Security**
- Passwords hashed with PBKDF2-SHA256
- Invite links expire after 7 days
- Sessions invalidated on logout

**Performance**
- Queries indexed for fast lookups
- Pagination ready (100 submissions per page)

---

## Support

For technical issues:
1. Check this guide first
2. Check `/admin` error messages
3. Contact: support@jdmconnect.com.au

---

**Last Updated**: July 7, 2026  
**System Status**: 🟢 Live in Production  
**Support**: Available during business hours
