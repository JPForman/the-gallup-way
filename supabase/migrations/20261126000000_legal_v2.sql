-- Step 7.1: final legal text (version 2 of Terms, Privacy Policy and
-- Contributor Agreement). Hashes match src/content/agreements.ts.
-- Existing members are asked to accept the new Terms and Privacy Policy
-- before they can post again (/account/agreements); the new Contributor
-- Agreement is accepted at the next publish.
insert into public.agreement_versions (kind, version, text_sha256) values
  ('terms', 2, '35eca39860160b22b1c7b602f94fd08fc0ef9d29b1c9e62da17403757b9ce38f'),
  ('privacy', 2, '44965e716a0c3050745d7e2aec103188b647ddc71b770c430354d548c5d06420'),
  ('contributor', 2, '7b1ec3090f4f286aaff4734bcbc2e4f7ff12b3553f6d36985f0b179078f48d52');
