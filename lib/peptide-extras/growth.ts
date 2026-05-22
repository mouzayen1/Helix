import type { PeptideExtrasMap } from './types';

// GHRP / GHRH class. Most real-world protocols pair a GHRP (ipamor/ghrp2/ghrp6/hexar)
// with a GHRH (cjc / sermorelin / tesamorelin) to drive pulsatile GH release.

export const GROWTH_EXTRAS: PeptideExtrasMap = {
  ipamor: {
    benefits:
      'Selective pentapeptide GH secretagogue. Stimulates a GH pulse with minimal effect on cortisol or prolactin. Research on IGF-1 elevation, sleep quality, recovery.',
    beginnerProtocol:
      'Research protocols start at 100–200 mcg per dose, 1–3× daily. Typical target 200–300 mcg per pulse. 5-days-on / 2-off schedule preserves receptor sensitivity across long cycles.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Pulsatile dosing to preserve receptor sensitivity. 5-days-on / 2-off is the common pattern in research.',
      schedule: '200–300 mcg SubQ up to 3× daily (AM, post-workout, pre-bed). 5 days on, 2 off, for 12 weeks.',
      phases: [
        { name: 'Active (5-on / 2-off)', weeks: 12, dose_modifier: '200–300 mcg SubQ, up to 3×/day, 5 days on + 2 days off' },
      ],
    },
    timing:
      'Pre-bed dose aligns with natural GH pulse. Empty stomach preferred (no carb/fat within 2 hours) to avoid blunting GH release.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'Classic GHRP + GHRH pairing. Separate vials, co-injected for pulsatile + baseline GH.' },
      { peptide_id: 'cjc_dac', note: 'Same rationale; DAC gives constant elevation instead of pulsatile.' },
      { peptide_id: 'sermor', note: 'GHRP + GHRH pairing, sermorelin is shorter-acting GHRH.' },
      { peptide_id: 'tesamor', note: 'GHRP + stabilized GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs cause ghrelin receptor desensitization.' },
      { peptide_id: 'mk677', reason: 'MK-677 is a long-acting ghrelin agonist; stacking causes constant over-stimulation.' },
    ],
    commonMistakes: [
      'Eating within 2 hours of a dose — carbs/fat blunt the GH pulse by raising somatostatin.',
      'Running a continuous daily schedule longer than 8 weeks without 2-off days; receptor sensitivity drops.',
    ],
    proTips: [
      'Pre-bed dose stacks on the natural slow-wave-sleep GH pulse — this is why users report better sleep subjectively.',
      'Pair with CJC-1295 (no DAC) in separate vials, injected at the same time, for the GHRH + GHRP synergy.',
    ],
    sideEffects: [
      'Transient head-rush, flushing, or tingling shortly after injection',
      'Increased water retention; mild puffiness in face / hands',
      'Numbness or tingling in fingers (carpal-tunnel-like) at higher chronic doses',
      'Mild blood-glucose elevation; insulin sensitivity can drift on long cycles',
    ],
    contraindications: [
      'Active malignancy (GH/IGF-1 elevation is undesirable)',
      'Severe insulin resistance or uncontrolled diabetes',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'Ipamorelin is a "selective growth hormone secretagogue" — it tells your pituitary to release growth hormone in clean, brief pulses without affecting other hormones like cortisol or prolactin (which is the issue with older GH-releasers). It\'s almost always paired with CJC-1295, which acts on a complementary pathway. The two together produce a stronger, more natural pulse than either alone. Mostly preclinical and limited human data, but widely used in research and athletic recovery contexts due to a clean side-effect profile.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  cjc_nodac: {
    benefits:
      'GHRH analog (Mod GRF 1-29) with short half-life (~30 min). Pairs with a GHRP to drive large pulsatile GH release without affecting pulse architecture.',
    beginnerProtocol:
      'Research protocols: 100 mcg SubQ per pulse, 1–3× daily, co-injected with a GHRP like Ipamorelin. 5-on/2-off schedule mirrors the paired GHRP.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Same cadence as the paired GHRP (usually Ipamorelin). 5-days-on / 2-off preserves receptor sensitivity.',
      schedule: '100 mcg SubQ + 200–300 mcg Ipamorelin SubQ up to 3× daily, 5-on/2-off, 12 weeks.',
      phases: [
        { name: 'Active (5-on / 2-off)', weeks: 12, dose_modifier: '100 mcg SubQ per pulse, co-injected with Ipamorelin, 5 days on + 2 days off' },
      ],
    },
    timing: 'Same as the paired GHRP — pre-bed, AM, and/or post-workout, empty stomach.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'Canonical GHRH + GHRP pairing.' },
      { peptide_id: 'ghrp2', note: 'GHRP-2 pairing (more appetite increase).' },
      { peptide_id: 'ghrp6', note: 'GHRP-6 pairing (strong appetite increase).' },
      { peptide_id: 'hexar', note: 'Hexarelin pairing (potent GH release).' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_dac', reason: 'Two GHRH analogs at once — redundant, receptor desensitization risk.' },
      { peptide_id: 'sermor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'tesamor', reason: 'Two GHRH analogs — redundant.' },
    ],
    sideEffects: [
      'Brief facial flushing or warmth right after injection',
      'Injection-site reactions (redness, mild swelling)',
      'Mild headache or lightheadedness',
      'When paired with a GHRP, water retention and glucose drift apply (see paired-peptide profile)',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'CJC-1295 is a synthetic version of the natural growth hormone signal your brain sends. Like Tesamorelin, it tells your body to release its own growth hormone in pulses — not by injecting growth hormone directly. The "no DAC" version (without Drug Affinity Complex) has a short half-life of about 30 minutes, which means it produces a clean, brief pulse of growth hormone that mimics natural release. It\'s almost always paired with Ipamorelin to amplify the pulse. Research is mostly preclinical; human clinical data is limited but it\'s widely used in research and athletic recovery contexts.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen, 1 year refrigerated as lyophilized powder.',
        afterMixing:
          'Refrigerate. Use within 30 days. Some research suggests CJC-1295 (no DAC) is less stable than other peptides once mixed — observe for cloudiness or discoloration.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  cjc_dac: {
    benefits:
      'GHRH analog with drug-affinity complex (albumin-binding). Long half-life (~6–8 days) gives baseline GH/IGF-1 elevation instead of pulsatile release.',
    beginnerProtocol:
      'Research protocols: 1–2 mg SubQ once or twice weekly.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Weekly dosing; IGF-1 rises after 2–3 weeks and plateaus. 12-week cycles common.',
      schedule: '1 mg SubQ weekly (e.g., Sunday evening) for 12 weeks, with 4-week wash-out.',
    },
    timing: 'Consistent day each week. Pre-bed on injection night is common in research.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'Baseline GHRH (DAC) + pulsatile GHRP (Ipamorelin) pattern.' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'sermor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'tesamor', reason: 'Two GHRH analogs — redundant.' },
      { peptide_id: 'mk677', reason: 'Both produce constant GH stimulation; compounding desensitization risk.' },
    ],
    sideEffects: [
      'Sustained water retention and mild puffiness',
      'Numbness or tingling in hands at higher chronic doses',
      'Mild fasting-glucose elevation; insulin sensitivity may drift',
      'Joint achiness in some users on extended cycles',
    ],
    contraindications: [
      'Active malignancy',
      'Severe insulin resistance or uncontrolled diabetes',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'CJC-1295 with DAC (Drug Affinity Complex) is the long-acting version of CJC-1295. The DAC modification binds the peptide to albumin in your blood, extending its half-life from 30 minutes to roughly 8 days. Instead of brief pulses, it creates a sustained elevation of growth hormone signaling — what researchers call a "GH bleed." This is fundamentally different from the no-DAC version: less natural, more constant. Whether that\'s a benefit or a drawback is debated; the constant signal may reduce your body\'s natural pulse rhythm over time.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  sermor: {
    benefits:
      'GRF(1-29) — native GHRH fragment. Short half-life; promotes natural pulsatile GH release. Historically used in pediatric GH deficiency diagnostics.',
    beginnerProtocol:
      'Research protocols: 200–500 mcg SubQ once daily, usually pre-bed.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long cycles; IGF-1 rises slowly.',
      schedule: '300 mcg SubQ pre-bed, 5 days on / 2 off, for 12 weeks.',
    },
    timing: 'Pre-bed, empty stomach (no carb/fat within 2 hours).',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'GHRH + GHRP pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Same GHRH mechanism class — redundant.' },
      { peptide_id: 'cjc_dac', reason: 'Same mechanism — redundant.' },
      { peptide_id: 'tesamor', reason: 'Same mechanism — redundant.' },
    ],
    sideEffects: [
      'Brief flushing or warmth post-injection',
      'Injection-site reactions',
      'Headache or lightheadedness in some users',
      'When paired with a GHRP, water retention and glucose drift apply',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'Sermorelin is a synthetic fragment of natural GHRH (growth hormone releasing hormone) — specifically, the first 29 amino acids, which is the part that actually does the signaling. Like Tesamorelin and CJC-1295, it tells your pituitary to release its own growth hormone in normal pulses rather than injecting GH directly. Sermorelin has the shortest half-life of the GHRH peptides (around 10–20 minutes), which gives a very clean pulse that mimics youthful GH release. Has been used clinically since the 1990s for pediatric GH deficiency.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Some sources allow short-term room temperature storage for the lyophilized powder, but refrigeration is safer.',
        afterMixing:
          'Refrigerate. Use within 30 days. Sermorelin degrades faster than longer-acting GHRH peptides; some researchers freeze pre-drawn syringes for stability.',
        handling: "Keep away from light. Don't shake.",
      },
    },
  },

  tesamor: {
    benefits:
      'Stabilized GHRH analog (Egrifta®). FDA-approved for HIV-associated lipodystrophy. Long-term elevation of GH/IGF-1 with established trial safety data.',
    beginnerProtocol:
      'Label dose: 2 mg SubQ once daily. Clinical titration: 1–2 mg/day. Some research protocols use 5-on/2-off scheduling for extended cycles beyond 8 weeks.',
    cycleTemplate: {
      duration_weeks: 26,
      phase_notes: 'Approved label supports 6+ month continuous dosing. Research contexts sometimes use 5-on/2-off after week 8 for receptor preservation.',
      schedule: '2 mg SubQ daily for 8 weeks, then optionally 5-on/2-off for weeks 9+. Long-term; evaluate IGF-1 periodically.',
      phases: [
        { name: 'Daily', weeks: 8, dose_modifier: '2 mg SubQ once daily' },
        { name: 'Maintenance (5-on / 2-off)', weeks: 18, dose_modifier: '2 mg SubQ, 5 days on + 2 days off' },
      ],
    },
    timing: 'Evening dosing in the label.',
    coAdministration: [
      { peptide_id: 'ipamor', note: 'GHRH + GHRP pairing (off-label context).' },
    ],
    stackConflicts: [
      { peptide_id: 'cjc_nodac', reason: 'Redundant GHRH.' },
      { peptide_id: 'cjc_dac', reason: 'Redundant GHRH.' },
      { peptide_id: 'sermor', reason: 'Redundant GHRH.' },
    ],
    sideEffects: [
      'Injection-site reactions (most common label finding)',
      'Arthralgia (joint pain), peripheral edema, paresthesias',
      'Elevated fasting glucose / IGF-1; periodic monitoring is required per label',
      'Hypersensitivity reactions including rash and pruritus',
    ],
    contraindications: [
      'Active malignancy (FDA label contraindication)',
      'Pregnancy (label category)',
      'Hypersensitivity to tesamorelin or mannitol',
    ],
    overview: {
      whatItDoes:
        "Tesamorelin is a synthetic version of GHRH (growth hormone releasing hormone), the natural signal your brain sends to release growth hormone. Instead of injecting growth hormone directly, Tesamorelin tells your body to make its own — in normal pulses, like a healthy younger person produces. It's the only GHRH peptide that's FDA-approved (under the brand Egrifta), specifically for reducing visceral fat in HIV patients. Off-label research focuses on its effects on body composition, sleep quality, and cognitive function. Strong human clinical data for visceral fat loss (5–15% reduction over 6 months in studies).",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Do not freeze the lyophilized powder.',
        afterMixing:
          'Refrigerate. Use within 7 days with sterile water, up to 28 days with bacteriostatic water (per FDA labeling).',
        handling:
          "Keep away from light. Don't shake — swirl gently. The solution should be clear after mixing.",
      },
    },
  },

  hexar: {
    benefits:
      'Potent GHRP; reports strongest GH release among classical GHRPs, but prolactin/cortisol side-effects and receptor desensitization are more pronounced.',
    beginnerProtocol:
      'Research protocols: 100 mcg per dose, 1–2× daily. Short cycles (<6 weeks) to avoid desensitization.',
    cycleTemplate: {
      duration_weeks: 4,
      phase_notes: 'Short cycle (4–6 weeks) with long wash-out (≥4 weeks) due to desensitization.',
      schedule: '100 mcg SubQ twice daily (AM + pre-bed) for 4 weeks.',
    },
    timing: 'AM and pre-bed, empty stomach.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs — desensitization risk.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin-receptor stimulation.' },
    ],
    sideEffects: [
      'Marked prolactin and cortisol elevation (more than other GHRPs)',
      'Fast receptor desensitization on continuous dosing',
      'Strong head-rush and flushing post-injection',
      'Water retention; mild glucose drift',
    ],
    contraindications: [
      'Active malignancy',
      'Hyperprolactinemia or prolactin-sensitive conditions',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        'Hexarelin is one of the more powerful synthetic GH-releasers — it produces a stronger pulse of growth hormone than Ipamorelin or GHRP-6, but with more side effects and a tendency to cause "tachyphylaxis" (your body becomes desensitized over time). For this reason it\'s typically used in short cycles rather than long-term protocols. There\'s also research interest in its cardioprotective effects (it may help heart tissue recover after damage), independent of its GH-releasing function. Mostly preclinical with limited human data.',
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  ghrp2: {
    benefits:
      'Classic hexapeptide GH secretagogue. Strong GH pulse; modest prolactin/cortisol bumps; increases appetite somewhat.',
    beginnerProtocol:
      'Research protocols: 100 mcg per pulse, 2–3× daily.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Cycle 8 weeks, 4 weeks off, to preserve sensitivity.',
      schedule: '100 mcg SubQ 3× daily (AM + post-workout + pre-bed) for 8 weeks.',
    },
    timing: 'Empty stomach; pre-bed + AM + post-workout pattern common.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'ghrp6', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin agonism.' },
    ],
    sideEffects: [
      'Modest prolactin and cortisol elevation',
      'Hunger spike (less than GHRP-6 but noticeable)',
      'Flushing, mild head-rush after injection',
      'Water retention on chronic dosing',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        "GHRP-2 is a synthetic ghrelin mimetic similar to GHRP-6 — it tells your pituitary to release growth hormone and stimulates appetite, though typically with less hunger and less cortisol elevation than GHRP-6. Among the GHRP family, GHRP-2 produces the strongest GH pulse but isn't as \"clean\" as Ipamorelin, which selectively triggers GH without affecting other hormones. Often paired with a GHRH peptide like CJC-1295 (no DAC) for synergistic effect. Mostly preclinical research with limited human data.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  ghrp6: {
    benefits:
      'Hexapeptide GH secretagogue with strong appetite-stimulating side effect (popular in bulking research contexts). Less selective than Ipamorelin.',
    beginnerProtocol:
      'Research protocols: 100 mcg per pulse, 2–3× daily.',
    cycleTemplate: {
      duration_weeks: 8,
      phase_notes: 'Cycle 8 weeks, 4 weeks off.',
      schedule: '100 mcg SubQ 3× daily, empty stomach, for 8 weeks.',
    },
    timing: 'Empty stomach. Pre-workout + pre-bed common if appetite stimulation is desired.',
    coAdministration: [
      { peptide_id: 'cjc_nodac', note: 'GHRP + GHRH pairing.' },
    ],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'ghrp2', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'hexar', reason: 'Multiple GHRPs — desensitization.' },
      { peptide_id: 'mk677', reason: 'Compounding ghrelin agonism.' },
    ],
    sideEffects: [
      'Pronounced hunger / appetite spike (the defining side effect)',
      'Flushing, head-rush after injection',
      'Mild prolactin and cortisol elevation',
      'Water retention; mild glucose drift',
    ],
    contraindications: [
      'Active malignancy',
      'Pregnancy and breastfeeding',
      'Eating-disorder history (appetite signal can be disruptive)',
    ],
    overview: {
      whatItDoes:
        "GHRP-6 was one of the first synthetic ghrelin mimetics — it triggers growth hormone release while also dramatically increasing hunger (ghrelin is the \"hunger hormone\"). Effective at boosting GH but the appetite stimulation is the most prominent feature for most users, which is why it's largely been replaced by selective options like Ipamorelin in newer protocols. Still used in research contexts where increased appetite is desired (e.g., recovery from illness, underweight individuals). Some preclinical evidence for tissue-protective effects beyond GH release.",
      storage: {
        beforeMixing:
          'Refrigerate at 36–46°F (2–8°C). Stable up to 2 years frozen.',
        afterMixing: 'Refrigerate. Use within 30 days.',
        handling: 'Keep away from light. Swirl gently to dissolve.',
      },
    },
  },

  mk677: {
    benefits:
      'Oral ghrelin-receptor agonist (non-peptide). Produces sustained 24-hour GH/IGF-1 elevation. Research on lean body mass, sleep, appetite; long-term insulin-sensitivity changes reported.',
    beginnerProtocol:
      'Research protocols: 10–25 mg PO once daily.',
    cycleTemplate: {
      duration_weeks: 12,
      phase_notes: 'Long cycles. Monitor appetite, water retention, fasting glucose.',
      schedule: '25 mg PO once daily (evening), for 12 weeks, then 4-week break.',
    },
    timing: 'Evening dosing — reported to improve subjective sleep quality.',
    coAdministration: [],
    stackConflicts: [
      { peptide_id: 'ipamor', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'ghrp2', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'ghrp6', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'hexar', reason: 'Compounding ghrelin-receptor stimulation.' },
      { peptide_id: 'cjc_dac', reason: 'Both produce constant GH elevation — over-stimulation.' },
    ],
    sideEffects: [
      'Sustained appetite increase, weight gain partly from food intake',
      'Notable water retention; puffy face, hands, ankles',
      'Fatigue or lethargy in the morning at higher doses',
      'Fasting glucose elevation; insulin sensitivity drift on long cycles',
      'Vivid dreams and altered sleep architecture',
    ],
    contraindications: [
      'Active malignancy',
      'Congestive heart failure or fluid-overload conditions',
      'Pre-diabetes / poorly controlled diabetes',
      'Pregnancy and breastfeeding',
    ],
    overview: {
      whatItDoes:
        "MK-677 (also called Ibutamoren) isn't a peptide — it's a small molecule that mimics ghrelin, the hormone that signals hunger and triggers growth hormone release. Unlike injectable GHRHs, it's orally active and lasts about 24 hours per dose. It increases growth hormone and IGF-1 levels meaningfully — roughly comparable to what younger people produce naturally. It's the most convenient way to access GH-releasing effects (no injections), but it's also more aggressive: the constant elevation of IGF-1 raises long-term safety questions.",
      storage: {
        beforeMixing:
          'Most often supplied as capsules or liquid — store at room temperature in a cool, dry place. Away from light and humidity.',
        afterMixing:
          'Liquid preparations: follow product-specific storage instructions; once opened, most are stable several months at room temperature.',
        handling:
          'If supplied as a powder: store sealed in a cool dry place; some users refrigerate.',
      },
    },
  },
};
