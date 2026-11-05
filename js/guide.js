// =====================================================================
// User guide: one collapsible page that explains every concept used in the dashboard.
// Opened from the information button at the top of the app. "About" is the last section.
// =====================================================================
(function () {
    const H = t => `<h4>${t}</h4>`;
    const P = t => `<p>${t}</p>`;
    const L = items => '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    const T = (head, rows) => `<div class="gd-tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const TIP = t => `<div class="gd-tip">${t}</div>`;

    const SECTIONS = [
        ['start', 'Start here: what this dashboard is for', () =>
            P('The AMR Tracker Dashboard turns the hospital\'s culture and susceptibility results into surveillance information: which organisms cause infection, how resistant they are, whether resistance is changing, and where the problems are.') +
            H('What it is used for') + L([
                'Choosing sensible <b>empirical antibiotic therapy</b> from local data (the cumulative antibiogram).',
                'Following <b>resistance trends</b> over months, quarters and years.',
                'Detecting <b>priority pathogens</b> and possible <b>clusters</b> early, so infection control can act.',
                'Supporting <b>antimicrobial stewardship</b> and national or WHO reporting.']) +
            H('Where the data come from') + L([
                'The microbiology laboratory exports its results from <b>WHONET</b> every month.',
                'The data-entry app cleans and checks them, then publishes a <b>de-identified</b> copy to the cloud. Names are removed and patient numbers are replaced by codes.',
                'This dashboard only reads that copy. It never shows patient names.']) +
            TIP('This is a surveillance tool. It describes populations of isolates, not individual patients. It does not replace the susceptibility report of a single culture or clinical judgement.')],

        ['tabs', 'The five tabs at a glance', () =>
            T(['Tab', 'Purpose', 'Typical question'], [
                ['<b>Analytics</b>', 'Free exploration of all data with filters.', 'How resistant is <i>K. pneumoniae</i> to meropenem in blood?'],
                ['<b>Last Year</b>', 'The annual report: the formal reference for the year.', 'What is our cumulative antibiogram and are we improving?'],
                ['<b>Last Quarter</b>', 'Medium-term trend and where resistance concentrates.', 'Is resistance rising over the last quarters? Which wards carry the burden?'],
                ['<b>Last Month</b>', 'Operational follow-up and alerts.', 'Did anything urgent happen this month?'],
                ['<b>Cultures</b>', 'Laboratory activity and blood culture quality.', 'How many cultures grew, and how many were contaminated?']]) +
            P('The month, quarter and year shown in the three "Last" tabs are chosen by the surveillance team, so everyone reads the same reporting period.')],

        ['tools', 'How to use the tools', () =>
            H('Moving around') + L([
                '<b>Bottom bar:</b> switches between Analytics, Last Year, Last Quarter, Last Month and Cultures.',
                '<b>Top bar:</b> (i) About, the open book is this Guide, the printer prints the open tab, and the green dot shows the live connection.',
                '<b>Unit scope</b> (All units, ICU, Non-ICU) filters everything on every tab.',
                '<b>Section headers</b> in Analytics open and close when tapped. Open only the one you need.']) +
            H('Choosing the data (Analytics)') + L([
                '<b>Time Period:</b> All Times, Last Year, Last Quarter or Last Month. Start with a wider period when numbers are small, because more isolates give more reliable percentages.',
                '<b>Specimen:</b> restricts to blood, urine, wound and so on. Resistance often differs by site, so choose the specimen that matches the patient\'s infection.',
                '<b>Ward (All, In, Out):</b> all patients, inpatients, or outpatients.',
                '<b>Bacteria or Antimicrobial:</b> the organism or the drug you want to examine.',
                '<b>% S, % R, % NS:</b> the metric. Use %S to see what works, %R to see how bad resistance is, and %NS when intermediate results should be treated as not reliable.',
                '<b>Hide n &lt; 30:</b> removes the unreliable (grey) bars.']) +
            H('Reading and exploring') + L([
                '<b>Tap a slice or a bar</b> to see the number tested and the 95% confidence interval.',
                '<b>Scroll sideways</b> in a wide chart to see all antibiotics.',
                '<b>Heatmap:</b> choose the months, specimen, several organisms and several antibiotics together. Leave organisms or antibiotics blank to include all.']) +
            H('Printing') + L([
                'Tap the <b>printer</b> at the top. A window lists every chart and table on the open tab; tick what you want.',
                'Choose paper, orientation and layout, and whether to include notes, references and data tables. You can add a title such as the hospital or department name.',
                'Tap <b>Preview</b> to see the exact document. If it is right, tap <b>Print / Save PDF</b>; otherwise go back and change the options.',
                'To keep a file, choose <b>Save as PDF</b> in the phone\'s print screen.']) +
            H('Connection') + P('The dashboard loads the latest published data when it opens. If the connection fails it shows the last data saved on the phone, and says so.')],

        ['concepts', 'Basic concepts you need first', () =>
            H('S, I, R and SDD') + L([
                '<b>S (susceptible):</b> the antibiotic is expected to work at the usual dose.',
                '<b>I (intermediate):</b> it may work at higher doses or at body sites where the drug concentrates.',
                '<b>SDD (susceptible-dose dependent):</b> it works only if a higher dose or more frequent dosing is used.',
                '<b>R (resistant):</b> the antibiotic is not expected to work.',
                '<b>NS (non-susceptible):</b> I, SDD and R together.']) +
            P('Results are interpreted with the <b>CLSI M100</b> breakpoints. The percentage <b>susceptible (%S)</b> counts only S, because I and SDD results are not reliable for treatment.') +
            H('First isolate (de-duplication)') + P('If one patient has the same organism in ten cultures, counting all ten would make that patient dominate the result and usually over-estimate resistance, because patients with long infections are sicker and have received more antibiotics.') +
            L(['CLSI M39 therefore counts only the <b>first isolate of each organism per patient</b> within the reported period.', 'In the month tab the period is the month, in the quarter tab the quarter, and in the year tab the year.', 'Screening cultures (rectal, nasal, axillary and groin swabs) are excluded because they look for carriage, not infection.']) +
            H('Why at least 30 isolates?') + P('A percentage calculated from a few isolates is unstable. For example, 2 resistant out of 4 is 50%, but the true value could be anywhere from about 15% to 85%. CLSI M39 recommends reporting a susceptibility percentage only when <b>30 or more isolates</b> were tested.') +
            L(['A bar or cell based on fewer than 30 isolates is faded grey and marked with <b>*</b>.', 'In tables, a dash means there were too few isolates to report a value.']) +
            H('Confidence interval (95% CI)') + P('The range in which the true percentage probably lies. A narrow interval means a precise estimate. It is calculated with the Wilson method, which is reliable for small numbers and for percentages near 0% or 100%. Tap a bar or point to see it.') +
            H('Statistical significance') + P('When two periods are compared, a difference is called significant only if a two-proportion z-test gives p below 0.05 and both groups have 30 or more tested isolates. Otherwise it is marked <b>ns</b> (not significant): the change may be due to chance.') +
            H('Selective testing (&dagger;)') + P('Some antibiotics are tested only when the first-line drugs fail. If an antibiotic was tested on fewer than half of the isolates, the tested isolates are probably the more resistant ones, so the resistance percentage may be too high. Such antibiotics are marked with <b>&dagger;</b>.') +
            H('Possible contaminants') + P('Organisms that normally live on the skin (coagulase-negative staphylococci such as <i>S. epidermidis</i> and <i>S. hominis</i>, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci) are often contaminants when found in blood. They are flagged, not deleted, because they can occasionally cause true infection.') +
            H('Intrinsic resistance') + P('Some organisms are naturally resistant to certain antibiotics (for example <i>Proteus</i> to colistin). These results are not counted as acquired resistance.')],

        ['terms', 'Clinical terms and why they matter', () =>
            P('Each term below is explained with its meaning and how a clinician or the antibiotic committee uses it.') +
            T(['Term', 'Meaning', 'Clinical use'], [
                ['<b>Prevalence</b> (organism prevalence)', 'The share of first isolates that each organism contributes in the chosen period, specimen and ward. For example, if 40 of 100 blood isolates are <i>K. pneumoniae</i>, its prevalence is 40%. It describes the cultured isolates, not the whole population.', 'Shows which organisms the empirical antibiotic must cover at each site. Frequent organisms deserve the first look; a change in the order suggests a change in the local infection pattern.'],
                ['<b>Susceptibility (% S)</b>', 'The share of tested isolates that are susceptible to an antibiotic.', 'The practical question before the culture result: "how likely is this drug to work?". Many guidelines accept an empirical drug when %S is high enough (often 80% or more, depending on infection severity).'],
                ['<b>Resistance (% R)</b>', 'The share of tested isolates that are resistant.', 'Measures the size of the problem and its trend. Rising %R for a key drug calls for review of use and infection-control measures.'],
                ['<b>Non-susceptibility (% NS)</b>', 'I, SDD and R together.', 'A stricter view: drugs whose non-susceptibility is high are poor empirical choices.'],
                ['<b>Antibiogram</b>', 'A table of % susceptible for each organism and antibiotic over a period (CLSI M39).', 'The local tool for choosing empirical therapy and for writing hospital treatment guidelines.'],
                ['<b>Empirical therapy</b>', 'Treatment started before the culture and susceptibility results are known.', 'Chosen from the antibiogram, the likely organisms (prevalence) and the infection site.'],
                ['<b>Targeted therapy and de-escalation</b>', 'Choosing, or narrowing to, the most suitable drug once results are known.', 'Reduces unnecessary broad-spectrum use. The AWaRe grouping helps to pick the narrowest effective antibiotic.'],
                ['<b>Isolate and culture</b>', 'An isolate is one organism grown from a specimen; a culture is one specimen sent to the laboratory.', 'Isolates are used for resistance statistics; cultures describe laboratory activity and quality.'],
                ['<b>Incidence</b>', 'New cases per population or per patient-days. The dashboard does <b>not</b> calculate it, because patient-days are not in the data.', 'Counts of resistant isolates alone are not incidence rates and should not be compared between wards of different size.'],
                ['<b>Breakpoint and MIC</b>', 'MIC is the lowest concentration of a drug that stops growth; the breakpoint is the cut-off that turns it into S, I or R (CLSI M100).', 'Explains why a result can change when the standard is updated, and why borderline MICs deserve care.'],
                ['<b>ESBL, carbapenemase, MRSA, VRE</b>', 'Resistance mechanisms or phenotypes (see the section on priority indicators).', 'They change treatment (for example carbapenems for ESBL) and require isolation precautions.'],
                ['<b>Antimicrobial stewardship</b>', 'A programme that promotes the right drug, dose, route and duration.', 'Uses these data to set hospital guidelines, audit prescribing and monitor the effect of interventions.'],
                ['<b>Inpatient and outpatient (In, Out)</b>', 'Patients who are admitted, and patients seen without admission.', 'Community-onset infections usually show less resistance than hospital-onset ones, so they are read separately.']])],

        ['standards', 'The standards behind the numbers: CLSI M100 and CLSI M39', () =>
            P('Two documents of the <b>Clinical and Laboratory Standards Institute (CLSI)</b>, an international non-profit standards organisation, define how results are <b>interpreted</b> (M100) and how they are <b>summarised</b> (M39). Almost every rule in this dashboard comes from one of them.') +
            H('CLSI M100: Performance Standards for Antimicrobial Susceptibility Testing') + L([
                '<b>What it is:</b> the reference that tells the laboratory how to turn a measurement (an MIC value or an inhibition-zone diameter) into <b>S, I, SDD or R</b>. These cut-off values are called <b>breakpoints</b>.',
                '<b>What else it contains:</b> which antibiotics to test and report for each organism group, quality-control ranges, special tests (for example cefoxitin to detect MRSA, and vancomycin MIC for staphylococci), and the list of intrinsic (natural) resistance.',
                '<b>Why it is needed:</b> without one shared standard, the same bacterium could be called susceptible in one laboratory and resistant in another. M100 makes results comparable between laboratories, hospitals and countries.',
                '<b>Why breakpoints change:</b> CLSI reviews them every year using new data on drug dosing, MIC distributions and clinical outcomes. For example, the carbapenem breakpoints for Enterobacterales were lowered to detect carbapenemase producers better. The laboratory should state which edition it uses, because a change of edition can change the percentages.',
                '<b>Where it is used here:</b> the S, I and R results imported from WHONET, the MRSA rule (cefoxitin), the VRSA rule (vancomycin MIC of 16 or more in <i>S. aureus</i>), the rule that staphylococcal vancomycin must be tested by MIC, and intrinsic resistance.']) +
            H('CLSI M39: Analysis and Presentation of Cumulative Antimicrobial Susceptibility Test Data') + L([
                '<b>What it is:</b> the guideline for building a <b>cumulative antibiogram</b>, the table of % susceptible for each organism and antibiotic that clinicians use to choose empirical therapy.',
                '<b>The main rules:</b>',
                '&nbsp;&nbsp;&bull; Count only the <b>first isolate per patient</b> for each organism in the analysis period, so a long-stay patient does not dominate the result.',
                '&nbsp;&nbsp;&bull; Report a percentage only when <b>30 or more isolates</b> were tested, because smaller numbers are statistically unstable.',
                '&nbsp;&nbsp;&bull; Count only <b>S</b> as susceptible; I and SDD are not counted.',
                '&nbsp;&nbsp;&bull; Exclude <b>screening or surveillance cultures</b>, which look for carriage rather than infection.',
                '&nbsp;&nbsp;&bull; Analyse at least <b>once a year</b>, and show important subgroups (such as ICU, or blood and urine) separately.',
                '<b>Why it is needed:</b> it removes the bias that raw laboratory counts carry (repeat cultures, tiny numbers, screening swabs), so that one hospital\'s antibiogram can be compared with another\'s and with its own earlier years.',
                '<b>Where it is used here:</b> first-isolate de-duplication, the minimum of 30, %S counting only S, the exclusion of screening cultures, the specimen buttons and ICU comparison, and the 30-isolate marking (* and hollow points) everywhere.']) +
            H('Why these two were chosen') + L([
                'They are the most widely used standards for hospital laboratories worldwide, and the WHO surveillance system (GLASS) and WHONET are built to work with them.',
                'M100 and M39 fit together: M100 decides the result of each isolate, and M39 decides how the isolates are counted.',
                'Using one recognised standard also makes the dashboard defensible when results are audited or shared with the Ministry or the WHO.']) +
            TIP('One deliberate adaptation: M39 is designed for a yearly analysis. The Last Year tab follows it exactly. The Last Quarter and Last Month tabs apply the same first-isolate rule within the quarter or month, for follow-up and early warning, so their percentages should be read as indicators, not as a formal antibiogram.')],

        ['marks', 'How to read the bars: colours and symbols', () =>
            P('The three antibiotic charts in the Analytics tab use the same key. It is shown under each chart.') +
            T(['Sign', 'Meaning', 'What to do'], [
                ['<span class="gd-sw gd-sw-solid"></span> Solid bar', '30 or more isolates were tested.', 'The result is reliable.'],
                ['<span class="gd-sw gd-sw-grey"></span> Faded grey bar, name ending with <b>*</b>', 'Fewer than 30 isolates were tested.', 'Interpret with caution. Use the switch "Hide n &lt; 30" to hide them.'],
                ['<b>&dagger;</b> after the antibiotic name', 'Selective test: tested on fewer than half of the isolates.', 'The percentage may be biased. The antibiotics concerned are listed under the chart key.'],
                ['<b>Tap a bar</b>', 'Shows the percentage, n (isolates tested) and the 95% CI. The bar height is always the selected percentage.', 'Use it to judge precision.']]) +
            H('In trend charts') + L(['A <b>hollow point</b> and a <b>dashed line</b> mean fewer than 30 isolates were tested in that period.', 'In tables, <b>*</b> beside a number carries the same meaning.']) +
            H('WHO AWaRe') + P('Antibiotics are grouped by the WHO into <b>Access</b> (first choice, low resistance risk), <b>Watch</b> (higher resistance potential, should be monitored) and <b>Reserve</b> (last resort). The group of each antibiotic shown is listed under the chart key.')],

        ['analytics', 'Analytics tab', () =>
            P('Use this tab to explore the data freely. Choose the period, specimen and ward, and every chart updates.') +
            H('Organism prevalence (pie chart)') + L(['<b>What:</b> the share of each organism among first isolates.', '<b>Why:</b> to know which organisms matter most locally, because empirical therapy must cover the common ones.', '<b>How to read:</b> a larger slice is a more frequent organism. Tap a slice to see its susceptibility profile.']) +
            H('Susceptibility profile of one organism') + L(['<b>What:</b> for one organism, the %S, %I or %R to each antibiotic.', '<b>Why:</b> to see which drugs still work against that organism.', '<b>How to read:</b> choose the metric, then read the bars from left to right. Check the key for * and &dagger;.']) +
            H('Activity of one antibiotic') + L(['<b>What:</b> for one antibiotic, the result against each organism.', '<b>Why:</b> to judge whether a drug is a good option across the organisms you meet.', '<b>How to read:</b> one bar per organism; compare organisms for the same drug.']) +
            H('Heatmap') + L(['<b>What:</b> organisms against antibiotics in one table; each cell is a percentage.', '<b>Why:</b> a single page overview of the whole antibiogram.', '<b>How to read:</b> green is the favourable end (a low %R or %NS, or a high %S) and red the unfavourable end. The colour key under the table shows the ranges. A * marks fewer than 30 tested.']) +
            H('MDR / XDR / PDR panel') + P('Explained in the section on multidrug resistance below.')],

        ['markers', 'Priority resistance indicators', () =>
            P('These indicators are the ones recommended by the WHO (GLASS and the Bacterial Priority Pathogens List) because they identify the resistance that is most dangerous or most difficult to treat. They appear in the Last Year, Last Quarter and Last Month tabs.') +
            T(['Indicator', 'Organisms', 'Definition'], [
                ['<b>3GC-R</b>', '<i>E. coli</i>, <i>K. pneumoniae</i>', 'Resistant to ceftriaxone, cefotaxime or ceftazidime. A practical marker for ESBL production.'],
                ['<b>ESBL</b>', '<i>E. coli</i>, <i>K. pneumoniae</i>', 'Extended-spectrum beta-lactamase confirmed by the laboratory.'],
                ['<b>CRE</b>', 'Enterobacterales', 'Carbapenem-resistant: resistant to ertapenem, meropenem, imipenem or doripenem. Imipenem is not used for <i>Proteus</i>, <i>Morganella</i> and <i>Providencia</i>, which are naturally less susceptible to it.'],
                ['<b>CPE</b>', 'Enterobacterales', 'Carbapenemase production confirmed by the laboratory.'],
                ['<b>CRAB</b>', '<i>A. baumannii</i>', 'Carbapenem-resistant <i>Acinetobacter baumannii</i>. WHO critical priority.'],
                ['<b>CRPA</b>', '<i>P. aeruginosa</i>', 'Carbapenem-resistant <i>Pseudomonas aeruginosa</i>. WHO high priority.'],
                ['<b>MRSA</b>', '<i>S. aureus</i>', 'Methicillin-resistant, decided by cefoxitin (CLSI). Oxacillin is used only when cefoxitin was not tested.'],
                ['<b>VRE</b>', 'Enterococcus', 'Vancomycin-resistant. Teicoplanin resistance alone does not count.'],
                ['<b>VRSA</b>', '<i>S. aureus</i>', 'Vancomycin MIC of 16 or more <b>and</b> confirmed by a reference laboratory. Unconfirmed isolates are shown as candidates only.']]) +
            TIP('The percentage is "resistant isolates / isolates tested for that drug", not a percentage of all isolates.')],

        ['mdr', 'Multidrug resistance: MDR, XDR and PDR', () =>
            P('A single resistant result does not show how limited the treatment options are. The international definitions of Magiorakos et al. (2012, ECDC and CDC) classify an isolate by how many antibiotic <b>categories</b> it resists.') +
            L(['<b>MDR:</b> non-susceptible to at least one agent in three or more categories.', '<b>XDR:</b> non-susceptible to at least one agent in all but two or fewer categories. Only one or two categories remain active.', '<b>PDR:</b> non-susceptible to all agents in all categories.']) +
            H('How it is applied here') + L(['Only first isolates of Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp. and <i>S. aureus</i> are classified.', 'Intrinsic resistance is excluded.', 'A category that was not tested is treated as unknown, not as resistant or susceptible. XDR and PDR are therefore conservative.', '<b>Possible XDR / PDR</b> means the panel was too narrow to confirm the class. These isolates are shown separately.', '<b>MDR+</b> means MDR, XDR or PDR together.']) +
            H('Why it matters') + P('MDR and above are the isolates that drive prolonged stay, higher cost and mortality, and that need isolation precautions.')],

        ['year', 'Last Year tab: the annual report', () =>
            P('This tab is the formal yearly report. The reference period is a full calendar year, as required by CLSI M39 for cumulative antibiograms and by WHO GLASS for reporting. The year is set by the surveillance team.') +
            H('1. Key resistance indicators') + L(['<b>Why:</b> they are the standard measures used to compare hospitals and countries.', '<b>How to read:</b> compare the percentage with the previous year; trust the change only when it is marked as significant.']) +
            H('2. Cumulative antibiogram') + L(['<b>Why:</b> it guides empirical treatment. It tells the prescriber, before the culture result, how likely a drug is to work.', '<b>How to read:</b> find the suspected organism in the row, then the drug in the column. Green 90% or more, yellow 70 to 89%, orange 50 to 69%, red below 50%.', '<b>Basis:</b> CLSI M39: one isolate per patient and organism per year, only S counted as susceptible, minimum 30 isolates.', '<b>Specimen buttons:</b> a blood and a urine isolate of the same organism may differ, so each specimen with 30 or more isolates can be viewed separately.', '<b>Contaminant switch:</b> removes skin-flora organisms from blood so they do not distort the table.']) +
            H('3. Quarterly trend') + L(['<b>Why:</b> to see whether resistance moved within the year.', '<b>How to read:</b> hollow points and dashed lines mean fewer than 30 isolates.']) +
            H('4. Antibiotic trend') + L(['<b>Why:</b> to follow one drug, for example meropenem, over the years or by quarter, for all organisms or one organism.', '<b>How to read:</b> choose the drug, the organism, the period and %R or %S. Tap a point for n and the confidence interval.']) +
            H('5. MDR / XDR / PDR by organism group') + L(['<b>Why:</b> it measures the burden of the most limited-option infections.', '<b>How to read:</b> "Any" is MDR, XDR and PDR together.']) +
            H('6. Culture burden') + L(['<b>Why:</b> resistance percentages mean little without knowing how many cultures were taken.', '<b>How to read:</b> check the blood culture contamination against the 3% benchmark.']) +
            H('7. Data quality') + L(['<b>Why:</b> an estimate is only as good as its data.', '<b>How to read:</b> low completeness means the indicators should be read with caution.'])],

        ['quarter', 'Last Quarter tab: trend and where the burden is', () =>
            P('A quarter has enough isolates to judge direction and to compare units, which a single month usually cannot.') +
            H('Trend over the last 8 quarters') + L(['<b>Why:</b> one quarter can be a fluctuation; a direction over several quarters is a real signal.', '<b>How to read:</b> follow each line. Hollow points mean fewer than 30 isolates. Tap a point for the confidence interval; overlapping intervals suggest no real change.']) +
            H('ICU compared with non-ICU') + L(['<b>Why:</b> ICUs have the sickest patients, the most antibiotic exposure and the most devices, so their resistance differs.', '<b>How to read:</b> compare the two columns. The last column marks a statistically significant difference.', '<b>Basis:</b> CLSI M39 supports stratifying results by location. The first isolate is chosen hospital-wide before the split.']) +
            H('Ward ranking') + L(['<b>Why:</b> to direct stewardship and infection control to the wards with the greatest burden.', '<b>How to read:</b> wards are ranked by the number of MDR, XDR or PDR isolates. Do not compare percentages based on fewer than 10 isolates.']) +
            H('MDR / XDR / PDR charts and watchlist') + P('The class distribution for the quarter, the wards with the most resistant isolates, and the pathogen chosen for special monitoring.')],

        ['month', 'Last Month tab: follow-up and alerts', () =>
            P('A month is too short for reliable percentages, so this tab is built for action, not for trend.') +
            H('Priority alerts') + L(['<b>Why:</b> some isolates need a response the same week.', '<b>What:</b> CRE, CRAB, CRPA, VRE, VRSA (and candidates), <i>Candida auris</i>, and XDR or PDR isolates, with date and ward.', '<b>What to do:</b> inform the infection control team; send VRSA candidates to a reference laboratory.']) +
            H('Possible clusters') + L(['<b>Why:</b> outbreaks are recognised earlier when the same organism and resistance type appear repeatedly in one ward.', '<b>Rule:</b> three or more different patients, same ward, same organism and same resistance type, within 14 days.', '<b>Caution:</b> this is a signal, not proof. Confirm with the infection control team.']) +
            H('Comparison with earlier periods') + L(['<b>Why:</b> to put the month in context.', '<b>How to read:</b> compare with the previous month and the same month last year. Numbers are shown as counts: do not read a trend into one month.']) +
            H('Blood isolates: possible contaminants') + P('The share of blood isolates that are usual skin organisms. A high share points to a sampling problem. The formal benchmark is in the Cultures tab.')],

        ['cultures', 'Cultures tab: laboratory activity and quality', () =>
            P('Describes how many cultures the laboratory received and what they grew. The numbers are aggregate counts, not patient records.') +
            L(['<b>Positive:</b> an organism was reported. <b>No growth:</b> nothing grew. <b>Contaminated:</b> reported as contaminated by the laboratory.', '<b>Volume per month:</b> workload. A very low month usually means an incomplete file.', '<b>Positivity by ward and specimen:</b> depends on case mix and on how often cultures are taken.']) +
            H('Blood culture contamination') + L(['<b>Benchmark:</b> 3% or less of blood cultures (CLSI M47).', '<b>Reported as contaminated:</b> certain.', '<b>Possible skin-flora growth:</b> uncertain, because these organisms can also cause true infection.', '<b>Upper estimate:</b> the two added together. The real rate lies between the reported figure and the estimate.']) +
            H('Why it matters') + P('Contaminated blood cultures lead to unnecessary antibiotics, longer stay and cost. The rate is a quality indicator for blood collection.')],

        ['scope', 'Unit scope and ICU', () =>
            P('The switch under the top bar filters <b>every chart and table on every tab</b> by the ward where the specimen was collected.') +
            H('The three options') + L([
                '<b>All units:</b> every ward, including outpatients.',
                '<b>ICU:</b> only the wards counted as intensive care units. The surveillance team chooses which wards count as ICU.',
                '<b>Non-ICU:</b> all other wards, including outpatients and neonatal units.']) +
            H('Why ICU is shown separately') + P('Antimicrobial use, invasive devices and patient risk differ between intensive care and other wards, so a pooled result can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.') +
            H('How it is applied') + L([
                'The first isolate per patient and organism is chosen across all wards first, and the ward filter is applied afterwards. A patient who moves between wards is therefore not counted twice.',
                'The Last Quarter ICU comparison always shows both units, whatever the switch is set to.',
                'The switch may be hidden by the surveillance team; in that case the dashboard opens on the chosen default scope.'])],

        ['install', 'Install the app on your phone', () =>
            P('Installing gives a home-screen icon, full-screen use and faster opening, and the app can open the last saved data when the connection is weak.') +
            H('iPhone (Safari only)') + L(['Open the dashboard link in <b>Safari</b>.', 'Tap the <b>Share</b> button at the bottom of the screen.', 'Choose <b>Add to Home Screen</b>.']) +
            H('Android (Chrome)') + L(['Open the dashboard link in <b>Chrome</b>.', 'Tap the menu (three dots) at the top of the screen.', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.']) +
            TIP('If an older version of the app is already installed and looks different, remove it from the home screen and install it again.')],

        ['limits', 'Limits and good practice', () =>
            L(['<b>Small numbers:</b> do not draw conclusions from fewer than 30 isolates.', '<b>Surveillance is not a patient report:</b> use the susceptibility report of the patient\'s own culture for treatment.', '<b>Sampling bias:</b> cultures are usually taken from sicker patients or after treatment failure, so resistance in the hospital may look higher than in all patients.', '<b>Data quality:</b> missing patient numbers prevent de-duplication; missing results lower the numbers tested.', '<b>One period at a time:</b> compare like with like (same period length, same unit, same specimen).', '<b>Unconfirmed results:</b> VRSA candidates, possible XDR and possible contaminants need confirmation before action beyond precaution.'])],

        ['glossary', 'Glossary', () =>
            T(['Term', 'Meaning'], [
                ['AMR', 'Antimicrobial resistance.'], ['ASP', 'Antimicrobial stewardship programme.'], ['AST', 'Antimicrobial susceptibility testing.'],
                ['AWaRe', 'WHO grouping of antibiotics: Access, Watch, Reserve.'], ['CI', 'Confidence interval.'],
                ['CLSI', 'Clinical and Laboratory Standards Institute: publishes the breakpoints (M100) and the rules for antibiograms (M39).'],
                ['GLASS', 'WHO Global Antimicrobial Resistance and Use Surveillance System.'], ['MIC', 'Minimum inhibitory concentration: the lowest drug concentration that stops growth.'],
                ['n', 'Number of isolates (or cultures) tested.'], ['ns', 'Not statistically significant.'], ['pp', 'Percentage points: the difference between two percentages.'],
                ['WHONET', 'Free WHO software used by laboratories to record and analyse susceptibility data.'], ['ESBL', 'Extended-spectrum beta-lactamase.']])],

        ['refs', 'References', () => {
            const keys = ['CLSI_M39', 'CLSI_M100', 'CLSI_M47', 'MAGIORAKOS', 'WHO_GLASS', 'WHO_BPPL', 'WHO_AWARE', 'WHONET', 'ASM_BCC'];
            return P('The rules used in this dashboard come from the following sources.') + (typeof refsHtml === 'function' ? refsHtml(keys, true) : '');
        }],

        ['about', 'About', () => window.aboutHtml()]
    ];

    window.aboutHtml = function () {
        const chip = t => `<span class="gd-chip">${t}</span>`;
        const org = (n, d) => `<div class="gd-org"><div class="gd-org-n">${n}</div><div class="gd-org-d">${d}</div></div>`;
        return `
            <div class="gd-about">
                <div class="gd-logo"><img src="icon.png" alt="AMR Tracker"></div>
                <h3>AMR Tracker Dashboard</h3>
                <p class="gd-sub">Antimicrobial Resistance Surveillance System</p>
                <div class="gd-card">
                    <div class="gd-card-t">Concept, design and development</div>
                    <div class="gd-person">Saad Al Hamady</div>
                    <div class="gd-line">Clinical Pharmacist</div>
                    <div class="gd-line">Member, Antibiotic Committee</div>
                    <div class="gd-line">Head of Antibiogram Program</div>
                    <div class="gd-hosp">Al-Mawani Teaching Hospital</div>
                    <div class="gd-chips">${chip('Concept')}${chip('Design')}${chip('Development')}${chip('Laboratory data analysis')}</div>
                </div>
                <div class="gd-card">
                    <div class="gd-card-t">Data and scientific collaboration</div>
                    ${org('Microbiology Laboratory', 'Culture and susceptibility data')}
                    ${org('AMR Unit', 'Coordination with the laboratory')}
                </div>
                <div class="gd-legal"><b>Legal notice:</b> This tool supports epidemiological surveillance and the generation of accurate clinical statistics. All intellectual and software rights reserved &copy; 2026.</div>
            </div>`;
    };

    function build() {
        const items = SECTIONS.map(([id, title, body], i) => `
            <details class="gd-sec" data-id="${id}">
                <summary><span class="gd-num">${id === 'about' ? '' : (i + 1)}</span><span class="gd-t">${title}</span></summary>
                <div class="gd-body">${body()}</div>
            </details>`).join('');
        return `
            <div class="gd-bar">
                <div><div class="gd-title">Guide</div><div class="gd-subtitle">How to read this dashboard</div></div>
                <div class="gd-actions"><button type="button" id="gdToggle">Expand all</button><button type="button" id="gdClose" aria-label="Close the guide">&times;</button></div>
            </div>
            <div class="gd-scroll">
                <p class="gd-intro">Tap a section to open it. Each section explains what a chart or concept is, why it is used, how to read it, and on what rule it is based.</p>
                ${items}
            </div>`;
    }

    window.showGuide = function () {
        let el = document.getElementById('guideView');
        if (!el) { el = document.createElement('div'); el.id = 'guideView'; document.body.appendChild(el); }
        el.innerHTML = build();
        el.classList.add('open');
        document.body.classList.add('gd-lock');
        const close = () => { el.classList.remove('open'); document.body.classList.remove('gd-lock'); };
        el.querySelector('#gdClose').onclick = close;
        const tg = el.querySelector('#gdToggle');
        tg.onclick = () => {
            const all = el.querySelectorAll('details.gd-sec'), anyClosed = Array.from(all).some(d => !d.open);
            all.forEach(d => { d.open = anyClosed; });
            tg.textContent = anyClosed ? 'Collapse all' : 'Expand all';
        };
        el.querySelector('.gd-scroll').scrollTop = 0;
    };
    window.hideGuide = function () { const el = document.getElementById('guideView'); if (el) el.classList.remove('open'); document.body.classList.remove('gd-lock'); };
})();
