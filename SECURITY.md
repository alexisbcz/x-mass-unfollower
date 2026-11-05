# Security policy

## What the extension does with your data

The extension runs entirely in your browser. It sends no data off your device: its only requests go from your x.com tab to x.com (plus X's own JavaScript bundle, to read current API query IDs). There is no backend, analytics or telemetry. Your X session cookies are used by the browser as for any x.com request; the CSRF token is read from the `ct0` cookie at request time and is never stored. Scan results and settings are kept in IndexedDB for x.com.

## Reporting a vulnerability

If you find a security issue, for example a way for a web page to trigger unfollows or read the extension's stored data, please report it privately through [GitHub's private vulnerability reporting](https://github.com/alexisbcz/x-mass-unfollower/security/advisories/new) rather than opening a public issue.

Please include steps to reproduce and the affected version. You can expect an acknowledgement within a few days.

Only the latest version on the `main` branch is supported.
