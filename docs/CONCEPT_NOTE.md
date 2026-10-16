# V-Land P5: Citizen Pre-Purchase Verification
Team: [Student A], [Student B] · Mentors: [names] · Track: digital land records, verification, tamper-proof checks

## Problem
Land disputes in Bangladesh come from forged deeds, conflicting khatians across survey generations (CS, SA, RS, BS) and records split between the sub-registry and the AC Land office. A buyer must read a porcha, check mutation and tax, and ask about court cases across different offices, then interpret the result alone.

## Solution
V-Land turns an existing 3D map of Bangladesh into the front door of a "check before you buy" service. A citizen finds a plot (record numbers, 3D map, GPS or deed number), names the seller and gets a **Clear, Caution or Stop** verdict from 20 transparent rules. Each finding shows its evidence and a plain-language next step in Bangla or English. A QR-verifiable certificate with a hash and signature lets banks and lawyers confirm the result, and states whether the record changed since it was issued.

## Architecture
React and TypeScript portals plus the original three.js map. Supabase (Postgres, PostGIS, row-level security). All verification logic lives in database functions; the browser never reads land tables. Admin writes go through audited, hash-chained functions.

## Key features
Explainable verdict; seller and co-sharer check with Bangla name matching; survey cross-reference; certified report with change detection; watch and re-check; admin console with fraud signals, rule management, certificate revocation, audit-chain verification and one-click demo reset.

## Data and ethics
All data is synthetic: no NID, phone number or real address anywhere. No government system is queried or scraped. The verdict is decision support, not legal advice. AI tools (Claude by Anthropic) were used for planning and code generation and reviewed by the students.

## Countrywide plan
1. **Pilot:** one upazila land office and sub-registry through read-only data exchange.
2. **District rollout:** Union Digital Centres as assisted points, and SMS or USSD for feature phones.
3. **National:** join records, mutation, registration, land tax and court-case systems through official data-sharing agreements, with national ID sign-in.

Also required: legal review of certificate wording, data-protection rules, scaling (partition by district, spatial indexes, read replicas, caching public verification) and a named operator.
