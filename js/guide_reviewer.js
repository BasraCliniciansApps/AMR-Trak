// =====================================================================
// Guide: "For reviewer" sections.
// A technical description of every rule and tool, with the source of each rule, for expert review
// (Ministry of Health, hospital management, antibiotic committee). Loaded before guide.js, which
// inserts these sections in front of "References".
// Page numbers are the PRINTED page numbers of the documents that were checked.
// =====================================================================
(function () {
    const H = t => `<h4>${t}</h4>`;
    const P = t => (typeof splitHints === 'function' && splitHints(t).length > 1) ? hintsHtml([t]) : `<p>${t}</p>`;
    const L = items => '<ul>' + [].concat.apply([], items.map(i => typeof splitHints === 'function' ? splitHints(i) : [i])).map(i => `<li>${i}</li>`).join('') + '</ul>';
    const T = (head, rows) => `<div class="gd-tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const TIP = t => `<div class="gd-tip">${t}</div>`;

    // Evidence status codes used in the tables
    const V = '<b>V</b>', W = '<b>W</b>', C = '<b>C</b>', A = '<b>A</b>';

    const RV = [
        // ------------------------------------------------------------------ 0
        ['rv_scope', 'For reviewer: scope, sources and evidence map', () =>
            P('This part of the guide describes, for technical review, how each result in the dashboard is produced: the input data, the rule applied, the document on which the rule is based, the reason for adopting it, and the points at which the application departs from, or goes beyond, the source document. It is written so that each statement can be checked against the cited source.') +
            H('1. Purpose and intended use') + L([
                'The application supports <b>epidemiological surveillance of antimicrobial resistance</b> in one hospital (Al-Mawani Teaching Hospital, Basra) and the preparation of the cumulative antibiogram used to guide <b>empirical</b> therapy.',
                'It describes <b>populations of isolates</b>. It does not interpret an individual patient\'s culture and does not replace the laboratory report or clinical judgement.',
                'It does not re-interpret MIC or zone-diameter values. The interpretive category (S, SDD, I, R) is the one assigned by the laboratory under CLSI M100 and exported by WHONET, with the single exception described in section 2 (staphylococcal vancomycin).']) +
            H('2. Documents on which the rules are based') + T(['Ref.', 'Document', 'Used for'], [
                ['[R1]', 'CLSI. <i>Performance Standards for Antimicrobial Susceptibility Testing</i>. CLSI M100, 36th ed. (M100-Ed36). Clinical and Laboratory Standards Institute; 2026.', 'Interpretive categories, breakpoints applied to staphylococcal vancomycin, intrinsic resistance (Appendix B), urine-only agents (Table 1A-1 and related tables).'],
                ['[R2]', 'Hindler JA, Barton M, Erdman SM, et al. <i>Analysis and Presentation of Cumulative Antimicrobial Susceptibility Test Data; Approved Guideline</i>, 4th ed. CLSI document M39-A4, Vol. 34, No. 2. Clinical and Laboratory Standards Institute; January 2014.', 'First-isolate rule, analysis period, minimum numbers, calculation of %S, selective testing, stratification, statistics.'],
                ['[R3]', 'Magiorakos AP, Srinivasan A, Carey RB, et al. Multidrug-resistant, extensively drug-resistant and pandrug-resistant bacteria: an international expert proposal for interim standard definitions for acquired resistance. <i>Clin Microbiol Infect</i> 2012;18(3):268-281. doi:10.1111/j.1469-0691.2011.03570.x', 'Definitions and antimicrobial categories for MDR, XDR and PDR.'],
                ['[R4]', 'World Health Organization. <i>AWaRe classification of antibiotics for evaluation and monitoring of use, 2025</i>. Geneva: WHO; 2025.', 'Access, Watch and Reserve tags (informational).'],
                ['[R5]', 'World Health Organization. <i>WHO Bacterial Priority Pathogens List, 2024</i>. Geneva: WHO; 2024.', 'Choice of priority resistance indicators.'],
                ['[R6]', 'World Health Organization. <i>GLASS manual for antimicrobial resistance surveillance in common bacteria causing human infection</i>. Geneva: WHO; 2023.', 'Surveillance principles and indicator selection.'],
                ['[R7]', 'Australian Commission on Safety and Quality in Health Care (ACSQHC). <i>Specification for a Hospital Cumulative Antibiogram</i>. December 2019.', 'The 90% threshold used to identify selectively tested agents.'],
                ['[R8]', 'CLSI. <i>Principles and Procedures for Blood Cultures; Approved Guideline</i>, M47-A (Volume 27). The edition supplied for this review is M47-A; a later edition may differ.', 'Blood culture contamination: acceptable range (Section 5.6) and contaminant organisms (Section 8).'],
                ['[R10]', 'World Health Organization. <i>Emerging antimicrobial resistance reporting framework</i>. Geneva: WHO; 2018 (ISBN 978-92-4-151459-0).', 'Priority alerts: critical resistance phenotypes (Annex 1), PDR and XDR reporting, C. auris as the fungal target.'],
                ['[R11]', 'World Health Organization. <i>WHO fungal priority pathogens list to guide research, development and public health action</i>. Geneva: WHO; 2022 (ISBN 978-92-4-006024-1).', '<i>Candida auris</i> in the critical group; high outbreak potential.'],
                ['[R12]', 'Centers for Disease Control and Prevention. <i>Preventing Adult Blood Culture Contamination: A Quality Tool for Clinical Laboratory Professionals</i>; and the CDC blood culture contamination summary (glossary).', 'Definition of the contamination rate and its denominator.'],
                ['[R9]', 'Brown LD, Cai TT, DasGupta A. Interval estimation for a binomial proportion. <i>Stat Sci</i> 2001;16(2):101-133.', 'Choice of the Wilson interval.']]) +
            H('3. Evidence status codes') + L([
                V + ' (verified): the statement was checked against the full text of the document supplied for this review. The section and the printed page are given.',
                W + ' (web): the statement was checked in the published document on the issuing organisation\'s website.',
                C + ' (cited): the statement is cited from published literature that was not among the documents supplied for this review. It should be verified by the reviewer.',
                A + ' (application policy): no external document prescribes the rule. It is a decision of the programme and is declared as such.']) +
            H('4. Evidence map: tool, rule and source') + T(['Tool or output', 'Rule applied', 'Source', 'Status'], [
                ['Interpretive category', 'S, SDD, I, R as assigned by the laboratory (M100). Only S counts as susceptible.', '[R1]; [R2] Section 6.6, p. 13', V],
                ['First isolate', 'One isolate per patient, organism and period; screening cultures excluded.', '[R2] Section 6.4, p. 10; Appendix B, p. 44', V],
                ['Analysis period', 'At least annual; 12 months as the reference period.', '[R2] Sections 6.3 and 6.4, p. 10', V],
                ['Minimum numbers', 'Species reported when 30 or more isolates; note otherwise.', '[R2] Sections 6.4, 6.7.2, 7.2.2, pp. 10, 17, 22', V],
                ['Confidence interval', '95% Wilson score interval.', '[R2] Appendix H1, p. 61 (Wilson named as an accepted method); [R9]', V + ' / ' + C],
                ['Selective testing (&dagger;)', 'Agents tested on fewer than 90% of a species\' isolates are not reported as %S.', '[R2] Section 6.5.3, p. 13; threshold from [R7] Section 3.2, p. 4', V + ' / ' + W],
                ['Intrinsic resistance (&Dagger;)', 'Expected resistance is not presented as a susceptibility percentage.', '[R1] Appendix B, p. 318; [R2] Section 7.2.4, p. 22', V],
                ['Urine-only agents (&sect;)', 'Flagged when results come from non-urine specimens; results kept.', '[R1] Table 1A-1 and related tables ("Urine Only"), p. 24', V],
                ['Subsets (specimen, unit)', 'First isolate chosen within the subset; minimum 30.', '[R2] Section 11, p. 28', V],
                ['MDR, XDR, PDR', 'Magiorakos categories and definitions; MRSA always MDR; intrinsic resistance removed.', '[R3] Tables 1-6, pp. 271-276; p. 278', V],
                ['Priority indicators', 'CRE, CRAB, CRPA, MRSA and 3GC-R are resistance types of the WHO priority list. VRE covers all <i>Enterococcus</i>, while the list names <i>E. faecium</i> only. VRSA is not on the 2024 list (WHO removed it). Operational definitions are application policy.', '[R5], Section on pathogens removed from the 2017 list and Fig. 1; [R6]', V + ' / ' + A],
                ['Differences between periods', 'Two-proportion z-test; both groups 30 or more; no adjustment for multiple comparisons.', '[R2] Appendix H2 and H3, p. 63', V],
                ['AWaRe tag', 'Informational tag only.', '[R4]', C],
                ['Blood culture contamination', 'Rate = contaminated blood cultures / all blood cultures received. Acceptable range typically 3% or less; it may not be possible to go below 2%.', '[R8] Sections 5.6 and 8 (acceptable range); [R12] (denominator)', V + ' / ' + W],
                ['Priority alerts (Monthly Alerts)', 'All isolates of the month are checked. Flags: carbapenem-resistant Enterobacterales, <i>A. baumannii</i> and <i>P. aeruginosa</i>; VRE; <i>S. aureus</i> vancomycin I or R; PDR; XDR; Annex 1 phenotypes; <i>C. auris</i>.', '[R2] Section 9.4; [R1] Appendix A; [R10] Section 3.2.1 and Annex 1; [R11] <i>C. auris</i> section', V],
                ['Colour bands', 'Display convention.', 'Not defined by a standard', A]]) +
            TIP('Where the application goes beyond a source document, the departure is declared in the section that describes the tool and is collected in the last section, <b>Known limitations and departures from the sources</b>.')],

        // ------------------------------------------------------------------ 1
        ['rv_data', 'For reviewer: data intake, integrity and privacy', () =>
            H('1. Source of the data') + L([
                'The microbiology laboratory exports its monthly results from <b>WHONET</b>. Two files are read: the file of interpretations (S, SDD, I, R) and, when supplied, the file of values (MIC and zone diameters).',
                'The category of each agent is taken <b>as exported</b>. The application does not recompute interpretations from MIC or zone values, so the edition of M100 applied is that used by the laboratory when the test was interpreted.']) +
            H('2. Categories stored') + L([
                'S, I, R and <b>SDD</b> (susceptible-dose dependent) are stored as four distinct values. SDD is a separate category in M100 and is not counted as susceptible [R2, Section 6.6, p. 13].',
                'Non-susceptible (NS) = I + SDD + R. Resistant (R) = R only. Susceptible (S) = S only.']) +
            H('3. Records not included in the analysis, and why') + T(['Row', 'Treatment', 'Reason'], [
                ['No organism, "xxx", "con" or "no growth"', 'Not included as an isolate. Counted in the monthly culture counts (growth, no growth, contaminated).', 'There is no isolate to analyse. The counts are kept as aggregates for the culture-burden table.'],
                ['Organism identified but no S, I or R result', 'Not included.', 'An isolate without susceptibility data cannot contribute to %S.'],
                ['No specimen type', 'Not included.', 'The source cannot be analysed, and screening cultures cannot be excluded [R2, Section 6.4, p. 10].'],
                ['No usable date', 'Not included.', 'Needed for the analysis period.'],
                ['Antibiotic columns outside the current M100 and WHO lists (legacy WHONET codes)', 'Recognised and not included.', 'No current interpretive criteria.'],
                ['Beta-haemolytic streptococci: penicillin or ampicillin by disk, result I or R', 'Ignored.', 'M100 Table 2H-1 (p. 129) gives only a susceptible disk breakpoint for these agents (zone &ge; 24 mm); a disk result cannot be reported as I or R [R1].'],
                ['Staphylococcus: vancomycin by disk', 'Not used.', 'M100 Table 2C comment (p. 100): MIC tests should be performed for staphylococci; the disk test does not differentiate susceptible from intermediate or resistant isolates [R1].']]) +
            H('4. Staphylococcal vancomycin: the only re-interpretation') + L([
                'When the MIC is available, the category is derived from M100 Table 2C (p. 101): <i>S. aureus</i> S &le; 2, I 4-8, R &ge; 16 &micro;g/mL; other staphylococci S &le; 4, I 8-16, R &ge; 32 &micro;g/mL [R1].',
                'MIC values must lie on the two-fold dilution scale. Other values are treated as recording errors and the vancomycin result is not stored.',
                'An <i>S. aureus</i> MIC of 16 or more is reported as a VRSA <b>candidate</b> until a reference laboratory confirms it (M100 comment 16: send <i>S. aureus</i> with vancomycin MIC &ge; 8 &micro;g/mL to a referral laboratory, p. 101).']) +
            H('5. Culture counts') + L([
                'For each month, ward and specimen type the numbers of cultures with growth, without growth and contaminated are stored as aggregate counts. No patient data are involved. They feed the culture-burden table.']) +
            H('6. De-identification of the published copy') + L([
                'Names and internal identifiers are removed before the dashboard copy is published.',
                'The patient number is replaced by a <b>salted SHA-256 pseudonym</b> (first 16 hexadecimal characters). The same patient gives the same pseudonym, so first-isolate selection still works. Records without a patient number have an empty identifier and are always counted.',
                'The dashboard shows no patient name and no patient number.'])],

        // ------------------------------------------------------------------ 2
        ['rv_period', 'For reviewer: analysis period and first-isolate selection', () =>
            H('1. Rule') + L([
                'Only the <b>first isolate of a species per patient per analysis period</b> is included, irrespective of body site or susceptibility profile [R2, Section 6.4, p. 10]. The analysis period given in the document is "eg, one year".',
                'Surveillance cultures (for example VRE or MRSA screening) are not included [R2, Section 6.4, p. 10]. A specimen is classed as screening when its specimen name matches rectal, perirectal, nasal, nares, axilla, axillary, groin or inguinal swab, or contains "screening" or "surveillance".',
                'When several years are combined, the first isolate per patient is used for each period and a footnote tells the reader that the data are combined [R2, Section 6.4, p. 10]. M39 suggests this per calendar year; the app counts per <b>12-month block</b> from the start of the period when the patient is linked (see the key below).']) +
            H('2. Why this rule') + P('Including several isolates from the same patient biases %S towards patients who are cultured most often and overstates the risk of acquiring a resistant strain [R2, Section 6.4, p. 10; rationale in Appendix B, p. 44]. The recommended practice is to keep all isolates in the database and let the analysis select the first isolates; the application does the same: all isolates are stored and selection is made at analysis time.') +
            H('3. How the application applies it') + L([
                'Key = patient number + organism + <b>calendar year</b>. The earliest isolate by specimen date is kept.',
                '<b>The laboratory patient number restarts every year</b>, so the same number in two different years can belong to two different people. Records are therefore keyed by number, organism and calendar year unless the person has been linked: repeat patients are confirmed (matched by name, sex and similar age, on the device) and each confirmed person gets one random <b>Patient Key</b>. Records with a key are counted once per 12-month block of the analysis period, whatever calendar years the block crosses; blocks start at the first month with data in the period. Names are never published.',
                'Records without a patient number, a valid date or an organism cannot be de-duplicated and are kept.',
                'When a subset is analysed (a specimen type such as blood or urine), the subset is selected <b>before</b> the first isolate is chosen, as required [R2, Section 11, p. 28].',
                'Unit comparisons (ICU, non-ICU, inpatient, outpatient) choose the first isolate across all wards and then split by unit, so that a patient is counted once. This is a design decision of the application; M39 describes stratification by location "at the time the infection is suspected or diagnosed" [R2, Section 11.1, p. 28].']) +
            H('4. Periods offered') + T(['Period', 'Definition', 'Basis'], [
                ['Last 12 Months (default)', 'The 12 months ending at the latest month with data. Moves forward when newer data are loaded.', '[R2] Sections 6.3 and 6.4: analysis at least annually, analysis period "eg, one year". A fixed calendar year is not required.'],
                ['Calendar year', 'The last complete calendar year before the latest month with data (default of the Annual Report tab; the Analytics tab can also use a chosen calendar year, in Settings), or a calendar year chosen in Settings (Analytics tab).', 'Accepted analysis period; easier to compare between reports. Application choice.'],
                ['Last 3 Months and Last Month', 'The 3 months, or the single month, ending at the latest month with data.', '[R2] Section 6.3, p. 10: more frequent analysis is allowed but is "complicated by seasonal variations in resistance rates and imprecise measures due to small numbers of isolates". These periods are for follow-up and are labelled as indicators.'],
                ['Specific period (Analytics tab, Settings; Heatmap From/To)', 'Any start and end month chosen by the user.', 'Application choice. The period is written under each chart.'],
                ['All Times', 'Only calendar years in which every one of the 12 months has data. Years with a missing month are left out, and the years left out are named on the screen.', 'An incomplete year over-represents some seasons and does not meet the one-year analysis period of [R2]. Application policy.']]) +
            H('5. The report month') + L([
                'All periods end at one month: the latest month with data (automatic, not set by the user).',
                'Records dated after the report month are not part of any period. This allows data of a month that is still being entered, or not yet supplied in full by the laboratory, to be excluded until the laboratory file is complete.',
                'A period in which any month has no data at all is flagged as incomplete.']) +
            H('6. Possible contaminants') + L([
                'A blood isolate of a skin-flora organism (coagulase-negative staphylococci, <i>Corynebacterium</i>, <i>Micrococcus</i>, <i>Bacillus</i> other than <i>B. anthracis</i>, <i>Cutibacterium</i>, <i>Propionibacterium</i>, viridans streptococci) is flagged as a <b>possible</b> contaminant. A single positive set of these organisms is frequently a contaminant, but the decision requires clinical information.',
                'The record is flagged, not deleted. One switch in Settings (gear button) excludes them from every analysis on every tab; it is off by default, and the default for all users is set by the surveillance programme. The number excluded is shown.'])],

        // ------------------------------------------------------------------ 3
        ['rv_stats', 'For reviewer: percentages, minimum numbers and confidence intervals', () =>
            H('1. Definitions') + T(['Quantity', 'Definition', 'Source'], [
                ['% Susceptible (%S)', 'Isolates with category S divided by isolates tested for the agent. I and SDD are not included in the numerator.', '[R2] Section 6.6, p. 13 ' + V],
                ['% Resistant (%R)', 'Category R divided by isolates tested.', 'Application ' + A],
                ['% Non-susceptible (%NS)', '(I + SDD + R) divided by isolates tested.', '[R2] glossary: nonsusceptible ' + V],
                ['Tested (n)', 'Isolates with an S, SDD, I or R result for that agent. Agents not tested are not in the denominator.', '[R2] Section 6.5.1, p. 11 ' + V],
                ['Prevalence (pie chart)', 'Share of each organism among the first isolates of the period. It is a share of isolates, not a population prevalence, and is labelled so under the chart.', 'Application ' + A]]) +
            H('2. Minimum numbers') + L([
                '<b>Species:</b> %S is reported only for species with 30 or more isolates in the period. If fewer, a note states the lower statistical validity [R2, Sections 6.4, 6.7.2 and 7.2.2, pp. 10, 17, 22].',
                '<b>Agent within a species:</b> the cumulative antibiogram shows a cell only when 30 or more isolates were tested for that agent. This is stricter than the species rule and is an application policy ' + A + '. It prevents a percentage based on a small number from being read as reliable.',
                '<b>Charts:</b> bars and points based on fewer than 30 isolates are marked (grey bar, name ending with an asterisk, hollow point). The tick box "Hide n &lt; 30" in each Analytics chart removes them from that chart (default off). The minimum of 30 is fixed and cannot be changed by users.',
                '<b>Subsets:</b> a subset is analysed only when it has 30 or more isolates [R2, Section 11, p. 28].',
                '<b>Combining years:</b> when few isolates are tested per year and %S has not changed significantly, several years may be combined, using the first isolate per patient (per calendar year in M39; per 12-month block in the app) and a footnote saying the data are combined [R2, Section 6.4, p. 10]. In the app: Settings, Analytics period (All time or a date range); the banner states the period.',
                '<b>MDR tab:</b> M39 Section 12 asks the facility to define MDR and gives no separate n rule. The app marks wards, months and groups under 30 with * and shows the Wilson 95% CI on MDR+ and XDR+ (Section 10.1, Appendix H1). Class assignment per isolate is not affected by n [R3].']) +
            H('3. Confidence interval') + L([
                'The 95% interval is the <b>Wilson score interval</b> without continuity correction: with p = r/n and z = 1.96, centre = (p + z&sup2;/2n) / (1 + z&sup2;/n) and half-width = z &radic;(p(1-p)/n + z&sup2;/4n&sup2;) / (1 + z&sup2;/n).',
                'M39 gives the Agresti-Coull approximation in Appendix H1 and states that for fewer than 30 isolates it is less accurate; it names the Wilson interval without continuity correction as an alternative [R2, Appendix H1, p. 61]. The Wilson interval keeps the limits inside 0-100% and performs well for small n and proportions near 0 or 100% [R9].',
                'The interval is shown in the tooltip of every bar and point together with n.']) +
            H('4. Statistical comparison of two groups') + L([
                'Two proportions (two periods, ICU and non-ICU) are compared with a <b>pooled two-proportion z-test</b>. For a 2 &times; 2 table the square of this statistic equals the Pearson chi-square statistic without continuity correction. M39 names the chi-square test as the statistic most commonly used for this purpose [R2, Appendix H2, p. 63].',
                'A difference is called significant only when <b>both groups have 30 or more tested isolates</b> and |z| &ge; 1.96 (two-sided p &lt; 0.05). M39 notes that the chi-square test does not work well when the number of isolates is small or the proportion is close to 0% or 100%, where an exact test is appropriate [R2, p. 63]; the minimum of 30 is the application\'s safeguard, and an exact test is not implemented.',
                '<b>No adjustment is made for multiple comparisons.</b> M39 states that this is common practice and advises a note to that effect [R2, Appendix H3, p. 63]. A significant difference should be treated as a signal to investigate, not as proof of change; M39 also reminds the analyst to consider changes in patient population, sampling practice and laboratory testing protocols [R2, Section 10, p. 27].']) +
            H('5. Colour bands') + L([
                'Cumulative antibiogram: green 80% or more; amber 50-79%; red below 50%. The heatmap uses the same three bands, written as percent resistant: green up to 20%, amber 21-50%, red above 50% (the same as 80% and 50% susceptible).',
                'These bands are a <b>display convention</b> ' + A + '. They are not CLSI or WHO interpretive categories. WHO does not provide a reference for these colours, and neither M39 nor M100 defines them. The bands are not a treatment guide and not an indicator for therapy.',
                '<b>Rationale for the antibiogram bands.</b> The 80% threshold is the level that clinicians in practice accept for empirical therapy: a survey of infectious diseases providers (Hasegawa et al., 2023, conference abstract, Open Forum Infectious Diseases, 10 Suppl 2) reported median acceptance thresholds between 74% and 86%, higher for severe infection (86.0% for ICU gram-negative bloodstream infection; 77.9% for non-ICU). In one worked example, agents active against 80-85% of pooled isolates were judged unacceptable for routine empirical use, while 90-97% in a subgroup were judged appropriate (Pogue, Contagion Live, 2018; a practical review without a formal derivation).',
                '<b>Limits.</b> The survey does not support a single fixed threshold for severe infection: its ICU bloodstream median (86%) lies between 80 and 90. For severe infection the application therefore relies on the local policy stated in the note under the table, not on a separate colour. No CLSI or WHO document was found that fixes these numbers; the reviewer should confirm the thresholds with the Antibiotic Committee.'])],

        // ------------------------------------------------------------------ 4
        ['rv_flags', 'For reviewer: selective testing, intrinsic resistance and urine-only agents', () =>
            P('Three symbols mark results whose percentage could be misread. In each case the data are <b>not hidden</b>: the symbol and a note under the chart explain the limitation, and the clinician decides.') +
            H('1. Selective testing (&dagger;)') + L([
                '<b>Problem:</b> an agent tested only on part of the isolates (for example colistin tested only on carbapenem-resistant isolates) is tested on a less susceptible subgroup, so its %S is biased low [R2, Section 6.5.3, p. 13].',
                '<b>Rule in M39:</b> "The results of testing supplemental agents, or agents tested selectively, should not be included in the routine cumulative antimicrobial susceptibility test report" [R2, Section 6.5.3, p. 13]. M39 gives no percentage.',
                '<b>Threshold:</b> an agent is treated as selectively tested when it was tested on <b>fewer than 90%</b> of the isolates of the species (species with 30 or more isolates). The figure is taken from the ACSQHC specification: "In general percentages should only be reported where 90% of isolates are tested for each organism" [R7, Section 3.2, p. 4] ' + W + '. The ACSQHC document is the source; it is not part of CLSI M39.',
                '<b>Display:</b> in the cumulative antibiogram the cell shows &dagger; instead of a percentage. In the charts the agent carries &dagger; and is listed under the chart key with the share of isolates tested.']) +
            H('2. Intrinsic resistance (&Dagger;)') + L([
                '<b>Definition:</b> "inherent or innate (not acquired) antimicrobial resistance, which is reflected in wild-type antimicrobial patterns of all or almost all representatives of a species" [R1, Appendix B, p. 318].',
                '<b>Purpose in M100:</b> the tables can assist "with verification of cumulative antimicrobial susceptibility test data" [R1, Appendix B, p. 318]. M39 places an "R" in the data box of the antibiogram when the species is known to be intrinsically resistant [R2, Section 7.2.4, p. 22].',
                '<b>Implementation:</b> the agent-organism combinations of M100-Ed36 Appendix B (tables B1 to B4 and their notes) are coded in the application. For such a combination no susceptibility percentage is displayed; the cell or bar shows &Dagger; and a note lists the agents concerned. For <i>Salmonella</i> and <i>Shigella</i> the azithromycin entry is not applied.',
                '<b>Use in the MDR classification:</b> intrinsic resistance is removed before categories are counted (see the MDR section).',
                'A small percentage (1% to 3%) of isolates may test susceptible by method variation [R1, p. 318]; the application does not report them as acquired susceptibility.']) +
            H('3. Urine-only agents (&sect;)') + L([
                '<b>Source:</b> M100 lists a "Urine Only" tier in its testing and reporting tables (for example Table 1A-1, p. 24: cefazolin as a surrogate for uncomplicated UTI, nitrofurantoin, fosfomycin for <i>E. coli</i>) [R1]. The application uses the following agents: nitrofurantoin, fosfomycin, mecillinam, norfloxacin, nalidixic acid, sulfonamides, trimethoprim and, for <i>P. aeruginosa</i>, amikacin.',
                '<b>Flag:</b> when results for such an agent come from non-urine specimens, the label carries &sect;. Both values are shown: the percentage with all specimens and the percentage with urine specimens only (with its n).',
                '<b>Decision:</b> results from non-urine specimens are <b>kept</b> in the statistics. A percentage that mixes specimen types can mislead, but removing the results would hide data; the clinician judges which figure applies. M39 supports specimen-specific reporting that includes only agents useful for the infection concerned [R2, Section 11.1, p. 29].']) +
            H('4. Fosfomycin and minocycline') + P('The WHO AWaRe category of these two agents depends on the route (oral: Watch; intravenous: Reserve) [R4]. The laboratory record does not state the route, so they are not assigned a category and a note says why.')],

        // ------------------------------------------------------------------ 5
        ['rv_cum', 'For reviewer: cumulative antibiogram and Analytics charts', () =>
            H('1. Cumulative antibiogram (Annual Report tab)') + L([
                'Built from the first isolates of the analysis period (section on analysis period). Rows are organisms with 30 or more isolates (up to 15 shown); columns are agents with 30 or more tested results (up to 30 shown).',
                'Cell value: %S, rounded to the nearest whole percent. Only S counts [R2, Section 6.6, p. 13].',
                'Specimen-specific tables (all specimens, blood, urine and other types with 30 or more first isolates) choose the first isolate within the specimen type [R2, Section 11, p. 28].',
                'Symbols: &dagger; selective test, &Dagger; intrinsic resistance, &sect; urine-only agent on non-urine specimens, as in the previous section.',
                'The count of isolates (N) is not displayed in every cell; the n per organism is displayed in the row, as M39 requires the number of observations for each organism [R2, Section 7.2.2, p. 22].']) +
            H('2. Analytics tab: charts and what they compute') + T(['Chart', 'Computation'], [
                ['Guided AST profile', 'Organism selected from the specimen chosen. Per agent: %S, %R or %NS (selector), n, 95% CI. First isolates only; period, specimen and unit filters apply.'],
                ['Pathogen profile', 'The same computation starting from the organism, with a period selector.'],
                ['Antibiotic across organisms', 'For one agent, the metric for each organism with the same marks.'],
                ['Heatmap (organism x agent)', 'The metric for each organism-agent pair, colour banded; grey when n &lt; 30 or intrinsic resistance; &sect; and urine-only percentage shown.'],
                ['Prevalence (pie)', 'Distribution of organisms among first isolates; possible contaminants are counted and reported separately.']]) +
            P('Each chart shows, under it, the key to the symbols and the notes for the agents concerned (selective testing, intrinsic resistance, urine-only agents, route-dependent agents, number of possible contaminants).') +
            H('3. Rule that is not implemented') + L([
                'M39 advises that when cefoxitin is used as the surrogate for oxacillin resistance in staphylococci, %S should be presented for oxacillin and not for cefoxitin [R2, Section 6.5.1, p. 11]. The application displays the agents as recorded by the laboratory and does not apply this substitution. This is listed under limitations.',
                'M39 advises that for <i>S. aureus</i> the %S be listed for all isolates and for the MRSA subset [R2, Section 2, p. 2]. A separate MRSA-subset row is not produced in the cumulative table; MRSA is reported as an indicator.'])],

        // ------------------------------------------------------------------ 6
        ['rv_markers', 'For reviewer: priority resistance indicators', () =>
            P('The indicators are the resistance profiles that WHO regards as priorities [R5]. WHO defines the pathogens; the exact phenotypic definition used here is an operational definition of the application ' + A + ' and is stated below so that it can be checked.') +
            T(['Indicator', 'Organisms', 'Definition applied', 'Remarks'], [
                ['3GC-R', '<i>E. coli</i>, <i>K. pneumoniae</i>', 'Resistant (R) to ceftriaxone, or if not tested cefotaxime, or if not tested ceftazidime.', 'Phenotypic surveillance indicator for third-generation cephalosporin resistance. It does not confirm ESBL production.'],
                ['CRE', 'Enterobacterales', 'R to ertapenem, meropenem, imipenem or doripenem (first agent tested; any R among the agents of that group).', 'Imipenem is not used for <i>Proteus</i>, <i>Morganella</i> and <i>Providencia</i>, whose imipenem MICs are intrinsically raised.'],
                ['CRAB', '<i>A. baumannii</i> and <i>A. calcoaceticus</i>', 'R to imipenem, meropenem or doripenem.', 'WHO critical priority.'],
                ['CRPA', '<i>P. aeruginosa</i>', 'R to imipenem, meropenem or doripenem.', 'WHO high priority.'],
                ['MRSA', '<i>S. aureus</i>', 'Cefoxitin (or cefoxitin screen) R; if not tested, oxacillin R; if neither tested, the laboratory MRSA flag.', 'Cefoxitin is the surrogate of choice in M100 (Table 2C: cefoxitin zone &le; 21 mm or MIC &ge; 8 &micro;g/mL, p. 99) [R1].'],
                ['VRE', '<i>Enterococcus</i> spp.', 'Vancomycin R. Teicoplanin resistance alone does not count.', ''],
                ['VRSA', '<i>S. aureus</i>', 'Vancomycin MIC &ge; 16 &micro;g/mL (M100) <b>and</b> confirmation by a reference laboratory.', 'MIC &ge; 16 without confirmation is shown as a candidate, not as VRSA.'],
                ['ESBL, CPE', '<i>E. coli</i>, <i>K. pneumoniae</i>; Enterobacterales', 'The laboratory WHONET flags for ESBL and for carbapenemase, as reported.', 'The application does not infer these from susceptibility results.']]) +
            H('Method') + L([
                'Proportion = resistant / tested, among first isolates of the period. An isolate not tested for the defining agents is not in the denominator.',
                'Each proportion has a 95% Wilson interval and is marked when n &lt; 30.',
                'Priority list: WHO Bacterial Priority Pathogens List 2024 places carbapenem-resistant <i>A. baumannii</i>, carbapenem-resistant Enterobacterales and third-generation cephalosporin-resistant Enterobacterales in the critical group, and carbapenem-resistant <i>P. aeruginosa</i>, vancomycin-resistant <i>E. faecium</i> and MRSA in the high group [R5] ' + C + '.'])],

        // ------------------------------------------------------------------ 7
        ['rv_mdr', 'For reviewer: MDR, XDR and PDR classification', () =>
            H('1. Source and status of the definitions') + L([
                'Definitions: Magiorakos et al. 2012 [R3]. The document is the proposal of an international expert group convened by ECDC and CDC; its title describes the definitions as <b>interim</b> [R3, title and p. 268]. It is not a CLSI or WHO standard. CLSI M39 leaves the definition of multidrug-resistant organisms to the facility, which may use "definitions recently proposed" [R2, Section 12.1, p. 29]; the application adopts [R3] for that reason.',
                'The definitions apply to <b>acquired</b> resistance [R3, p. 270].']) +
            H('2. Definitions applied') + T(['Class', 'Definition'], [
                ['MDR', 'Non-susceptible to at least one agent in <b>three or more</b> antimicrobial categories [R3, Table 6, p. 276].'],
                ['XDR', 'Non-susceptible to at least one agent in <b>all but two or fewer</b> categories (susceptible to agents in only one or two categories) [R3, Table 6, p. 276].'],
                ['PDR', 'Non-susceptible to <b>all agents in all categories</b> [R3, Table 6, p. 276].'],
                ['Non-susceptible (NS)', 'I, SDD or R. S is susceptible. [R3] counts a result as non-susceptible when it is "resistant, intermediate or non-susceptible" (p. 270 and p. 276) ' + V + '. [R3] does not mention SDD: it was written before CLSI introduced SDD in 2014 as a separate category split from I, which had also been used for results that may respond to a higher dose [R1; CLSI]. SDD is therefore counted as non-susceptible, following the earlier use of I. This extension is an application policy (A).'],
                ['MRSA', '"All MRSA isolates are defined as MDR because resistance to oxacillin or cefoxitin predicts non-susceptibility to all categories of beta-lactam antimicrobials", except the anti-MRSA cephalosporins [R3, Table 6 footnote, p. 276; Table 1, p. 271].']]) +
            H('3. Organisms and categories') + T(['Group', 'Categories (R3 table)', 'Number'], [
                ['Enterobacterales', 'Table 3: aminoglycosides, anti-MRSA cephalosporins, antipseudomonal penicillins + inhibitor, carbapenems, cephalosporins 1st/2nd generation, cephalosporins 3rd/4th generation, cephamycins, fluoroquinolones, folate pathway inhibitors, glycylcyclines, monobactams, penicillins, penicillins + inhibitor, phenicols, phosphonic acids, polymyxins, tetracyclines', '17'],
                ['<i>P. aeruginosa</i>', 'Table 4', '8'],
                ['<i>Acinetobacter</i> spp.', 'Table 5', '9'],
                ['<i>S. aureus</i>', 'Table 1', '17'],
                ['<i>Enterococcus</i> spp.', 'Table 2', '11']]) +
            P('The agents within each category are those listed in the corresponding table of [R3]. Organisms without a table (for example streptococci, <i>Salmonella</i> outside the Enterobacterales table, anaerobes) are not classified.') +
            H('4. Algorithm') + L([
                'Applied to each <b>first isolate</b> of the period.',
                'For each category, agents to which the species is intrinsically resistant (M100 Appendix B) are removed. A category with no agent left is removed and not counted in the total. [R3, Table 2 footnote a, p. 272] requires removal of an intrinsically resistant <i>category</i>; the application also removes an intrinsically resistant <i>agent</i> inside a category that has other agents, following the purpose stated in [R3, p. 270], that intrinsically resistant agents should not be taken into account. [R3, Table 2] lists two intrinsically resistant categories for enterococci: carbapenems for <i>E. faecium</i> (removed as a category) and streptogramins for <i>E. faecalis</i>. For <i>E. faecalis</i> the application removes quinupristin/dalfopristin, which M100 Appendix B lists as intrinsically resistant, so the streptogramin category has no agent left and is removed, with the same result.',
                'A category is <b>tested</b> when at least one of its agents has a result, and <b>non-susceptible</b> when at least one tested agent is I, SDD or R.',
                '<b>Agent lists.</b> The categories and agents follow [R3] Tables 1-5. [R3] judges resistance at the level of the category (non-susceptible to at least one agent of the category, p. 276) and chose one representative agent per category by applying cross-resistance rules, so its lists are a guide that "will need to be regularly reviewed" [R3, p. 279]. The application therefore counts any agent of the same class: it adds levofloxacin, ofloxacin and moxifloxacin to the Enterobacterales fluoroquinolones and polymyxin B to their polymyxins; levofloxacin to the <i>S. aureus</i> fluoroquinolones; azithromycin and clarithromycin to the <i>S. aureus</i> macrolides; cefoxitin screen to the anti-staphylococcal beta-lactams. These are application choices ' + A + ' and can change a few classifications compared with a strict reading of the tables (6 of 816 classified isolates in one data set, all Enterobacterales).',
                'NS categories &ge; 3: MDR. NS categories &ge; (applicable categories - 2): XDR. An XDR isolate in which no tested agent is susceptible is PDR only when every applicable category was tested.',
                'MRSA (cefoxitin, cefoxitin screen or oxacillin R, or the laboratory MRSA flag) is MDR at minimum, and the anti-staphylococcal beta-lactam category is counted as non-susceptible.']) +
            H('5. Incomplete testing') + L([
                'Untested categories are treated as unknown, not as susceptible and not as non-susceptible. Because a routine panel does not cover all categories, XDR and PDR are conservative.',
                'With incomplete testing, an isolate is MDR when 3 or more categories are non-susceptible (confirmed whatever else was tested). It is labelled <b>possible XDR</b> when it is not confirmed XDR and fewer than 3 categories were found susceptible, because the untested categories could still make it XDR; XDR is ruled out only when 3 or more categories are susceptible [R3]. It is labelled <b>possible PDR</b> when, in addition, no tested agent was susceptible and not every category was tested. No numeric threshold is used. These isolates are counted as MDR, not as XDR or PDR. The terms "possible XDR" and "possible PDR" are those of Magiorakos et al. [R3]; the rule for applying them without a numeric threshold is the application\'s reading of that definition ' + A + '.',
                '<b>Validity condition</b> [R3, p. 268 and p. 278]: the definitions are valid and comparable only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With a routine panel this condition is not fully met, so confirmed XDR and PDR counts are minimum estimates and should not be compared with studies that tested the full lists.',
                'PDR as applied here means that every applicable category was tested and no tested agent was susceptible; individual agents within a category may be untested. It is therefore an approximation of "all agents in all categories".'])],

        // ------------------------------------------------------------------ 8
        ['rv_short', 'For reviewer: Monthly Alerts tab', () =>
            P('The Monthly Alerts tab is for early warning, not for reporting resistance percentages. A cumulative antibiogram is required at least once a year [R2, Section 6.3, p. 10]; shorter windows are allowed but have small numbers and seasonal variation. The tab therefore shows alerts only.') +
            H('1. What was removed, and why') + L([
                'Possible clusters (3 patients within 14 days): no standard gives these numbers. CDC does not give a case count or time window for MDRO clusters; the definition of one state health authority (Oregon) requires epidemiological linkage, which the laboratory file does not contain.',
                'Comparison with earlier periods, the 8-quarter trend and the Last 3 Months tab: no standard method for monthly comparison; the annual report carries the quarterly trend.',
                'Blood isolates as possible contaminants: its denominator was isolates, while the contamination rate uses blood cultures [R12]. The correct rate is in the Cultures tab.',
                'Ward ranking by MDR count: no source; the count depends on how many cultures a ward sends. Ward-level results are available by the unit filter in the antibiogram.',
                'ICU compared with non-ICU stays in the Annual Report tab, on an annual basis.']) +
            H('2. Priority alerts') + L([
                '<b>All isolates of the month</b> are checked, not only the first per patient, because a first-isolate summary can miss new resistance patterns [R2, Section 9.4] ' + V + '. A later isolate with the same flags from the same patient is marked <b>repeat</b>; screening swabs are marked <b>screening</b>.',
                '<b>Carbapenem-resistant Enterobacterales, <i>Pseudomonas</i> and <i>Acinetobacter</i>; <i>Enterococcus</i> vancomycin-resistant; <i>S. aureus</i> vancomycin I or R:</b> results listed for confirmation and notification in [R1] Appendix A ' + V + '. The column positions of Category I, II and III could not be read reliably from the text supplied, so the reviewer should confirm the category of each item.',
                '<b>PDR, XDR:</b> the WHO framework asks countries to report PDR and XDR not previously detected in the country [R10, Section 3.2.1] ' + V + '. The application cannot know what was previously detected in the country; every XDR and PDR isolate of the month is flagged for review.',
                '<b>Annex 1 critical phenotypes</b> [R10, Annex 1] ' + V + ': Enterobacterales and non-fermenters that are XDR including colistin-R; <i>Enterococcus</i> VRE with daptomycin-NS, linezolid-R, or telavancin, dalbavancin or oritavancin NS; <i>S. aureus</i> with linezolid-R, daptomycin-NS, tigecycline-NS or telavancin, dalbavancin or oritavancin NS. Vancomycin-R <i>S. aureus</i> follows the VRSA rule. Coagulase-negative staphylococci and other organisms of Annex 1 are not classified by the application and are not flagged.',
                '<b><i>Candida auris</i>:</b> critical group of the WHO fungal priority pathogens list, with high outbreak potential [R11] ' + V + '; it is the only fungus targeted by the WHO emerging AMR component [R10, footnote 6, p. 8] ' + V + '.',
                'The WHO priority list [R5] names carbapenem-resistant <i>A. baumannii</i> and Enterobacterales, carbapenem-resistant <i>P. aeruginosa</i>, MRSA and vancomycin-resistant <i>E. faecium</i> ' + V + '. It does not list VRSA (removed in 2024). The list is a guide for what to watch; it sets no threshold.',
                'Intrinsic resistance is never counted [R1, Appendix B]. Susceptibility to the new glycopeptides, daptomycin and tigecycline is counted only when the laboratory entered a result.',
                'Ordering: VRSA, <i>C. auris</i>, PDR and Annex 1 phenotypes first; then other flagged isolates; then XDR only.',
                'An alert is a result to confirm and report, not an outbreak diagnosis.'])],

        // ------------------------------------------------------------------ 9
        ['rv_units', 'For reviewer: units, wards and specimen strata', () =>
            H('1. Unit scope') + L([
                'The unit filter (ALL, ICU, Non-ICU IP, Outpatient) applies to every chart. Records without a ward are excluded from every unit view and counted only in the data-quality measures, because CLSI M39 Section 11.1 (p. 29) requires a predetermined selection of patient types for each location-based report. The first isolate is chosen across all wards before the filter is applied, as stated in section 2 (CLSI M39 Section 6.4 and Appendix B: one isolate per patient, irrespective of body site; patient location is defined at the time the specimen is obtained, Section 3, and stratification by location is described in Section 11). The ICU wards are a <b>list set by the programme</b> in the control panel (default: ICU) ' + A + '.',
                'Stratification by location is allowed and encouraged by M39 when each subgroup has at least 30 isolates [R2, Section 11, p. 28; Appendix D, p. 49 (example of results by inpatient, outpatient and ICU location)].']) +
            H('2. Inpatient and outpatient classification') + T(['Ward text', 'Class'], [
                ['Outpatient, out-patient, OPD, clinic, ambulatory', 'Outpatient'],
                ['Emergency, casualty, ER, ED, accident', 'Outpatient (emergency visits are counted with outpatients)'],
                ['Empty or "unknown"', 'Unassigned (shown separately in the data-quality table)'],
                ['Any other ward', 'Inpatient']]) +
            P('This classification is an application policy ' + A + '. M39 lists "outpatient clinic" and "nursing home" among the possible locations [R2, Section 11.1, p. 28] without defining them.') +
            H('3. Specimen strata') + L([
                'Blood and urine analyses include only agents relevant to the infection, as recommended for specimen-specific reports [R2, Section 11.1, p. 29]; urine-only agents carry the &sect; flag when non-urine results are present.']) +
            H('4. ICU wards') + L([
                'M39 mentions "ICU" and "MICU" only [R2, Section 11.1]. Neonatal, paediatric and coronary intensive care units are not mentioned. By default only wards recorded as ICU count as ICU; the surveillance programme can add other wards. This is a decision of the application ' + A + '.']) +
            H('5. Settings and defaults') + L([
                'The MDR tab and every other tab follow the unit filter. The MDR tab keeps its own period picker (month, quarter, year, range, all).',
                'Each user can change seven settings on their own device (gear button): exclusion of possible contaminants (default off), default unit filter, Analytics period (default last 12 months), Last Year period (calendar year by default, or last 12 months), how a repeat patient (linked across years) is counted in a period that crosses New Year (once, the M39 first-isolate rule and the default, or once per calendar year; explained by an (i) pop-up; calendar-year views are not affected), showing organisms with fewer than 30 isolates in the Annual Report antibiogram (default off; shown as grey rows marked *, indicative only [R2, Section 7.2.2]) and the explanation notes. Nothing else can be changed by users; in particular the minimum of 30 isolates is fixed.',
                'The defaults for all users are set by the surveillance programme. A choice made on a device is kept only while it differs from the default, so a later change of the default reaches every user who did not choose otherwise.'])],

        // ------------------------------------------------------------------ 10
        ['rv_aware', 'For reviewer: WHO AWaRe classification', () =>
            L([
                '<b>Source:</b> WHO AWaRe classification of antibiotics for evaluation and monitoring of use, 2025 [R4]. The list supplied by the programme head was coded in the application.',
                '<b>Purpose in the application:</b> an informational tag (Access, Watch, Reserve) beside the antibiotic in the Analytics charts. It is shown so that a reader can see at a glance the stewardship category of each agent in the profile.',
                '<b>What it does not do:</b> AWaRe is a tool for monitoring antibiotic <b>use</b>. It is not a CLSI interpretive category and it does not enter any calculation: no percentage, indicator or classification depends on it.',
                '<b>Route-dependent agents:</b> fosfomycin and minocycline are not tagged (see the section on selective testing).',
                'Agents not in the WHO list carry no tag.'])],

        // ------------------------------------------------------------------ 11
        ['rv_quality', 'For reviewer: data quality and culture-burden metrics', () =>
            H('1. Data quality table (Annual Report tab)') + T(['Measure', 'Definition'], [
                ['Records in the period', 'All records dated in the period, excluding records without an organism.'],
                ['Screening cultures excluded', 'Records whose specimen is classed as screening.'],
                ['Repeat isolates removed', 'Clinical records minus first isolates.'],
                ['First isolates analysed', 'Isolates after de-duplication.'],
                ['With patient identifier, ward, specimen type, at least one AST result', 'Share of records with the field. A missing patient identifier prevents de-duplication; a missing ward prevents unit analysis.'],
                ['Enterobacterales tested for a carbapenem; for a 3rd-generation cephalosporin; <i>S. aureus</i> tested for cefoxitin or oxacillin; <i>Enterococcus</i> tested for vancomycin', 'Share of first isolates of the group with a result for at least one defining agent. It shows how much of the corresponding indicator is based on tested isolates.']]) +
            P('The purpose is to let the reader judge how far each indicator can be trusted. WHO GLASS and CLSI M39 both stress that surveillance estimates are only as reliable as the completeness and representativeness of the underlying data [R2, Section 9; R6].') +
            H('2. Culture burden') + L([
                'Monthly numbers of cultures received, with growth, without growth and contaminated, from the aggregate counts of the laboratory files.',
                '<b>Blood culture contamination rate</b> = blood cultures reported as contaminated / all blood cultures received. This denominator follows the CDC definition, "the number of contaminated cultures per number of blood cultures received by the laboratory" [R12] ' + W + '. CDC also defines a different measure, the false-positive rate, as contaminated cultures over positive cultures; it is not used here. M47-A does not state the denominator in the pages supplied; units vary between published studies.',
                'The reference value shown is <b>3% or less</b>. M47-A, Section 5.6: laboratories should validate that their process keeps contamination within an acceptable range, "typically &le; 3%" [R8] ' + V + '. Section 8: even with the best collection protocols it may not be possible to go below 2% [R8] ' + V + '. The 3% limit is traditional and its supporting data are described as controversial in the ASM review, where lower rates are said to be achievable.',
                'A month far below the others usually reflects an incomplete file and not a real fall in cultures.'])],

        // ------------------------------------------------------------------ 13
        ['rv_limits', 'For reviewer: known limitations and departures from the sources', () =>
            P('The following points are declared so that the reviewer can judge their effect. None of them is hidden in the results.') +
            T(['No.', 'Point', 'Effect', 'Handling'], [
                ['1', 'The edition of CLSI M39 reviewed is the 4th edition (M39-A4, 2014). A later edition exists and was not reviewed.', 'Recommendations may have been updated.', 'The reviewer should compare the sections cited here with the current edition.'],
                ['2', 'Linking the same patient across years depends on the confirmation of repeat patients. The laboratory number restarts every year, so unlinked records are identified by number, organism and calendar year. M39 Section 6.4 asks for the first isolate per patient per analysis period [R2, p. 10].', 'A patient with isolates in two calendar years of a 12-month period that crosses New Year is counted twice unless the person was linked. In the laboratory file used for validation (4,385 records, 2021 to 2026), 77% of patient numbers recurred in more than one year and none belonged to the same name, so the number cannot be used for linking. Linking by name found 41 probable repeat patients (102 records); counting them once changed the first-isolate total of a 12-month period by about 0.5%.', 'Each probable repeat patient is confirmed individually. Unconfirmed people stay unlinked. Blocks of 12 months start at the first month with data in the period, a choice of this application that M39 does not specify.'],
                ['3', 'Surrogate rule (cefoxitin for oxacillin) of M39 Section 6.5.1 is not applied; no separate MRSA-subset row.', 'S. aureus rows list the agents as recorded.', 'MRSA is reported as an indicator.'],
                ['4', 'The 90% selective-testing threshold comes from ACSQHC, not from CLSI.', 'A different threshold would change which agents are marked &dagger;.', 'Attributed to ACSQHC wherever it appears.'],
                ['5', 'The agent-level minimum of 30 tested results in the cumulative antibiogram is stricter than M39.', 'Some cells are blank that M39 would allow with a note.', 'Declared as application policy.'],
                ['6', 'Colour bands, the cluster rule (3 patients in 14 days), the alert list, and the inpatient/outpatient classification are conventions of the application.', 'They affect presentation and screening, not the stored data.', 'Declared in each section.'],
                ['7', 'No adjustment for multiple comparisons.', 'Some "significant" differences are expected by chance when many cells are compared.', 'Stated on the screen; advised by M39 Appendix H3.'],
                ['8', 'MDR, XDR and PDR rest on [R3], an interim expert proposal. Routine panels do not test all categories.', 'Confirmed XDR and PDR are minimum estimates; comparison with external studies is limited.', 'Validity condition stated; "possible" label used.'],
                ['9', 'Interpretive categories are those assigned by the laboratory. The application does not audit them.', 'Results follow the M100 edition used by the laboratory at the time of testing.', 'The laboratory should state the edition. Only staphylococcal vancomycin is re-derived.'],
                ['10', 'Laboratory flags (ESBL, carbapenemase, MRSA) are used as reported.', 'Their accuracy is that of the laboratory method.', 'Not inferred from susceptibility patterns.'],
                ['11', 'The blood culture contamination benchmark [R8] and the WHO priority categories [R5] were cited from published sources, not from documents supplied for this review.', 'Status C in the evidence map.', 'To be verified by the reviewer.'],
                ['12', 'The application has not been validated against a second, independent antibiogram software.', 'No external concordance figure is available.', 'A comparison on a sample of one quarter is recommended before formal adoption.']]) +
            TIP('Build information: AMR Tracker Dashboard, build 11.10, 6 November 2026. Documents checked: CLSI M100-Ed36 (2026), CLSI M39-A4 (2014), Magiorakos et al. (2012), ACSQHC Specification for a Hospital Cumulative Antibiogram (December 2019).')],

        // ------------------------------------------------------------------ 14
        ['rv_refs', 'For reviewer: references', () => {
            const keys = ['CLSI_M100', 'CLSI_M39', 'MAGIORAKOS', 'WHO_AWARE', 'WHO_BPPL', 'WHO_GLASS', 'ACSQHC', 'CLSI_M47', 'BROWN_WILSON', 'WHONET'];
            return P('Numbers [R1] to [R9] in the preceding sections refer to the first nine entries below in the order given in the first section. WHONET is the software from which the data are exported.') +
                (typeof refsHtml === 'function' ? refsHtml(keys, true) : '');
        }]
    ];

    window.GD_REVIEWER_SECTIONS = RV;
})();
