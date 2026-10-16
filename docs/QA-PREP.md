# Judge Q&A preparation
Both students answer; mentors may not speak for the team (rule 11.3). Split: Student A takes data, engine and security; Student B takes portals, UX and rollout.

1. **How is this different from separate government portals?** It joins records held in different offices (registration, mutation, tax, courts) and gives one explainable verdict with evidence and next steps, instead of leaving the buyer to interpret each portal alone.
2. **What if the record is wrong?** Citizens file "this record looks wrong" tickets; admins resolve them through an audited function, and the citizen is notified. The verdict always shows its evidence so errors are visible.
3. **Misuse and scraping?** Land tables are not readable by the browser. Only functions are exposed, owner names are masked for anonymous users, and dossier calls are rate limited.
4. **Privacy?** See docs/PRIVACY.md: synthetic data only, no NID, certificate page shows nothing personal.
5. **How accurate is name matching?** Trigram similarity plus father's-name agreement with thresholds stored in `risk_rules`. A look-alike is flagged High, not silently accepted. See docs/NAME_MATCHING.md.
6. **Legal standing of the certificate?** None today. It is decision support, not legal advice, and every report says so. Wording needs mentor or Law-department review before real use.
7. **Scaling to 64 districts?** Spatial and trigram indexes already exist. Next steps: partition by district, read replicas, caching public verification.
8. **Rural access?** Mobile-first Bangla UI. Planned: Union Digital Centres as assisted points and SMS/USSD for feature phones.
9. **How would real data arrive without scraping?** Through official data-sharing agreements and read-only adapters, never through scraping.
10. **Why Supabase?** Open-source Postgres that a government can self-host, with row-level security and SQL functions we can audit.
11. **Can an admin quietly change a record?** Every admin write goes through a function that appends to a hash-chained log; breaking the chain is detectable.
