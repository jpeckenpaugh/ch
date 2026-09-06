# Brief: Admin User Management

## Purpose

Let an admin manage user accounts and their access levels from the application:
view all accounts, create accounts with an initial password and level, change a
level afterward (including elevating guest and read-only users), and
activate/deactivate or delete an account. This adds an admin interface on top of
the existing app, whose only current account-management capability is a
superuser-only account-creation endpoint and the console-printed bootstrap admin
flow.

## Expected Behavior

1. Only admins can reach user management. An admin-only **Users** entry appears
   in the top navigation bar for admins and opens the user-management view;
   non-admins never see the entry, and the underlying API denies non-admins.
2. The user-management view lists all user accounts with their email and access
   level, and shows which accounts are active/inactive. It does not invent
   search or pagination.
3. An admin can create an account by supplying an email, an initial password,
   and an access level. Creating a duplicate email is refused with a clear
   error.
4. An admin can change any account's access level afterward, including
   elevating a guest or read-only user to a higher level.
5. An admin can activate or deactivate an account. A deactivated account can no
   longer sign in and its existing sessions stop authenticating; reactivating
   restores access.
6. An admin can delete an account. A deleted account is permanently removed, can
   no longer sign in, and its linked identity (for example, a Google SSO link)
   no longer exists.
7. Safeguards protect the system and are enforced by both the UI and the API:
   - The **bootstrap admin can never be deactivated, demoted, or deleted** under
     any circumstance.
   - The **last remaining admin cannot be demoted or deleted**; this rule
     applies to all other admins. An action that would remove or demote the last
     admin is refused.
   - A refused safeguard action produces a clear error message and leaves the
     account unchanged.
8. There is no self-service signup or self-service profile editing; account
   creation and role changes remain admin-only. A user can still change their
   own password (existing behavior).

## Inputs / Outputs

- **Inputs:** The admin's requested operation; for creation, an email, initial
  password, and access level; for changes, the target account and the new
  level/state.
- **Outputs:** An updated set of accounts, levels, and active states; refused
  operations with a clear error; visibility of the entry and views limited to
  admins.

## User-Visible Behavior

- An **admin** sees a **Users** entry in the top navigation bar leading to a
  management view listing all accounts, their access levels, and their active
  state.
- The admin can create an account (email + initial password + level), change a
  level, activate/deactivate, and delete accounts, with clear success messages
  and clear errors for refused actions (duplicate email, and the safeguards
  below).
- A **non-admin** never sees the **Users** entry; direct attempts to reach the
  management view or its API are denied.
- Attempts to deactivate, demote, or delete the bootstrap admin, or to demote or
  delete the last remaining admin, are refused with a clear error and no change
  is made.

## Constraints

- Only admins can access user management; it is hidden from and denied to
  non-admins (both in the UI and at the API).
- The bootstrap admin can never be deactivated, demoted, or deleted under any
  circumstance.
- The last remaining admin cannot be demoted or deleted; this rule applies to
  all other admins.
- No self-service signup or self-service profile editing; account creation and
  role changes remain admin-only.
- Deletion is permanent; a deleted account and its data (including any linked
  identity) are removed.
- No non-auth functionality regresses; existing capabilities are unchanged.

## Basic Acceptance Expectations

- An admin can open the **Users** view, see all accounts with their levels and
  active states, create an account, change a level (including elevating guest
  and read-only users), activate/deactivate, and delete an account.
- A non-admin cannot see the **Users** entry and is denied access to the
  management view and its API.
- The bootstrap admin cannot be deactivated, demoted, or deleted under any
  circumstance.
- The last remaining admin cannot be demoted or deleted; the refused action
  leaves the account unchanged and reports a clear error.
- A deactivated account cannot sign in and its sessions stop working;
  reactivation restores access.
- A deleted account cannot sign in and its linked identity no longer exists.