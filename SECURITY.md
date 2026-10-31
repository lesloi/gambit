# Security

## Reporting a vulnerability

Do not open a public issue. Use the private vulnerability reporting of GitHub:
<https://github.com/lesloi/gambit/security/advisories/new>.

Please include what you did, what happened, and what an attacker could gain. A fix and a release
follow as fast as the maintainer can; there is no bug bounty.

## Scope

Gambit is a static site. The interesting surfaces are:

- a malicious **backup file** imported by the user, which must never execute anything;
- a malicious **content file** shipped or built into the image;
- the **Content-Security-Policy**, which allows no external host;
- the **image** and its base (`nginxinc/nginx-unprivileged`), pinned by tag.

The cluster itself is out of scope: its operation belongs to the infrastructure of the owner.
