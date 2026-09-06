# Feature: Role-Based Access

## Capability

Give each user account an access level — guest, read-only, user, or admin
(admin being the superuser) — and have the UI and API honor that level so that
what a person can see and do follows from their assigned access.

## Scope notes

- Guests are provisioned without elevated access and see an empty/blocked view
  until an admin raises their level; read-only users can view but not edit;
  users have full view/edit access; admins additionally get account management.
- Auto-provisioned Google SSO accounts start at guest; existing manually-created
  accounts keep full user access by default; the bootstrap admin is an admin.
- Role changes are admin-only; a user cannot change their own level (though they
  may still change their own password).