# Marketing

- Story and Feed link clicks share `LinkClicksTab`, but use separate tables and placement/account-scoped query keys through `LINK_CLICK_STORAGE`; existing story dates stay unchanged. Why: changing tabs must never mix totals or reclassify past stories.
- RECORDES derives Story/Feed chart and weekly-table numbers from existing dated link entries through `useRecordsLinkClicks`, with complete account/profile/year-scoped reads; these derived metrics stay outside the manual save/goal fields. Why: one source per placement without new columns, duplicate inputs or changed commercial rules.