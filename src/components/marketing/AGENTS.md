# Marketing

- Story and Feed link clicks share `LinkClicksTab`, but use separate tables and placement/account-scoped query keys through `LINK_CLICK_STORAGE`; existing story dates stay unchanged. Why: changing tabs must never mix totals or reclassify past stories.