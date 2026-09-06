# Brief: Role-Based Access

## Purpose

Give every user account an access level — guest, read-only, user, or admin
(admin being the superuser) — and have the UI and API honor that level so that
what a person can see and do follows from their assigned access. This adds an
access model to the existing app, in which every signed-in account currently has
the same full view/edit access (except the superuser-only account-creation
gate).

## Expected Behavior

1. Every account has exactly one access level: **guest**, **read-only**,
   **user**, or **admin**. Admin is the superuser tier.
2. The four levels behave as follows:
   - **Guest** — the account can sign in and sees the top navigation bar, but
     the main view is an empty/blocked placeholder with an explanatory message
     until an admin elevates the account. Guests can log out and can change
     their own password; they can perform no other actions.
   - **Read-only** — the account can view the company list, company profiles,
     and the industries list, and can open/download stored files and generated
     documents. The account cannot perform any mutating action: no
     add/edit/delete of companies, locations, references, or news; no file or
     artifact upload or deletion; no logo upload or deletion; and no document
     generation (generation creates a new artifact and is treated as a write).
   - **User** — the account has the current full view/edit access: everything
     read-only can do plus all add/edit/delete, upload/delete, and
     document-generation capabilities the app already offers.
   - **Admin** — everything a user can do plus account management (see brief
     "Admin User Management").
3. Defaults: existing manually-created accounts keep full **user** access by
   default; the bootstrap admin is **admin**; auto-provisioned Google SSO
   accounts start at **guest**.
4. The UI presents only the views and actions a level is allowed to use, and
   the API denies any action above the account's level even if it is attempted
   directly (for example, by calling a URL or API endpoint the UI does not
   show).
5. Role changes are admin-only: an account cannot change its own level. Any
   account may still change its own password (existing self-service password
   change is unchanged).
6. A deactivated account has no access: it cannot sign in and its existing
   sessions stop authenticating (existing behavior is preserved).

## Inputs / Outputs

- **Inputs:** The signed-in account's access level; the view requested or the
  action attempted.
- **Outputs:** The requested view shown or action performed, or the view/action
  denied (and, in the UI, not offered) consistent with the account's level.

## User-Visible Behavior

- A **guest** signs in and sees the navigation bar, an empty/blocked main view
  explaining that access is pending, and the ability to log out and change
  their own password; no data or actions are available.
- A **read-only** user sees the same lists, profiles, and industries as today,
  can open/download files and documents, but does not see edit, create, delete,
  upload, or generate controls; any such action attempted directly is refused.
- A **user** sees and can do everything as today.
- An **admin** sees and can do everything a user can, plus the account
  management entry and views (brief "Admin User Management").

## Constraints

- Levels are ordered guest < read-only < user < admin; admin is the superuser
  tier and maps to today's superuser capability.
- Auto-provisioned Google SSO accounts start at guest; existing
  manually-created accounts default to user; the bootstrap admin is admin.
- Role changes are admin-only; a user cannot change their own level (but may
  change their own password).
- The UI and the API must agree: hiding a control in the UI is not sufficient —
  the API must deny out-of-level actions.
- No non-auth functionality regresses: users and admins retain the current
  full view/edit behavior, and existing capabilities are unchanged for the
  levels allowed to use them.

## Basic Acceptance Expectations

- Every account carries one of the four levels with the specified defaults
  (existing accounts user, bootstrap admin admin, SSO-provisioned accounts
  guest).
- A guest signs in and sees only the empty/blocked view plus logout and
  password change; no data is reachable and no action succeeds.
- A read-only user can view lists, profiles, industries, and download files
  and documents, but every write — including document generation — is denied
  and those controls are not shown.
- A user retains the full current view/edit access.
- An admin retains full access and additionally sees the account-management
  entry (brief "Admin User Management").
- Direct API calls for out-of-level actions are refused even when the UI does
  not expose them.