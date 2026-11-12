# Mobile homepage optimization

Goal: help mobile buyers reach listings and WhatsApp sooner, preserving the desktop design, SEO, contact details and all three listing records.

Implementation: retain the static HTML/CSS/JavaScript stack. Use a mobile-only section order; keep district, keyword, type and prices visible; collapse bedrooms and baths behind an accessible More Filters control on mobile and leave them visible on desktop. Add a mobile WhatsApp action. Extract inline images into deduplicated local assets, resize large photos, and keep below-fold images lazy.

Constraints: work on feature/mobile-homepage-optimization; no commit, push, deployment, Supabase or database changes. No new runtime dependencies.

- [x] Update responsive presentation and progressive filter disclosure.
- [x] Extract and optimize image assets without changing image subjects.
- [x] Verify 320, 375, 390, 620, 768 and 1440px layouts, filter disclosure and filtering, WhatsApp URL generation, image loading, JavaScript syntax, SEO preservation and Git diff.

Review focus: no horizontal overflow; keyboard access and hidden filter values; desktop filter visibility; all local image paths resolve; original listing and contact data survive unchanged.

Verification: `node scripts/check-mobile.cjs` passed all six widths, filter disclosure and preserved hidden values, price/bedroom/address searches, resize restoration, WhatsApp URL generation, all 22 image decodes, script syntax, SEO and listing equality. No runtime exceptions. External font and property-image services were blocked during the deterministic layout check; this is not an online speed measurement or a test of those third-party services.

Preview: open index.html in Chrome or Edge, press F12 then Ctrl+Shift+M, select a phone or enter 390px width, and refresh. For deployment, include assets/images with index.html. No commit, push or deployment performed.

## Final mobile adjustment

- Mobile header retains Joel Tan and Let's talk, with About/Properties/Why Joel in an accessible disclosure menu. Link selection, outside click, Escape and breakpoint changes close it.
- Mobile platform links now appear in normal footer flow; the gold floating control no longer covers price inputs. Desktop platform links are unchanged.
- Price inputs now accept whole-ringgit amounts (step=1), fixing browser validation blocking RM395,000 searches.
- Final `node scripts/check-mobile.cjs`: PASS at 320/375/390/430/620/768/1440px; no horizontal overflow; price input corners and centre clickable; 10 exact expected-result filter cases per width; Quick/Address/Map tabs and map link; More Filters; WhatsApp message generation; resize restoration; image decoding; SEO and listing preservation; zero runtime exceptions. Independent read-only review found no actionable regressions.
- Third-party fonts/property-image services remain outside the local deterministic test coverage. No commit, push, deployment, Supabase or property-record changes.
