// Centralized disclaimer strings — Helix spec v2.0 §15 + liability posture.
// Every user-facing disclaimer lives here so copy can be audited in one place.

export const DISCLAIMER_VERSION = '2026.04.02';
export const TERMS_VERSION = '2026.04.02';

// Short, persistent banner copy — appears on dose/vial/peptide screens.
export const DISCLAIMER_SHORT =
  'Research purposes only · Not for human use · Not medical advice · 18+';

// Longer form used throughout onboarding and About.
export const DISCLAIMER_ONBOARDING =
  "Helix is a research and tracking tool. It does not diagnose, treat, or " +
  'recommend anything. The peptides described in this app are not approved ' +
  'for human use in most jurisdictions. Dosing ranges and protocols are drawn ' +
  'from published research literature and are provided for educational reference ' +
  'only — they are not recommendations.';

// Terms of Use / Liability screen (onboarding step 5 + Settings > About).
export const TERMS_FULL = `Helix Terms of Use and Liability

1. Research and educational use only
   Helix is an educational and tracking application intended for adult researchers
   and self-directed users who are already working with peptides. The peptides
   described in this app are research chemicals. Many are not approved by the FDA,
   EMA, or other regulatory bodies for human use. Legal status varies by country.

2. Not medical advice
   Nothing in this app constitutes medical advice, a diagnosis, a prescription,
   or a recommendation. All dosing ranges, reconstitution protocols, frequencies,
   timing suggestions, and stacking references are drawn from published research
   literature or documented clinical trials. They are provided for reference only.

3. Not for human use
   Peptides described here are, in most cases, not intended or approved for
   administration to humans. You are solely responsible for confirming the legal
   status in your jurisdiction and for any decision you make regarding use.

4. You are 18 or older
   By using Helix you confirm that you are 18 years of age or older.

5. Consult a licensed clinician
   Before starting, changing, or stopping any peptide protocol, you are strongly
   encouraged to consult a licensed healthcare provider who can evaluate your
   individual situation.

6. No liability
   Helix and its creators, contributors, and distributors make no warranty of any
   kind, express or implied, regarding the accuracy, completeness, safety, or
   fitness for any particular purpose of the information in this app. To the
   maximum extent permitted by law, Helix and its creators are not liable for:
      • any administration, misadministration, or attempted administration of any
        substance referenced in this app;
      • any adverse reaction, injury, illness, or death that occurs during or
        following use of any substance referenced in this app;
      • any loss of property, income, or any indirect, incidental, or
        consequential damage arising from use of this app or the information
        it contains;
      • any action you take based on information displayed in this app.

   You use this app at your own risk and assume full responsibility for your
   decisions.

7. Your data is yours
   Data you enter into Helix is stored on your device. You can export it at any
   time from Settings, and you can delete all of it permanently from Settings
   > Delete all data.

8. Acceptance
   By tapping "I Agree" you acknowledge that you have read and accept these
   terms and the Not-Medical-Advice acknowledgement on the previous screen.

Last updated: April 2026 — v${TERMS_VERSION}`;

// Dose-specific framing — used wherever we show a numeric range.
export const DISCLAIMER_DOSING =
  'The range shown is drawn from published research protocols — it is not a ' +
  'recommended dose. Speak with a licensed clinician before starting or changing ' +
  'any peptide protocol.';

// Peptide detail — unapproved status.
export const DISCLAIMER_PEPTIDE_UNAPPROVED =
  'Research chemical · Not FDA-approved · Not intended for human use. ' +
  'Legal status varies by country. Research quality varies. See citations for ' +
  'primary sources.';

// Citation footer for dosing sections.
export const DISCLAIMER_CITATION_FOOTER =
  'Dosing figures reflect protocols reported in research literature — they are ' +
  'not a recommendation. Consult a licensed clinician before starting or ' +
  'changing any peptide protocol.';

// Beginner-protocol framing (required before any "starter" info).
export const DISCLAIMER_BEGINNER =
  'The information below reflects titration schedules described in published ' +
  'research or clinical trial protocols. It is not a recommendation to start at ' +
  'any specific amount. Consult a licensed clinician.';
