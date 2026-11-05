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
        H('What it does') + P('The switch filters every chart and table on the dashboard by the ward where the specimen was collected.') +
        H('The three options') + L([
            '<b>All units:</b> every ward, including outpatients.',
            '<b>ICU:</b> only the wards counted as intensive care units. The list is set on the Dashboard Control page.',
            '<b>Non-ICU:</b> all other wards, including outpatients and neonatal units.']) +
        H('Why ICU is shown separately') + P('Antimicrobial use, invasive devices and patient risk differ between intensive care and other wards, so a pooled result can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.') +
        H('Method') + P('The first isolate per patient and organism is chosen across all wards first, and the ward filter is applied afterwards.'));

    // ---------------------------------------------------------------- analytics
    add('sec_prevalence', 'Organism prevalence',
        H('What it shows') + P('The share of first isolates contributed by each organism, for the selected period, specimen and ward filter.') +
        H('How to read it') + L(['Each slice is one organism; a larger slice means a more frequent organism.', 'Tap a slice to open that organism\'s susceptibility profile below.']) +
        H('Method') + L(['One isolate per patient and organism within the selected period (CLSI M39).', 'Screening cultures are excluded.']));
    add('sec_patho', 'Susceptibility profile of one organism',
        H('What it shows') + P('For the selected organism, the percentage of tested isolates that are susceptible (S), intermediate (I) or resistant (R) to each antibiotic.') +
        H('How to read it') + L(['Choose the metric (%S, %R or %NS) with the buttons above the chart.', 'A solid bar is reliable (30 or more isolates tested). A faded grey bar, marked with *, has fewer than 30 isolates.', 'A dagger (&dagger;) marks an antibiotic tested on fewer than half of the isolates (selective testing).']) +
        H('Method') + L(['Results are interpreted with CLSI M100 breakpoints.', '%S counts only S; I and SDD are not included.', 'One isolate per patient and organism within the period (CLSI M39).']));
    add('sec_abx', 'Activity of one antibiotic',
        H('What it shows') + P('For the selected antibiotic, the percentage of isolates of each organism that are susceptible, intermediate or resistant.') +
        H('How to read it') + L(['Each bar is one organism; compare organisms for the same drug.', 'A faded grey bar, marked with *, has fewer than 30 tested isolates and should be interpreted with caution (CLSI M39).']) +
        H('Method') + L(['Interpretation follows CLSI M100.', 'One isolate per patient and organism within the period.']));
    add('sec_heatmap', 'Organism by antibiotic heatmap',
        H('What it shows') + P('One table showing many organisms and antibiotics together. Each cell is the percentage of the chosen category (S, I or R) for one organism and one antibiotic.') +
        H('How to read it') + L(['Green is the favourable end (a low %R or %NS, or a high %S) and red the unfavourable end. The colour key under the table shows the ranges.', 'A cell marked with * is based on fewer than 30 tested isolates.']) +
        H('Method') + L(['Isolates are de-duplicated (CLSI M39) and interpreted with CLSI M100.']));
    add('sec_watch', 'Threat watchlist',
        H('What it shows') + P('The occurrence and resistance pattern of one pathogen chosen for special monitoring (set on the Dashboard Control page), among the first isolates of the selected period.') +
        H('How to read it') + L(['The card appears when the organism is detected.', 'When it is not detected, a short line confirms that none was found.']));

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
        H('How to read it') + L(['<b>MDR+</b> = MDR, XDR or PDR.', '<b>*</b> = fewer than 30 isolates: interpret with caution (CLSI M39).', '<b>Poss.</b> = isolates tested against too few categories to confirm XDR or PDR. They are shown for information and are not included in the XDR+ or PDR columns.']));

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
        H('Why it matters') + P('Contamination is growth that does not represent a true bloodstream infection. The commonly used benchmark is <b>3% or less</b> of blood cultures (CLSI M47; ASM practice guideline).') +
        H('The three figures') + L([
            '<b>Reported as contaminated:</b> cultures the laboratory itself recorded as contaminated. This figure is certain.',
            '<b>Possible skin-flora growth:</b> blood cultures that grew organisms usually found on skin (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci and similar). These organisms can also cause real infection, so they are labelled <i>possible</i> and are not counted as contaminated.',
            '<b>Possible contamination, upper estimate:</b> reported contaminated plus possible skin-flora growth, divided by all blood cultures.']) +
        H('How to read it') + P('The true rate lies between the reported figure and the upper estimate. A single result cannot be classified without knowing how many blood-culture sets were positive and the clinical picture, which are not recorded.'));

    // ---------------------------------------------------------------- Last Year
    add('ya_ind', 'Key resistance indicators',
        H('What it shows') + P('Resistance proportions for the priority indicators of WHO GLASS and the WHO Bacterial Priority Pathogens List, for the selected calendar year, compared with the year before.') +
        H('How to read it') + L(['<b>R / tested:</b> resistant isolates over isolates with a usable result.', '<b>% R:</b> the percentage resistant, with its 95% confidence interval below it.', '<b>* (grey):</b> fewer than 30 tested; interpret with caution.', '<b>Change:</b> the difference from the previous year in percentage points. <b>ns</b> means not statistically significant.', '<b>Unconfirmed:</b> S. aureus isolates with a vancomycin MIC of 16 or more that still await reference-laboratory confirmation. They are not counted as VRSA.']) +
        H('Method') + L(['First isolate per patient and organism within the year (CLSI M39).', 'Intrinsic and untested results are not counted as resistant.', 'The confidence interval is the Wilson 95% interval.', 'A change is called significant only when both years have 30 or more tested isolates and a two-proportion z-test gives p below 0.05.']),
        ['WHO_GLASS', 'WHO_BPPL', 'CLSI_M39', 'CLSI_M100']);
    add('ya_icu', 'ICU compared with non-ICU',
        H('What it shows') + P('The priority resistance indicators and the susceptibility of the main organisms in intensive care units, next to all other wards, for the selected calendar year.') +
        H('How to read it') + L(['<b>Cells:</b> resistant (or susceptible) / tested, with the percentage below.', '<b>Difference:</b> ICU minus non-ICU in percentage points. A significant difference is marked <b>differs *</b> (two-proportion z-test, p &lt; 0.05), and only when both groups have at least 30 tested isolates. Otherwise the difference is descriptive only.', 'A negative difference in susceptibility means the ICU has lower susceptibility.']) +
        H('Method') + L(['The first isolate per patient, organism and year is chosen across all wards, and the unit split is applied afterwards, so a patient who moves between wards is not counted twice (CLSI M39).', 'The wards counted as ICU are set by the surveillance team.']),
        ['CLSI_M39', 'CLSI_M100']);
    add('ya_cum', 'Cumulative antibiogram',
        H('What it shows') + P('The percentage of first isolates that are susceptible to each antibiotic, for each organism, over one calendar year. It is the report clinicians use to choose empirical therapy.') +
        H('How to read it') + L(['Each row is an organism; each column is an antibiotic. The cell is the % susceptible.', 'Colours: green 90% or more, yellow 70 to 89%, orange 50 to 69%, red below 50%.', 'A dash means the combination was tested on fewer than 30 isolates, so no value is reported.', '<b>&dagger;</b> = selective test: tested on fewer than half of the isolates, so the percentage may be biased.']) +
        H('Rules applied (CLSI M39)') + L(['One isolate per patient and organism per year; screening cultures are excluded.', 'Only susceptible (S) counts as susceptible. I and SDD do not.', 'A value is reported only when 30 or more isolates were tested.', 'Specimens can be viewed separately because a blood isolate and a urine isolate of the same organism may behave differently.']) +
        H('Possible contaminants') + P('The switch excludes skin-flora organisms from blood (for example <i>S. hominis</i>). They are usually contaminants and can distort the antibiogram. The note under the table says how many were excluded.'),
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
        H('How to read it') + L(['<b>Any</b> = MDR + XDR + PDR.', '<b>Possible</b> = isolates that look XDR on the tested categories but had too narrow a panel to confirm.', '<b>*</b> = fewer than 30 isolates.']) +
        H('Method') + L(['Definitions follow Magiorakos et al., 2012.', 'Intrinsic resistance is excluded.', 'A category that was not tested is unknown, not susceptible, so XDR and PDR counts are conservative.']),
        ['MAGIORAKOS', 'CLSI_M100']);
    add('ya_cult', 'Culture burden',
        H('What it shows') + P('The monthly number of cultures received, the share with growth, without growth and reported as contaminated, and the contamination rate of blood cultures.') +
        H('How to read it') + L(['The blood culture contamination benchmark is 3% or less (CLSI M47).', 'A month far below the others usually points to an incomplete file rather than a real drop.']) +
        H('Data source') + P('Aggregate laboratory counts collected from the monthly WHONET files. No patient data are involved.'),
        ['CLSI_M47', 'WHONET']);
    add('ya_qual', 'Data quality',
        H('What it shows') + P('How complete the data behind this report are: the identifiers needed for de-duplication, the ward and specimen fields, and the share of isolates tested for the agents the indicators depend on.') +
        H('Why it matters') + P('Surveillance estimates are only as reliable as the completeness and representativeness of the underlying data (WHO GLASS; CLSI M39).'),
        ['WHO_GLASS', 'CLSI_M39']);

    // ---------------------------------------------------------------- Last Month
    add('op_m_alerts', 'Priority alerts',
        H('What it shows') + P('First isolates of the month that need prompt attention.') +
        H('What triggers an alert') + L(['<b>CRE, CRAB, CRPA:</b> carbapenem-resistant Enterobacterales, <i>A. baumannii</i> and <i>P. aeruginosa</i>.', '<b>VRE, VRSA:</b> vancomycin-resistant enterococci and <i>S. aureus</i>, including unconfirmed candidates.', '<b><i>Candida auris</i>.</b>', '<b>XDR and PDR</b> isolates.']) +
        H('Why') + P('These are WHO priority resistance types and the organisms most often linked to outbreaks. Each should prompt a review of infection-control measures. A VRSA candidate needs confirmation by a reference laboratory.'),
        ['WHO_BPPL', 'CLSI_M100']);
    add('op_m_clusters', 'Possible clusters',
        H('What it shows') + P('A ward where three or more different patients had the same organism with the same resistance type within 14 days.') +
        H('Resistance types checked') + P('CRE, CRAB, CRPA, MRSA, VRE, VRSA, and XDR or PDR.') +
        H('How to read it') + L(['This is a screening signal built from first isolates. It cannot prove transmission.', 'Review the cases with the infection control team and use typing where available.']),
        ['WHO_GLASS']);
    add('op_m_compare', 'Comparison with earlier periods',
        H('What it shows') + P('The same indicators for this month, the previous month and the same month last year. The last column helps separate real change from seasonal effects.') +
        H('How to read it') + L(['Each cell shows resistant / tested, with the percentage below it.', 'A single month rarely reaches 30 tested isolates, so no trend is claimed from one month.', 'Use the Last Quarter and Last Year tabs to judge trends.']),
        ['CLSI_M39', 'WHO_GLASS']);
    add('op_m_bloodq', 'Possible blood contaminants',
        H('What it shows') + P('The share of blood isolates that are organisms usually found on skin (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i> and similar). A high share suggests a problem in blood collection.') +
        H('Cautions') + P('The CLSI M47 benchmark (3% or less) is defined per blood culture collected, not per isolate. The Cultures tab gives the proper rate.'),
        ['CLSI_M47']);

    // ---------------------------------------------------------------- Last Quarter
    add('op_q_run', 'Trend over the last 8 quarters',
        H('What it shows') + P('The percentage of resistant first isolates for the priority indicators over the eight quarters ending at the selected one.') +
        H('How to read it') + L(['A hollow point and a dashed line mean fewer than 30 isolates were tested.', 'Tap a point to see the counts and the 95% Wilson confidence interval.', 'Follow a change over several quarters rather than a single point.']),
        ['WHO_GLASS', 'CLSI_M39']);
    add('op_q_icu', 'ICU compared with non-ICU',
        H('What it shows') + P('The priority indicators in intensive care units compared with all other wards, for the selected quarter.') +
        H('How to read it') + L(['ICUs usually have higher resistance; the last column marks a statistically significant difference.', 'Which wards count as ICU is set on the Dashboard Control page.']) +
        H('Method') + P('The first isolate per patient and organism is chosen across the whole hospital before the split, as CLSI M39 requires.'),
        ['CLSI_M39']);
    add('op_q_wards', 'Ward ranking',
        H('What it shows') + P('Wards ranked by the number of first isolates classified as MDR, XDR or PDR (Magiorakos 2012). It shows where the resistant burden sits, to focus stewardship and infection control.') +
        H('Cautions') + L(['Counts depend on how many cultures each ward sends.', 'Percentages based on fewer than 10 isolates should not be compared.']),
        ['MAGIORAKOS', 'WHO_GLASS']);

    return o;
})();
