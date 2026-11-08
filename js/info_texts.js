// =====================================================================
// Reviewed texts for the (i) information pop-ups.
// setInfo() (dashboard.js) uses these in place of the inline drafts, so every pop-up has
// the same structure: what it shows, how to read it, the method, and the cautions.
// =====================================================================
const INFO_OVERRIDE = (function () {
    const H = t => `<h5>${t}</h5>`;
    const P = t => `<p>${t}</p>`;
    const L = items => '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    const o = {};
    const add = (key, title, html, refs) => { o[key] = { title, html, refs }; };

    // ---------------------------------------------------------------- shared
    add('scope', 'Unit scope',
        H('What it does') + P('The buttons at the top of the page filter every chart and table on the dashboard by the ward where the specimen was collected.') +
        H('The four options') + L([
            '<b>ALL:</b> every ward.',
            '<b>ICU:</b> only the wards counted as intensive care units. The list is set on the Dashboard Control page.',
            '<b>Non-ICU IP:</b> inpatient wards that are not ICU. IP means inpatient; emergency is not inpatient.',
            '<b>Outpatient:</b> everything that is not inpatient, including outpatient clinics and emergency.']) +
        H('Why ICU is shown separately') + P('Antimicrobial use, invasive devices and patient risk differ between intensive care and other wards, so a pooled result can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.') +
        H('Method') + P('The first isolate per patient and organism is chosen across all wards first, and the ward filter is applied afterwards.'));

    // ---------------------------------------------------------------- analytics
    add('sec_prevalence', 'Organism prevalence',
        H('What it shows') + P('The share of first isolates contributed by each organism, for the selected period, specimen and unit filter.') +
        H('How to read it') + L(['Each slice is one organism; a larger slice means a more frequent organism.', 'Tap a slice to open that organism\'s susceptibility profile below.']) +
        H('Method') + L(['One isolate per patient and organism within the selected period (CLSI M39).', 'Screening cultures are excluded.']));
    add('sec_patho', 'Susceptibility profile of one organism',
        H('What it shows') + P('For the selected organism, the percentage of tested isolates that are susceptible (S), intermediate (I) or resistant (R) to each antibiotic.') +
        H('How to read it') + L(['Choose the metric (%S, %R or %NS) with the buttons above the chart.', 'A solid bar is reliable (30 or more isolates tested). A faded grey bar, marked with *, has fewer than 30 isolates.', 'A dagger (&dagger;) marks an antibiotic tested on fewer than 90% of the isolates (selective testing).']) +
        H('Method') + L(['Results are interpreted with CLSI M100 breakpoints.', '%S counts only S; I and SDD are not included.', 'One isolate per patient and organism within the period (CLSI M39).']));
    add('sec_abx', 'Activity of one antibiotic',
        H('What it shows') + P('For the selected antibiotic, the percentage of isolates of each organism that are susceptible, intermediate or resistant.') +
        H('How to read it') + L(['Each bar is one organism; compare organisms for the same drug.', 'A faded grey bar, marked with *, has fewer than 30 tested isolates and should be interpreted with caution (CLSI M39).']) +
        H('Method') + L(['Interpretation follows CLSI M100.', 'One isolate per patient and organism within the period.']));
    add('sec_heatmap', 'Organism by antibiotic heatmap',
        H('What it shows') + P('One table showing many organisms and antibiotics together. Each cell is the percentage of the chosen category (S, I or R) for one organism and one antibiotic.') +
        H('How to read it') + L(['The colours follow the same three bands as the antibiogram: green = 80% or more susceptible (20% or less resistant), amber = 50-79% susceptible, red = below 50% susceptible. They are a display convention, not a CLSI or WHO category and not a treatment guide.', 'The colour key under the table shows the ranges for the metric you chose.', 'A cell marked with * is based on fewer than 30 tested isolates.']) +
        H('Method') + L(['Isolates are de-duplicated (CLSI M39) and interpreted with CLSI M100.']));

    // ---------------------------------------------------------------- MDR
    add('mdr_tiles', 'Summary figures',
        H('What it shows') + L([
            '<b>Classified isolates:</b> first isolates that could be assigned a class (Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>).',
            '<b>MDR or worse:</b> MDR, XDR and PDR combined.',
            '<b>XDR or worse:</b> XDR and PDR combined.']) +
        H('Method') + P('Percentages are of the classified isolates in the selected period and unit scope.'));
    add('mdr_trend', 'Monthly trend',
        H('What it shows') + P('The share of classified isolates in each class (MDR, XDR, PDR) for every month, stacked.') +
        H('How to read it') + P('Months with few isolates vary widely. Read the direction over several months rather than a single bar.'));
    add('mdr_wards', 'Distribution by ward',
        H('What it shows') + P('Classified first isolates per ward, divided by class. The number in brackets is the total classified isolates of that ward.') +
        H('How to read it') + L(['Wards are ordered by the number of MDR-or-worse isolates.', 'A patient who moves between wards is counted once, in the ward of the first isolate, because de-duplication covers the whole period.']));
    add('mdr_group', 'By organism group',
        H('What it shows') + P('MDR, XDR and PDR counts for each organism group.') +
        H('How to read it') + L(['<b>MDR+</b> = MDR, XDR or PDR.', '<b>*</b> = fewer than 30 isolates: interpret with caution (CLSI M39).', '<b>Poss.</b> = possible XDR / PDR (Magiorakos 2012): the isolate is MDR, fewer than 3 susceptible categories were found, and the untested categories could still make it XDR (or PDR). They are counted as MDR, shown for information, and not included in the XDR+ or PDR columns.']));

    // ---------------------------------------------------------------- culture overview
    add('lab_def', 'About the Culture Overview',
        H('What it shows') + P('Culture activity of the laboratory: how many cultures were received and what they grew. It describes laboratory workload and quality, not individual patients.') +
        H('Definitions') + L(['A <b>culture</b> is one patient, one date and one specimen type. Several organisms from the same specimen count once.', '<b>Positive:</b> an organism was reported.', '<b>No growth:</b> no organism was reported.', '<b>Contaminated:</b> reported as contaminated by the laboratory.']) +
        H('Data source') + L(['Counts come from the monthly WHONET export. Only aggregate counts are stored, with no patient rows.', 'Screening cultures are included here. They are excluded only from the resistance statistics.']));
    add('lab_tiles', 'Cultures received',
        H('What it shows') + L(['<b>Cultures:</b> all cultures in the period and unit scope.', '<b>Positive, No growth and Contaminated:</b> shares of that total. They add up to 100%.']) +
        H('How to read it') + P('Positivity depends on the specimen mix and on sampling practice. For example, many screening or follow-up cultures lower it. Compare like with like: the same ward or specimen type over time.'));
    add('lab_volume', 'Culture volume per month',
        H('What it shows') + P('The number of cultures received each month, divided by result. Volume reflects workload and sampling practice.') +
        H('Volume notes') + L(['A note appears when a month is below half, or above 1.6 times, the average of the selected months.', 'A low month usually means an incomplete data file. A high month may reflect an outbreak work-up or a screening campaign.', 'Notes are prompts to check, not conclusions.']));
    add('lab_wards', 'Positivity by ward',
        H('What it shows') + P('The share of cultures with growth in each ward. The number in brackets is the ward total.') +
        H('How to read it') + L(['A grey bar means fewer than 30 cultures: interpret with caution.', 'Differences between wards partly reflect case mix and how often cultures are taken.']));
    add('lab_sample', 'By specimen type',
        H('What it shows') + P('For each specimen type: the number of cultures and the share that were positive, had no growth, or were reported as contaminated, in the selected period and unit scope.'));
    add('lab_blood', 'Blood cultures: contamination indicators',
        H('Why it matters') + P('Contamination is growth that does not represent a true bloodstream infection. The acceptable range is typically <b>3% or less</b> of blood cultures (CLSI M47-A, Section 5.6; CDC). Even with the best collection protocols it may not be possible to go below 2% (M47-A, Section 8). The 3% limit is traditional and its supporting data are described as controversial (ASM review).') +
        H('How the rate is calculated') + P('Contaminated blood cultures divided by <b>all blood cultures received</b>, including those without growth (CDC definition). A different measure, the share of contaminated cultures among <i>positive</i> cultures, is called the false-positive rate and gives a much higher figure; it must not be compared with the 3% limit.') +
        H('The three figures') + L([
            '<b>Reported as contaminated:</b> cultures the laboratory itself recorded as contaminated. This figure is certain.',
            '<b>Possible skin-flora growth:</b> blood cultures that grew organisms usually found on skin (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci and similar). These organisms can also cause real infection, so they are labelled <i>possible</i> and are not counted as contaminated.',
            '<b>Possible contamination, upper estimate:</b> reported contaminated plus possible skin-flora growth, divided by all blood cultures.']) +
        H('How to read it') + P('The true rate lies between the reported figure and the upper estimate. A single result cannot be classified without knowing how many blood-culture sets were positive and the clinical picture, which are not recorded.'));

    // ---------------------------------------------------------------- Last Year
    add('ya_ind', 'Key resistance indicators',
        H('What it shows') + P('Resistance proportions for the priority indicators of WHO GLASS and the WHO Bacterial Priority Pathogens List, for the selected analysis period (the latest 12 months or a calendar year), compared with the period before.') +
        H('How to read it') + L(['<b>R / tested:</b> resistant isolates over isolates with a usable result.', '<b>% R:</b> the percentage resistant, with its 95% confidence interval below it.', '<b>* (grey):</b> fewer than 30 tested; interpret with caution.', '<b>Change:</b> the difference from the previous year in percentage points. <b>ns</b> means not statistically significant.', '<b>Unconfirmed:</b> S. aureus isolates with a vancomycin MIC of 16 or more that still await reference-laboratory confirmation. They are not counted as VRSA.']) +
        H('Where the indicators come from') + L(['<b>3GC-R, CRE, CRAB, CRPA, MRSA:</b> resistance types of the WHO Bacterial Priority Pathogens List 2024 (critical: carbapenem-resistant <i>A. baumannii</i> and Enterobacterales, third-generation cephalosporin-resistant Enterobacterales; high: carbapenem-resistant <i>P. aeruginosa</i>, MRSA).', '<b>VRE:</b> the list names vancomycin-resistant <i>E. faecium</i> only. The indicator here covers all <i>Enterococcus</i>.', '<b>VRSA:</b> not on the list (WHO removed it in 2024). It is shown because CLSI M100 Appendix A lists it for confirmation.', '<b>ESBL and CPE:</b> laboratory confirmation flags from the WHONET file.']) +
        H('Method') + L(['First isolate per patient and organism within the year (CLSI M39).', 'Intrinsic and untested results are not counted as resistant.', 'The confidence interval is the Wilson 95% interval.', 'A change is called significant only when both years have 30 or more tested isolates and a two-proportion z-test gives p below 0.05.']),
        ['WHO_GLASS', 'WHO_BPPL', 'CLSI_M39', 'CLSI_M100']);
    add('ya_icu', 'ICU compared with non-ICU',
        H('What it shows') + P('The priority resistance indicators and the susceptibility of the main organisms in intensive care units, next to all other wards, for the selected analysis period.') +
        H('How to read it') + L(['<b>Cells:</b> resistant (or susceptible) / tested, with the percentage below.', '<b>Difference:</b> ICU minus non-ICU in percentage points. A significant difference is marked <b>differs *</b> (two-proportion z-test, p &lt; 0.05), and only when both groups have at least 30 tested isolates. Otherwise the difference is descriptive only.', 'A negative difference in susceptibility means the ICU has lower susceptibility.']) +
        H('Method') + L(['The first isolate per patient and organism is chosen (per 12-month block for patients linked across years in the importer, otherwise per calendar year) across all wards, and the unit split is applied afterwards, so a patient who moves between wards is not counted twice (CLSI M39).', 'The wards counted as ICU are set by the surveillance team.']),
        ['CLSI_M39', 'CLSI_M100']);
    add('ya_cum', 'Cumulative antibiogram',
        H('What it shows') + P('The percentage of first isolates that are susceptible to each antibiotic, for each organism, over the selected analysis period of one year. It is the report clinicians use to choose empirical therapy.') +
        H('How to read it') + L(['Each row is an organism; each column is an antibiotic. The cell is the % susceptible.', 'Colours are an application convention, not a WHO reference and not a treatment guide: green 80% or more, amber 50-79%, red below 50%. The 80% level reflects common practice for empirical use in non-severe infection; a higher local threshold applies to severe infection. WHO does not provide a reference for these colours.', 'A dash means the combination was tested on fewer than 30 isolates, so no value is reported.', '<b>&dagger;</b> = selective test: tested on fewer than 90% of the isolates, so the percentage may be biased.']) +
        H('Rules applied (CLSI M39)') + L(['One isolate per patient and organism per year; screening cultures are excluded.', 'Only susceptible (S) counts as susceptible. I and SDD do not.', 'A value is reported only when 30 or more isolates were tested.', 'Specimens can be viewed separately because a blood isolate and a urine isolate of the same organism may behave differently.']) +
        H('Possible contaminants') + P('The Settings switch (Exclude possible skin-flora contaminants) excludes skin-flora organisms from blood (for example <i>S. hominis</i>). They are usually contaminants and can distort the antibiogram. The note under the table says how many were excluded.'),
        ['CLSI_M39', 'CLSI_M100']);
    add('ya_trend', 'Quarterly trend',
        H('What it shows') + P('Resistance of the priority indicators across the four quarters of the selected year.') +
        H('How to read it') + L(['Each first isolate of the year is counted once, in the quarter in which it appeared, so the quarters add up to the annual figure.', 'A hollow point and a dashed line mean fewer than 30 isolates were tested: indicative only.', 'Tap a point to see the counts and the 95% confidence interval.']));
    add('ya_abx', 'Antibiotic trend',
        H('What it shows') + P('The resistance (or susceptibility) of one chosen antibiotic over the years, or across the quarters of the selected year, for all organisms together or for single organisms.') +
        H('How to read it') + L(['Choose the antibiotic, the organism, the period (years or quarters) and the metric (%R or %S).', 'A hollow point and a dashed line mean fewer than 30 isolates were tested: indicative only.', 'Overlapping confidence intervals mean a change may be due to chance.']) +
        H('Method') + P('Each period uses first isolates per patient and organism (CLSI M39). Only organisms with 30 or more results over the whole period are listed.'),
        ['CLSI_M39', 'WHO_GLASS']);
    add('ya_mdr', 'MDR / XDR / PDR by organism group',
        H('What it shows') + P('Multidrug-resistant (MDR), extensively drug-resistant (XDR) and pandrug-resistant (PDR) first isolates among Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i>.') +
        H('How to read it') + L(['<b>Any</b> = MDR + XDR + PDR.', '<b>Possible</b> = possible XDR (Magiorakos 2012): the isolate is MDR, fewer than 3 susceptible categories were found, and the untested categories could still make it XDR. It is counted as MDR.', '<b>*</b> = fewer than 30 isolates.']) +
        H('Method') + L(['Definitions follow Magiorakos et al., 2012.', 'Intrinsic resistance is excluded.', 'A category that was not tested is unknown, not susceptible, so XDR and PDR counts are conservative.', 'Validity condition (Magiorakos 2012): the XDR and PDR definitions are valid only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With incomplete testing an isolate can only be called possible XDR or possible PDR, and such results should not be compared with confirmed XDR or PDR from other studies.']),
        ['MAGIORAKOS', 'CLSI_M100']);
    add('ya_cult', 'Culture burden',
        H('What it shows') + P('The monthly number of cultures received, the share with growth, without growth and reported as contaminated, and the contamination rate of blood cultures.') +
        H('How to read it') + L(['The acceptable range for blood culture contamination is typically 3% or less (CLSI M47-A, Section 5.6).', 'The rate is contaminated blood cultures divided by all blood cultures received (CDC definition).', 'A month far below the others usually points to an incomplete file rather than a real drop.']) +
        H('Data source') + P('Aggregate laboratory counts collected from the monthly WHONET files. No patient data are involved.'),
        ['CLSI_M47', 'CDC_BCC', 'ASM_BCC']);
    add('ya_qual', 'Data quality',
        H('What it shows') + P('How complete the data behind this report are: the identifiers needed for de-duplication, the ward and specimen fields, and the share of isolates tested for the agents the indicators depend on.') +
        H('Why it matters') + P('Surveillance estimates are only as reliable as the completeness and representativeness of the underlying data (WHO GLASS; CLSI M39).'),
        ['WHO_GLASS', 'CLSI_M39']);

    // ---------------------------------------------------------------- Monthly Alerts
    add('op_m_alerts', 'Priority alerts',
        H('What it shows') + P('Isolates of the latest month with a result that needs confirmation or reporting. All isolates of the month are checked, not only the first per patient.') +
        H('What triggers an alert') + L([
            '<b>CRE, CRAB, CRPA:</b> carbapenem-resistant Enterobacterales, <i>A. baumannii</i> and <i>P. aeruginosa</i> (CLSI M100 Appendix A lists any carbapenem result of I or R for confirmation).',
            '<b>VRE:</b> vancomycin-resistant <i>Enterococcus</i> (CLSI M100 Appendix A).',
            '<b>VRSA candidate, Vancomycin I (VISA):</b> <i>S. aureus</i> with a vancomycin MIC in the intermediate or resistant range (CLSI M100 Appendix A, with the footnote that these are rarely encountered). A candidate needs confirmation by a reference laboratory.',
            '<b>PDR, XDR:</b> pandrug-resistant and extensively drug-resistant isolates (Magiorakos 2012). The WHO emerging AMR framework asks for PDR and for XDR not previously detected in the country to be reported.',
            '<b>XDR + colistin-R:</b> Enterobacterales, <i>P. aeruginosa</i> or <i>Acinetobacter</i> that are XDR and colistin-resistant (WHO emerging AMR framework, Annex 1).',
            '<b>VRE + linezolid-R, daptomycin-NS or telavancin/dalbavancin/oritavancin-NS</b> (WHO Annex 1).',
            '<b><i>S. aureus</i> with linezolid-R, daptomycin-NS, tigecycline-NS or telavancin/dalbavancin/oritavancin-NS</b> (WHO Annex 1).',
            '<b><i>Candida auris</i>:</b> in the critical group of the WHO fungal priority pathogens list, which notes its high outbreak potential. The WHO emerging AMR component targets <i>C. auris</i> among fungi.']) +
        H('How to read it') + L([
            'A later isolate of the same patient with the same flags is marked <b>repeat</b>. Screening swabs are marked <b>screening</b>.',
            'A flag is a result to confirm and report, not a diagnosis of an outbreak. Linking cases needs epidemiological information that the laboratory file does not contain.',
            'Intrinsic resistance is never counted (CLSI M100 Appendix B).']) +
        H('Why all isolates') + P('A summary of first isolates can miss new resistance patterns, which should be looked for in the complete database (CLSI M39 Section 9.4).') +
        H('Where the lists are not the same') + L([
            'The WHO Bacterial Priority Pathogens List 2024 names carbapenem-resistant <i>A. baumannii</i> and Enterobacterales, carbapenem-resistant <i>P. aeruginosa</i>, MRSA and vancomycin-resistant <i>E. faecium</i>. It does not list VRSA: WHO removed vancomycin-intermediate and -resistant <i>S. aureus</i> in 2024. VRSA is flagged here because of CLSI M100 Appendix A.',
            'The Annex 1 list of WHO is an example list of critical phenotypes. It is applied here as written, for the organism groups the app can classify.']),
        ['CLSI_M100', 'CLSI_M39', 'WHO_EAR', 'WHO_FUNGAL', 'WHO_BPPL', 'MAGIORAKOS']);

    return o;
})();
