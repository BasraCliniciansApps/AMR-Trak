// =====================================================================
// User guide: one collapsible page that explains every concept used in the dashboard.
// Opened from the information button at the top of the app. "About" is the last section.
// =====================================================================
(function () {
    const H = t => `<h4>${t}</h4>`;
    const P = t => (typeof splitHints === 'function' && splitHints(t).length > 1) ? hintsHtml([t]) : `<p>${t}</p>`;
    const L = items => '<ul>' + [].concat.apply([], items.map(i => typeof splitHints === 'function' ? splitHints(i) : [i])).map(i => `<li>${i}</li>`).join('') + '</ul>';
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
                'The data are cleaned and checked, then a <b>de-identified</b> copy is published to the cloud. Names are removed and patient numbers are replaced by codes.',
                'This dashboard only reads that copy. It never shows patient names.']) +
            TIP('This is a surveillance tool. It describes populations of isolates, not individual patients. It does not replace the susceptibility report of a single culture or clinical judgement.')],

        ['tabs', 'The five tabs at a glance', () =>
            T(['Tab', 'Purpose', 'Typical question'], [
                ['<b>Analytics</b>', 'Free exploration of all data with filters.', 'How resistant is <i>K. pneumoniae</i> to meropenem in blood?'],
                ['<b>Annual Report</b>', 'The annual report: the formal reference for the year.', 'What is our cumulative antibiogram and are we improving?'],
                ['<b>Monthly Alerts</b>', 'Alerts for the latest month: results that need confirmation or reporting.', 'Did anything urgent happen this month?'],
                ['<b>MDR</b>', 'Multidrug-resistant isolates (MDR, XDR, PDR) and where they concentrate.', 'How many isolates have very few treatment options, and in which wards?'],
                ['<b>Cultures</b>', 'Laboratory activity and blood culture quality.', 'How many cultures grew, and how many were contaminated?']]) +
            P('The Monthly Alerts and Annual Report tabs end automatically at the latest month that has data, so everyone reads the same reporting period. The Annual Report tab can use the last 12 months or the last complete calendar year; this is chosen in Settings (gear button).')],

        ['tools', 'How to use the tools', () =>
            H('Moving around') + L([
                '<b>Bottom bar:</b> switches between Analytics, Annual Report, Monthly Alerts, MDR and Cultures. The open tab is raised and underlined.',
                '<b>Top bar:</b> the AMR Trak name with the green live-connection dot, then (i) About, the open book (this Guide), the printer (prints the open tab) and the gear (Settings).',
                '<b>Unit filter</b> (ALL, ICU, Non-ICU IP, Outpatient) filters everything on every tab.',
                '<b>Section headers</b> in Analytics open and close when tapped. Open only the one you need.']) +
            H('Choosing the data (Analytics)') + L([
                '<b>Analysis period:</b> one period for every Analytics chart, set in Settings (gear button): Last 12 Months (default), All completed years (consecutive complete years only), All times (every month available, may be less accurate), Calendar year, Last 3 Months, Last Month or a specific period. The Heatmap From/To fields, when filled, override it. Start with a wider period when numbers are small, because more isolates give more reliable percentages.',
                '<b>Specimen:</b> restricts to blood, urine, wound and so on. Resistance often differs by site, so choose the specimen that matches the patient\'s infection.',
                '<b>Unit:</b> the buttons at the top of the page (ALL, ICU, Non-ICU IP, Outpatient) apply to every chart. See the section on unit scope.',
                '<b>Bacteria or Antimicrobial:</b> the organism or the drug you want to examine.',
                '<b>% S, % R, % NS:</b> the metric. Use %S to see what works, %R to see how bad resistance is, and %NS when intermediate results should be treated as not reliable.',
                '<b>Hide n &lt; 30:</b> a tick box in each chart. It removes the unreliable (grey) bars or cells from that chart only.']) +
            H('Settings (gear button)') + L([
                '<b>Exclude possible skin-flora contaminants:</b> off by default. When on, blood isolates of skin-flora organisms are removed before the first isolate is chosen, on every tab.',
                '<b>Default unit filter:</b> the unit selected when the dashboard opens.',
                '<b>Analysis period (Analytics tab):</b> Last 12 Months, All completed years, All times, Calendar year, Last 3 Months, Last Month or a specific period.',
                '<b>Annual Report tab period:</b> last 12 months or calendar year.',
                '<b>Repeat patient in a period that crosses New Year:</b> only for periods that cross New Year (for example Last 12 Months), and for patients confirmed as the same person across years. Count once (first isolate only, the CLSI M39 rule, default) or count once in each calendar year (two isolates). Calendar-year views are not affected. Tap the (i) button next to it for the explanation.',
                '<b>Show organisms with fewer than 30 isolates:</b> off by default (this device only). When on, the Annual Report antibiogram also lists those organisms as grey rows marked * (indicative only).',
                '<b>Show explanation notes under charts:</b> hides or shows the notes and chart keys. Warnings stay.',
                'Your choices are saved on this device only. The defaults for everyone are set by the surveillance programme. <b>Reset to defaults</b> returns this device to them.']) +
            H('Reading and exploring') + L([
                '<b>Tap a slice or a bar</b> to see the number tested and the 95% confidence interval.',
                '<b>Scroll sideways</b> in a wide chart to see all antibiotics.',
                '<b>Heatmap:</b> choose the months, specimen, several organisms and several antibiotics together. Leave organisms or antibiotics blank to include all.']) +
            H('Printing') + L([
                'Tap the <b>printer</b> at the top. A window lists every chart and table on the open tab; tick what you want.',
                'Choose paper, orientation and layout, and whether to include notes, references and data tables. You can add a title such as the hospital or department name. The printed page starts with a box that lists the filters in force (unit, period, contaminants, minimum isolates, data date). Charts and tables are centred, small ones are placed side by side, and the chart key lists only the symbols that appear.',
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
            H('If there are fewer than 30 isolates') + L(['CLSI M39 allows combining several years when the numbers per year are small and the %S has not changed much.', 'Use the Analytics period in Settings (All time, or a date range).', 'Each patient is counted once per 12-month block of the period (patients confirmed as the same person across years; others per calendar year).', 'The report should state that the data are combined; the banner under the charts shows the period.', 'Do not combine years if resistance changed a lot; look at the yearly trend first.']) +
                        H('Statistical significance') + P('When two periods are compared, a difference is called significant only if a two-proportion z-test gives p below 0.05 and both groups have 30 or more tested isolates. Otherwise it is marked <b>ns</b> (not significant): the change may be due to chance.') +
            H('Selective testing (&dagger;)') + P('Some antibiotics are tested only when the first-line drugs fail. If an antibiotic was tested on fewer than 90% of the isolates, the tested isolates are probably the more resistant ones, so the resistance percentage may be too high. Such antibiotics are marked with <b>&dagger;</b>. CLSI M39 (Section 6.5.3) says agents tested selectively should not be included in the routine cumulative report, because they are biased toward lower susceptibility. M39 does not give a percentage cut-off. The 90% used here follows the ACSQHC cumulative antibiogram specification. In the annual cumulative table such cells show &dagger; instead of a percentage.') +
            H('Possible contaminants') + P('Organisms that normally live on the skin (coagulase-negative staphylococci such as <i>S. epidermidis</i> and <i>S. hominis</i>, <i>Corynebacterium</i>, <i>Micrococcus</i>, viridans streptococci) are often contaminants when found in blood. They are flagged, not deleted, because they can occasionally cause true infection. In Settings you can choose to exclude them from every analysis (off by default).') +
            H('Intrinsic resistance') + P('Some organisms are naturally resistant to certain antibiotics (for example <i>Proteus</i> to colistin). These results are not counted as acquired resistance.')],

        ['terms', 'Clinical terms and why they matter', () =>
            P('Each term below is explained with its meaning and how a clinician or the antibiotic committee uses it.') +
            T(['Term', 'Meaning', 'Clinical use'], [
                ['<b>Prevalence</b> (organism prevalence)', 'The share of first isolates that each organism contributes in the chosen period, specimen and ward. For example, if 40 of 100 blood isolates are <i>K. pneumoniae</i>, its prevalence is 40%. It describes the cultured isolates, not the whole population.', 'Shows which organisms the empirical antibiotic must cover at each site. Frequent organisms deserve the first look; a change in the order suggests a change in the local infection pattern.'],
                ['<b>Susceptibility (% S)</b>', 'The share of tested isolates that are susceptible to an antibiotic.', 'The practical question before the culture result: "how likely is this drug to work?". Many guidelines accept an empirical drug when %S is high enough (often 80% or more, depending on infection severity).'],
                ['<b>Resistance (% R)</b>', 'The share of tested isolates that are resistant.', 'Measures the size of the problem and its trend. Rising %R for a key drug calls for review of use and infection-control measures.'],
                ['<b>Non-susceptibility (% NS)</b>', 'All non-susceptible results: SDD, I and R together. A grouping used for analysis, not a CLSI category.', 'A stricter view: drugs whose non-susceptibility is high are poor empirical choices.'],
                ['<b>Antibiogram</b>', 'A table of % susceptible for each organism and antibiotic over a period (CLSI M39).', 'The local tool for choosing empirical therapy and for writing hospital treatment guidelines.'],
                ['<b>Empirical therapy</b>', 'Treatment started before the culture and susceptibility results are known.', 'Chosen from the antibiogram, the likely organisms (prevalence) and the infection site.'],
                ['<b>Targeted therapy and de-escalation</b>', 'Choosing, or narrowing to, the most suitable drug once results are known.', 'Reduces unnecessary broad-spectrum use. The AWaRe grouping helps to pick the narrowest effective antibiotic.'],
                ['<b>Isolate and culture</b>', 'An isolate is one organism grown from a specimen; a culture is one specimen sent to the laboratory.', 'Isolates are used for resistance statistics; cultures describe laboratory activity and quality.'],
                ['<b>Incidence</b>', 'New cases per population or per patient-days. The dashboard does <b>not</b> calculate it, because patient-days are not in the data.', 'Counts of resistant isolates alone are not incidence rates and should not be compared between wards of different size.'],
                ['<b>Breakpoint and MIC</b>', 'MIC is the lowest concentration of a drug that stops growth; the breakpoint is the cut-off that turns it into S, I or R (CLSI M100).', 'Explains why a result can change when the standard is updated, and why borderline MICs deserve care.'],
                ['<b>ESBL, carbapenemase, MRSA, VRE</b>', 'Resistance mechanisms or phenotypes (see the section on priority indicators).', 'They change treatment (for example carbapenems for ESBL) and require isolation precautions.'],
                ['<b>Antimicrobial stewardship</b>', 'A programme that promotes the right drug, dose, route and duration.', 'Uses these data to set hospital guidelines, audit prescribing and monitor the effect of interventions.'],
                ['<b>Inpatient and outpatient</b>', 'Patients who are admitted, and patients seen without admission (the emergency department is counted with outpatients).', 'Community-onset infections usually show less resistance than hospital-onset ones, so they are read separately.']])],

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
            TIP('One deliberate adaptation: M39 is designed for a yearly analysis. The Annual Report tab follows it (a 12-month analysis period). The Monthly Alerts tab does not report resistance percentages; it lists isolates that need confirmation or reporting.')],

        ['marks', 'How to read the bars: colours and symbols', () =>
            P('The three antibiotic charts in the Analytics tab use the same key. It is shown under each chart and lists only the signs that appear in that chart.') +
            T(['Sign', 'Meaning', 'What to do'], [
                ['<span class="gd-sw gd-sw-solid"></span> Solid bar', '30 or more isolates were tested.', 'The result is reliable.'],
                ['<span class="gd-sw gd-sw-grey"></span> Faded grey bar, name ending with <b>*</b>', 'Fewer than 30 isolates were tested.', 'Interpret with caution. Use the tick box "Hide n &lt; 30" to hide them.'],
                ['<b>&dagger;</b> after the antibiotic name', 'Selective test: tested on fewer than 90% of the isolates.', 'The percentage may be biased. The antibiotics concerned are listed under the chart key.'],
                ['<b>&Dagger;</b> after the antibiotic or organism name', 'Intrinsic resistance (CLSI M100-Ed36 Appendix B): resistance is expected for this organism.', 'Do not read it as acquired resistance. A note under the chart lists the antibiotics concerned. In tables, such cells show &Dagger; instead of a percentage.'],
                ['<b>Tap a bar</b>', 'Shows the percentage, n (isolates tested) and the 95% CI. The bar height is always the selected percentage.', 'Use it to judge precision.']]) +
            H('In trend charts') + L(['A <b>hollow point</b> and a <b>dashed line</b> mean fewer than 30 isolates were tested in that period.', 'In tables, <b>*</b> beside a number carries the same meaning.']) +
            H('WHO AWaRe') + P('Antibiotics are grouped by the WHO into <b>Access</b> (first choice, low resistance risk), <b>Watch</b> (higher resistance potential, should be monitored) and <b>Reserve</b> (last resort). The group of each antibiotic shown is listed under the chart key. The grouping (WHO 2025 list) guides antibiotic <b>use</b> and stewardship: prefer Access, restrict Watch, keep Reserve for resistant infections. It is not a susceptibility result and not a CLSI category.') +
            H('Urine-only antibiotics') + P('CLSI M100-Ed36 marks nitrofurantoin, fosfomycin, mecillinam, norfloxacin, nalidixic acid, sulfonamides and trimethoprim (and amikacin for <i>P. aeruginosa</i>) as <b>urine only</b>: they are reported only on isolates from the urinary tract. M100 explains that nitrofurantoin is effective in uncomplicated urinary tract infections only. Results from other specimens are <b>kept</b> in the charts, but they are marked with <b>&sect;</b> and a note gives how many come from non-urine specimens, so the clinician can judge them.')],

        ['analytics', 'Analytics tab', () =>
            P('Use this tab to explore the data freely. Choose the specimen in each chart; the unit buttons at the top and the period in Settings apply to every chart.') +
            H('Organism prevalence (pie chart)') + L(['<b>What:</b> the share of each organism among first isolates.', '<b>Why:</b> to know which organisms matter most locally, because empirical therapy must cover the common ones.', '<b>How to read:</b> a larger slice is a more frequent organism. Tap a slice to see its susceptibility profile.']) +
            H('Susceptibility profile of one organism') + L(['<b>What:</b> for one organism, the %S, %I or %R to each antibiotic.', '<b>Why:</b> to see which drugs still work against that organism.', '<b>How to read:</b> choose the metric, then read the bars from left to right. Check the key for * and &dagger;.']) +
            H('Activity of one antibiotic') + L(['<b>What:</b> for one antibiotic, the result against each organism.', '<b>Why:</b> to judge whether a drug is a good option across the organisms you meet.', '<b>How to read:</b> one bar per organism; compare organisms for the same drug.']) +
            H('Heatmap') + L(['<b>What:</b> organisms against antibiotics in one table; each cell is a percentage.', '<b>Why:</b> a single page overview of the whole antibiogram.', '<b>How to read:</b> green is the favourable end (a low %R or %NS, or a high %S) and red the unfavourable end. The colours follow the same three bands as the antibiogram (green 80% or more susceptible, amber 50-79%, red below 50%); the key under the table shows them for the metric you chose. A * marks fewer than 30 tested.']) +
            H('MDR / XDR / PDR') + P('This analysis has its own tab (MDR). It is explained in the section on multidrug resistance below.')],

        ['markers', 'Priority resistance indicators', () =>
            P('These indicators are the ones recommended by the WHO (GLASS and the Bacterial Priority Pathogens List) because they identify the resistance that is most dangerous or most difficult to treat. They appear in the Last Year, Last 3 Months and Last Month tabs.') +
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
            H('How it is applied here') + L(['Only first isolates of Enterobacterales, <i>P. aeruginosa</i>, <i>Acinetobacter</i> spp., <i>S. aureus</i> and <i>Enterococcus</i> spp. are classified.', 'Every MRSA isolate is classified as MDR (Magiorakos 2012, Table 6), because oxacillin or cefoxitin resistance predicts non-susceptibility to all beta-lactam categories except the anti-MRSA cephalosporins.', 'An agent (or whole category) to which the species is intrinsically resistant is removed before counting (Magiorakos 2012; intrinsic resistance from CLSI M100-Ed36).', 'A category is counted by its class: any agent of the same class can show non-susceptibility. Some lists are wider than the tables of Magiorakos 2012 (for example levofloxacin with ciprofloxacin). The reviewer guide lists the differences.', 'Validity condition (Magiorakos 2012): the XDR and PDR definitions are valid only when isolates were tested against all or nearly all agents of each category and selective reporting or suppression of results was avoided. With incomplete testing an isolate can only be called possible XDR or possible PDR, and such results should not be compared with confirmed XDR or PDR from other studies.', 'Intrinsic resistance is excluded.', 'A category that was not tested is treated as unknown, not as resistant or susceptible. XDR and PDR are therefore conservative.', '<b>Possible XDR / PDR</b> (Magiorakos 2012) means the isolate is MDR, fewer than 3 susceptible categories were found, and the untested categories could still make it XDR (or PDR). XDR is ruled out only when 3 or more categories are susceptible. These isolates are counted as MDR and shown separately.', '<b>MDR+</b> means MDR, XDR or PDR together.']) +
            H('Small numbers (n &lt; 30)') + L(['A small n does not change whether an isolate is MDR, XDR or PDR; it makes the percentage unstable.', 'The 95% CI (Wilson) is shown under the MDR+ and XDR+ percentages; a wide CI means an imprecise figure.', '<b>*</b> marks wards, months and groups with fewer than 30 isolates.', 'CLSI M39 sets no separate n rule for MDR; the 30-isolate rule and CIs come from its general sections.', 'Choose a longer period in Settings to get more isolates.']) +
                        H('Why it matters') + P('MDR and above are the isolates that drive prolonged stay, higher cost and mortality, and that need isolation precautions.')],

        ['year', 'Annual Report tab: the annual report', () =>
            P('This tab is the formal yearly report. By default the analysis period is the last complete <b>calendar year</b> (easier to compare between reports). CLSI M39 asks for an analysis at least annually (Section 6.3) with an analysis period of, for example, one year (Section 6.4); it does not require a fixed calendar year. In Settings (gear button) you can choose the <b>latest 12 months with data</b> instead (for example Oct 2025 to Sep 2026), which moves forward whenever newer data are loaded; the tab always says which period it shows. Everything on the tab follows the chosen period. A warning is shown if a month in the period has no data.') +
            H('1. Key resistance indicators') + L(['<b>Why:</b> they are the standard measures used to compare hospitals and countries.', '<b>How to read:</b> compare the percentage with the previous year; trust the change only when it is marked as significant.']) +
            H('2. ICU compared with non-ICU') + L(['<b>Why:</b> ICU patients are sicker and more exposed to antibiotics, so a pooled annual figure can hide an ICU problem.', '<b>How to read:</b> the first table compares the priority indicators; the second compares the susceptibility of each main organism. The last column is ICU minus non-ICU in percentage points; it is marked as significant only when both groups have 30 or more tested.', '<b>Basis:</b> CLSI M39 supports stratifying by location. The first isolate of the year is chosen across all wards before the split.']) +
            H('3. Cumulative antibiogram') + L(['<b>Why:</b> it guides empirical treatment. It tells the prescriber, before the culture result, how likely a drug is to work.', '<b>How to read:</b> find the suspected organism in the row, then the drug in the column. Colours are an application convention, not a WHO reference and not a treatment guide: green 80% or more, amber 50-79%, red below 50%. The 80% level reflects common practice for empirical use in non-severe infection; a higher local threshold applies to severe infection. WHO does not provide a reference for these colours. The Guide (For reviewer, section 5) gives the reasons.', '<b>Basis:</b> CLSI M39: one isolate per patient and organism per year, only S counted as susceptible, minimum 30 isolates.', '<b>Specimen buttons:</b> a blood and a urine isolate of the same organism may differ, so each specimen with 30 or more isolates can be viewed separately.', '<b>Contaminant switch:</b> removes skin-flora organisms from blood so they do not distort the table.']) +
            H('4. Quarterly trend') + L(['<b>Why:</b> to see whether resistance moved within the year.', '<b>How to read:</b> hollow points and dashed lines mean fewer than 30 isolates.']) +
            H('5. Antibiotic trend') + L(['<b>Why:</b> to follow one drug, for example meropenem, over the years or by quarter, for all organisms or one organism.', '<b>How to read:</b> choose the drug, the organism, the period and %R or %S. Tap a point for n and the confidence interval.']) +
            H('6. MDR / XDR / PDR by organism group') + L(['<b>Why:</b> it measures the burden of the most limited-option infections.', '<b>How to read:</b> "Any" is MDR, XDR and PDR together.']) +
            H('7. Culture burden') + L(['<b>Why:</b> resistance percentages mean little without knowing how many cultures were taken.', '<b>How to read:</b> check the blood culture contamination against the 3% benchmark.']) +
            H('8. Data quality') + L(['<b>Why:</b> an estimate is only as good as its data.', '<b>How to read:</b> low completeness means the indicators should be read with caution.', 'Every line of this card is explained in the next section, <b>Data quality metrics explained</b>.'])],

        ['dq', 'Data quality metrics explained (Annual Report tab)', () =>
            P('At the bottom of the Annual Report tab is a <b>Data quality</b> card. It does not describe bacteria. It describes <b>how good the data are</b> that everything else is built on. A beautiful chart made from incomplete data can mislead, so these lines tell you how far you can trust the report. If you are new to surveillance, read this section once.') +
            TIP('These lines follow the unit switch at the top (All units, ICU, Non-ICU), like the rest of the tab.') +
            H('Part 1. How the records are counted') +
            P('The first four lines are a small funnel. Each line is smaller than, or equal to, the one before it. A worked example: <b>290</b> records, <b>0</b> screening cultures, <b>2</b> repeats, leaving <b>288</b> first isolates.') +
            T(['Line', 'What it means', 'Why it matters'], [
                ['<b>Records in the year</b>', 'Every result line dated in the selected year that has a real organism. Lines labelled no growth, contaminated, normal flora or mixed flora are not counted.', 'This is the starting size of the data for the year.'],
                ['<b>Screening cultures excluded</b>', 'Swabs taken to look for <i>carriage</i> of a resistant organism in a patient who has no infection (rectal, nasal, axillary or groin swabs, or any specimen labelled screening or surveillance). They are removed.', 'A carrier is not an infection. Mixing screening swabs with clinical cultures inflates resistance (CLSI M39). A value of <b>0</b> means none were found in the data; it does not mean the check failed.'],
                ['<b>Repeat isolates removed (CLSI M39)</b>', 'The same patient and the same organism in the same year is counted <b>once</b>, using the first isolate. Later ones are removed.', 'A patient with a long stay has many cultures. Without this rule the same resistant bacterium is counted again and again and resistance looks higher than it is.'],
                ['<b>First isolates analysed</b>', 'Records minus screening cultures minus repeats. <b>This is the number used by every other table and chart of the year.</b>', 'This is the real <b>n</b> of the report.']]) +
            P('<b>Rule of thumb:</b> a large number of repeats is normal in a hospital with many long-stay patients. A number of repeats that is zero while patient identifiers are missing is suspicious (see Part 2).') +
            H('Part 2. Completeness of the data fields') +
            P('Each line shows the <b>percentage of records that have that piece of information</b>. Missing information cannot be recovered by the dashboard.') +
            T(['Line', 'What it means', 'What goes wrong if it is low'], [
                ['<b>With patient identifier</b>', 'The record has a patient number that lets the app recognise the same patient again. It is needed for de-duplication.', 'Repeats cannot be found, so the same patient may be counted several times and resistance is overestimated.'],
                ['<b>With ward</b>', 'The record shows which ward the patient was in. It is needed for the unit switch and the ICU comparison.', 'Records without a ward cannot be placed in ICU or non-ICU, so the unit views are incomplete.'],
                ['<b>With specimen type</b>', 'The record shows the specimen (blood, urine, wound...). It is needed for specimen reports such as blood-only.', 'Specimen-specific antibiograms (for example blood) leave out these records.'],
                ['<b>With at least one AST result</b>', 'The isolate has at least one susceptibility result (S, I or R) for any antibiotic. AST means antimicrobial susceptibility testing.', 'An isolate with no AST result adds to the count of isolates but cannot add to any resistance percentage.']]) +
            P('<b>What is a good value?</b> The closer to 100% the better. There is no official cut-off for field completeness, so this dashboard does not set one. The lower the completeness, the more caution the related results need. Compare with the previous year: a value that is improving is a good sign, and one that is falling should be raised with the laboratory and the surveillance programme.') +
            H('Part 3. Testing coverage for the priority indicators') +
            P('A resistance percentage is calculated only among the isolates that were <b>actually tested</b>. These lines show how many isolates of a group were tested for the antibiotic that defines each indicator. The figure is the percentage, with the counts in brackets.') +
            T(['Line', 'Tested means at least one of', 'Indicator it supports'], [
                ['<b>Enterobacterales tested for a carbapenem</b>', 'Meropenem, imipenem, ertapenem or doripenem', 'CRE (carbapenem-resistant Enterobacterales)'],
                ['<b>Enterobacterales tested for a 3rd-gen. cephalosporin</b>', 'Ceftriaxone, cefotaxime or ceftazidime', '3GC-R (third-generation cephalosporin resistance)'],
                ['<b><i>S. aureus</i> tested for cefoxitin or oxacillin</b>', 'Cefoxitin, oxacillin or the cefoxitin screen', 'MRSA (methicillin-resistant <i>S. aureus</i>)'],
                ['<b><i>Enterococcus</i> tested for vancomycin</b>', 'Vancomycin', 'VRE (vancomycin-resistant enterococci)']]) +
            H('How to read a coverage line') + L([
                '<b>99.3% (136/137)</b> means 136 of 137 Enterobacterales had a carbapenem result. One was not tested, so it cannot be classified. The CRE figure is based on 136 isolates.',
                '<b>100% (44/44)</b> means every <i>S. aureus</i> was tested, so the MRSA figure covers all of them.',
                '<b>A dash (-)</b> means there were no isolates of that group in the year, so there is nothing to measure.']) +
            H('Why testing coverage matters') + P('Laboratories do not always test every antibiotic on every isolate. If an antibiotic is tested mainly on isolates already suspected to be resistant, the percentage will look worse than it really is. If it is tested mainly on easy, susceptible isolates, it will look better. The higher the coverage, the less this bias. WHO GLASS also asks that results are reported together with the number of isolates tested.') +
            H('What to do when a value is low') + L([
                'Do not delete the indicator; read it with caution and say so when you present it.',
                'Ask the laboratory whether the antibiotic was really tested and whether it was exported from WHONET.',
                'Check whether the field was recorded at source. A missing ward or specimen is usually a recording gap, not a laboratory problem.',
                'Repeat the check next year and see whether coverage improved. Improvement is itself a useful result.']) +
            TIP('These lines measure whether a result <b>exists</b>. They do not tell you whether testing was appropriate or correct. Quality of testing is checked by the laboratory with quality control strains (CLSI M100).')],

        ['month', 'Monthly Alerts tab: results that need action', () =>
            P('A month is too short for reliable percentages, so this tab is built for action, not for trend. For trends, use the Annual Report tab.') +
            H('Priority alerts') + L(['<b>Why:</b> some isolates need confirmation and a response the same week.', '<b>What:</b> carbapenem-resistant Enterobacterales, <i>Pseudomonas</i> and <i>Acinetobacter</i>; vancomycin-resistant enterococci; <i>S. aureus</i> with reduced vancomycin susceptibility (candidates); <i>Candida auris</i>; XDR and PDR isolates; and the critical resistance combinations listed by WHO (for example XDR with colistin resistance).', '<b>All isolates are checked,</b> not only the first per patient, so that a new resistance pattern is not missed. A later isolate with the same flags from the same patient is marked <b>repeat</b>.', '<b>What to do:</b> confirm the result, inform the infection control team, and send VRSA candidates to a reference laboratory.', '<b>Caution:</b> an alert is a result to confirm and report, not a diagnosis of an outbreak.'])],

        ['cultures', 'Cultures tab: laboratory activity and quality', () =>
            P('Describes how many cultures the laboratory received and what they grew. The numbers are aggregate counts, not patient records.') +
            L(['<b>Positive:</b> an organism was reported. <b>No growth:</b> nothing grew. <b>Contaminated:</b> reported as contaminated by the laboratory.', '<b>Volume per month:</b> workload. A very low month usually means an incomplete file.', '<b>Positivity by ward and specimen:</b> depends on case mix and on how often cultures are taken.']) +
            H('Blood culture contamination') + L(['<b>Acceptable range:</b> typically 3% or less of all blood cultures received (CLSI M47-A, Section 5.6).', '<b>Reported as contaminated:</b> certain.', '<b>Possible skin-flora growth:</b> uncertain, because these organisms can also cause true infection.', '<b>Upper estimate:</b> the two added together. The real rate lies between the reported figure and the estimate.']) +
            H('Why it matters') + P('Contaminated blood cultures lead to unnecessary antibiotics, longer stay and cost. The rate is a quality indicator for blood collection.')],

        ['scope', 'Unit scope and ICU', () =>
            P('The switch under the top bar filters <b>every chart and table on every tab</b> by the ward where the specimen was collected.') +
            H('The four options') + L([
                '<b>ALL:</b> every ward with a recorded ward name. Records without a ward are excluded from every unit view and counted only in Data quality.',
                '<b>ICU:</b> only the wards counted as intensive care units. The surveillance programme chooses which wards count as ICU (by default only wards recorded as ICU).',
                '<b>Non-ICU IP:</b> inpatient wards that are not ICU. IP means inpatient. Emergency is not counted as inpatient.',
                '<b>Outpatient:</b> everything that is not inpatient, including outpatient clinics and emergency.',
                'Each patient is counted once. The first isolate is chosen across all wards, then the filter is applied (CLSI M39, Section 6.4).']) +
            H('Why ICU is shown separately') + P('Antimicrobial use, invasive devices and patient risk differ between intensive care and other wards, so a pooled result can hide ICU-specific resistance. CLSI M39 supports stratifying cumulative susceptibility data by patient location.') +
            H('How it is applied') + L([
                'The first isolate per patient and organism is chosen across all wards first, and the ward filter is applied afterwards. A patient who moves between wards is therefore not counted twice.',
                'The Annual Report ICU comparison always shows both units, whatever the switch is set to.',
                'The buttons may be hidden by the surveillance programme; in that case the dashboard opens on the chosen default scope. Each user can also choose the default for their own device in Settings.',
                'A note under each Analytics chart states the unit and the period shown.'])],

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
                ['First isolate', 'The first result for a patient and organism in the reported period. Repeats are not counted (CLSI M39).'], ['De-duplication', 'Removing repeat isolates so each patient and organism is counted once.'], ['Screening culture', 'A swab taken to detect carriage of a resistant organism, not to diagnose infection. Excluded from the analysis.'], ['Completeness', 'The share of records in which a field (patient identifier, ward, specimen, AST) is filled in.'], ['Testing coverage', 'The share of isolates that were actually tested for the antibiotic an indicator depends on.'], ['Patient identifier', 'A code that lets the app recognise the same patient again; names are never shown.'],
                ['WHONET', 'Free WHO software used by laboratories to record and analyse susceptibility data.'], ['ESBL', 'Extended-spectrum beta-lactamase.']])]
    ];

    (function () {   // reviewer sections (second tab of the Guide)
        const rv = window.GD_REVIEWER_SECTIONS;
        if (!rv) return;
        SECTIONS.push(...rv);
    })();

    window.aboutHtml = function () {
        const chip = t => `<span class="gd-chip">${t}</span>`;
        const org = (n, d) => `<div class="gd-org"><div class="gd-org-n">${n}</div><div class="gd-org-d">${d}</div></div>`;
        return `
            <div class="gd-about">
                <div class="gd-logo"><img src="img/logo-splash.png?v=1" alt="AMR Tracker"></div>
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
                <details class="gd-legal"><summary><b>Disclaimer</b></summary><div class="gd-legal-b">&bull; <b>Intended use:</b> AMR Trak is a tool for epidemiological surveillance and for producing cumulative antimicrobial susceptibility statistics.<br>&bull; <b>Clinical judgement:</b> it does not replace professional clinical judgement. Decisions about an individual patient rest with the treating clinician, in line with local treatment guidelines and with advice from microbiology and infectious diseases specialists.<br>&bull; <b>Not a diagnostic or prescribing tool:</b> cumulative results describe the hospital population and must not be the only basis for diagnosing, or for choosing treatment for, an individual patient.<br>&bull; <b>Data quality:</b> results depend on the laboratory data supplied and on how complete and accurate they are. Interpret small numbers with caution.<br>&bull; <b>Alerts and flags:</b> these draw attention to results for review. They are not conclusions; the final interpretation and any action remain with the responsible clinician and laboratory.<br>&bull; <b>No warranty:</b> the tool is provided as is, without warranty of any kind, and its developer accepts no liability for decisions made on the basis of its output.<br>&bull; <b>Rights:</b> all intellectual and software rights reserved &copy; 2026.</div></details>
            </div>`;
    };

    // Two tabs: the reviewer sections and the References belong to "For reviewer"; everything else is "Instructions"
    const isRev = id => /^rv_/.test(id);
    let tab = 'ins';
    try { tab = localStorage.getItem('amr_guide_tab') === 'rev' ? 'rev' : 'ins'; } catch (e) {}

    function build() {
        const items = SECTIONS.filter(s => isRev(s[0]) === (tab === 'rev')).map(([id, title, body], i) => `
            <details class="gd-sec" data-id="${id}">
                <summary><span class="gd-num">${i + 1}</span><span class="gd-t">${title.replace(/^For reviewer: (.)/, (m, c) => c.toUpperCase())}</span></summary>
                <div class="gd-body">${body()}</div>
            </details>`).join('');
        const intro = tab === 'rev'
            ? 'For experts, the Ministry and hospital management: how each tool works, the rule it applies, the source of the rule and the reason it was chosen.'
            : 'Tap a section to open it. Each section explains what a chart or concept is, why it is used, how to read it, and on what rule it is based.';
        return `
            <div class="gd-bar">
                <div><div class="gd-title">Guide</div><div class="gd-subtitle">${tab === 'rev' ? 'For reviewer' : 'How to read this dashboard'}</div></div>
                <div class="gd-actions"><button type="button" id="gdToggle">Expand all</button><button type="button" id="gdClose" aria-label="Close the guide">&times;</button></div>
            </div>
            <div class="gd-tabs"><button type="button" data-tab="ins" class="${tab === 'ins' ? 'on' : ''}">Instructions</button><button type="button" data-tab="rev" class="${tab === 'rev' ? 'on' : ''}">For reviewer</button></div>
            <div class="gd-scroll">
                <p class="gd-intro">${intro}</p>
                ${items}
            </div>`;
    }

    window.showGuide = function () {
        let el = document.getElementById('guideView');
        if (!el) { el = document.createElement('div'); el.id = 'guideView'; document.body.appendChild(el); }
        const render = () => {
            el.innerHTML = build();
            el.querySelector('#gdClose').onclick = close;
            const tg = el.querySelector('#gdToggle');
            tg.onclick = () => {
                const all = el.querySelectorAll('details.gd-sec'), anyClosed = Array.from(all).some(d => !d.open);
                all.forEach(d => { d.open = anyClosed; });
                tg.textContent = anyClosed ? 'Collapse all' : 'Expand all';
            };
            el.querySelectorAll('.gd-tabs button').forEach(b => b.onclick = () => {
                tab = b.dataset.tab;
                try { localStorage.setItem('amr_guide_tab', tab); } catch (e) {}
                render();
            });
            el.querySelector('.gd-scroll').scrollTop = 0;
        };
        const close = () => { el.classList.remove('open'); document.body.classList.remove('gd-lock'); };
        render();
        el.classList.add('open');
        document.body.classList.add('gd-lock');
    };
    window.hideGuide = function () { const el = document.getElementById('guideView'); if (el) el.classList.remove('open'); document.body.classList.remove('gd-lock'); };
})();
