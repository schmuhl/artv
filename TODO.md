# arTV To-Dos

These are future hardening and maintenance tasks. The current deployment goal is to keep arTV simple enough to copy into a single web-server directory.

## Security and deployment

- [ ] Decide how to protect Google credentials while preserving a single-folder deployment.
  - Consider an Apache rule that denies HTTP access to credential and configuration files.
  - If arTV is ever exposed outside a trusted home network, move credentials outside the document root and rotate the service-account key.
- [ ] Make `downloadGDFiles.php` CLI-only, or otherwise prevent it from being invoked over HTTP.
- [ ] Sanitize Google Drive filenames before writing them into `art/`; reject path separators and unsafe names.
- [ ] Disable or protect `api.php?debug=1` so media filenames and Drive metadata are not exposed unintentionally.
- [ ] Review whether `art/config.json` should remain directly downloadable, especially when it contains shared-album URLs or folder identifiers.

## Reliability

- [ ] Add a browser-side timeout with `AbortController` so a stalled media request cannot freeze slideshow rotation.
- [ ] Add connection and response timeouts to the iCloud cURL requests in `api.php`.
- [ ] Add appropriate timeout handling for Google Drive requests.
- [ ] Confirm recovery behavior when iCloud, Google Drive, or the local media endpoint is temporarily unavailable.

## Repository maintenance

- [ ] Remove the newly committed 104 MB `arTV.psd` blob from local Git history before pushing, if keeping repository size small is important.
- [ ] Consider removing older PSD blobs from Git history or moving source artwork to separate storage.
- [ ] Consider Git LFS if editable design-source files need to be versioned later.

## Offline operation and testing

- [ ] Bundle the clock font locally so the kiosk does not depend on Google Fonts or internet access.
- [ ] Add automated tests for overnight blanking, per-screen overrides, failed media requests, and rotation locking.
- [ ] Test long-running memory use and slideshow recovery on the target Raspberry Pi/browser.

## Deployment reminder

- [ ] Keep the web server restricted to trusted local-network devices unless the security items above have been completed.
- [ ] Do not configure public port forwarding to the arTV server in its current form.
