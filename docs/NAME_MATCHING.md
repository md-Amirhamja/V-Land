# Seller name matching (rule R07)

Implemented in private.person_score, called from the verdict engine (011_engine.sql).

Thresholds are stored in risk_rules.params for R07, not in code: match = 0.85, lookalike = 0.6.

- Score at or above 0.85: match, no finding.
- Score from 0.6 up to 0.85: possible look-alike, High severity.
- Score below 0.6: mismatch, Blocker, so the verdict is Stop.

The seller's name and father's name are compared with every current owner (ownerships.to_date is null) in Bangla and English. The best score wins. Name normalisation and the father's-name bonus are as specified in docs/PLAN.md task 2.14.
