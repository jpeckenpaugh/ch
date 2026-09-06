# Feature: Admin User Management

## Capability

Let an admin manage user accounts and their access levels from the application:
view all accounts, create accounts with an initial password and level, change a
level afterward (including elevating guest and read-only users), and
activate/deactivate or delete an account.

## Scope notes

- Only admins can access user management; it is hidden from and denied to
  non-admins.
- Safeguards protect the system: the last admin cannot be demoted or deleted,
  and the bootstrap admin cannot be locked out.
- No self-service signup or self-service profile editing; account creation and
  role changes remain admin-only.