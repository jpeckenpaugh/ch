# Brief: Sign-In Page Navigation Fix

## Purpose

Hide the entire top navigation bar — brand, menu links, and toggler — when a
user is not signed in, so an unauthenticated user sees only the sign-in screen.
Today the bar's background and brand still render for unauthenticated users,
with only the menu links and toggler hidden; this fix removes the whole bar.

## Expected Behavior

1. When there is no authenticated session, the entire top navigation bar is
   hidden: the brand, the menu links, and the toggler are all absent.
2. Once an authenticated session exists, the full top navigation bar appears
   (brand, menu links, and toggler) exactly as it does today.
3. When the session ends — via logout or session expiry — the top navigation
   bar hides again.
4. The sign-in page therefore shows no top navigation bar; the only elements an
   unauthenticated user sees on the page are the sign-in form and its supporting
   content.

## Inputs / Outputs

- **Inputs:** The authenticated/session state of the current user.
- **Outputs:** The top navigation bar visible when signed in and hidden when
  not signed in.

## User-Visible Behavior

- An unauthenticated user loading the app sees the sign-in screen with no top
  navigation bar.
- After signing in, the top navigation bar (brand, menu links, and toggler)
  appears.
- After logging out or when a session expires, the top navigation bar
  disappears and the sign-in screen shows again.

## Constraints

- Only the authenticated/session state toggles the bar; the signed-in
  navigation must not regress — when signed in, the bar appears exactly as
  today.
- No other behavior changes; this is limited to hiding/showing the top
  navigation bar based on session state.

## Basic Acceptance Expectations

- With no session, no top navigation bar is visible — no brand, menu links, and
  no toggler.
- With a valid session, the full top navigation bar is visible.
- After logout or session expiry, the top navigation bar is hidden again and the
  sign-in screen is shown.