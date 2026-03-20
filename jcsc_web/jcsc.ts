// === Interfaces ===

interface NoteDefinition {
    NoteName: string;
    BaseDegree: string; // JSON data uses strings for numbers often
    SemitonePosition: string;
    AccidentalValue: string;
}

interface IntervalDefinition {
    IntervalID: string;
    IntervalName?: string;
    DeltaSemitone: string;
    DeltaDegree: string;
    RomanNumeralBase?: string;
}

interface ChordDefinition {
    ChordSymbol: string;
    IntervalsStructure: string;
    GuideToneIntervals: string;
    RomanSuffix: string;
}

interface ScaleDefinition {
    ScaleName: string;
    IntervalsStructure: string;
    AvoidNoteIntervals: string;
}

interface RuleDefinition {
    KeyType: string;
    DegreeIntervalID: string;
    ChordSymbol: string;
    ScaleName: string;
    HarmonicFunction: string;
    UsageType: string;
}

interface Database {
    notes?: NoteDefinition[]; // Not used in calculation logic but present in DB
    intervals: IntervalDefinition[];
    chords: ChordDefinition[];
    scales: ScaleDefinition[];
    rules: RuleDefinition[];
    calcIntervals?: { [key: string]: { dSemi: number; dDeg: number } }; // Runtime optimization
}

interface NoteStruct {
    baseDegree: number;
    semitone: number;
    acc: number;
    baseName: string;
}

interface CalculatedNote {
    name: string;
    semi: number;
    interval: string;
}

interface AnalysisResult {
    input: string;
    isValid: boolean;
    roman: string;
    func: string;
    scaleName: string;
    chordTonesDisplay: string;
    scaleTonesDisplay: string;
    keyboardMap: { [semi: number]: { isChord: boolean; dotType: string | null } };
}

interface AppRow {
    key: string;
    chord: string;
}

// === Global DB Placeholder (Actual data is injected in HTML) ===
declare const DB: Database;

// === Logic Engine ===
class TheoryEngine {
    private intervals: { [id: string]: IntervalDefinition };
    private chords: { [symbol: string]: ChordDefinition };
    private scales: { [name: string]: ScaleDefinition };

    constructor() {
        this.intervals = {};
        if (DB.intervals) {
            DB.intervals.forEach((i) => {
                // Prevent duplicate overwrite if standard exists
                if (!this.intervals[i.IntervalID]) {
                    this.intervals[i.IntervalID] = i;
                }
            });
        }

        this.chords = {};
        if (DB.chords) DB.chords.forEach((c) => (this.chords[c.ChordSymbol] = c));

        this.scales = {};
        if (DB.scales) DB.scales.forEach((s) => (this.scales[s.ScaleName] = s));
    }

    private parseNoteStruct(noteStr: string): NoteStruct | null {
        if (!noteStr) return null;
        noteStr = noteStr.trim();
        const match = noteStr.match(/^([A-G])(b*|#*|x*)$/);
        if (!match) return null;

        const baseMap: { [key: string]: number } = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
        const semiMap: { [key: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

        const baseName = match[1];
        const base = baseMap[baseName];
        let acc = 0;

        const accStr = match[2];
        if (accStr) {
            if (accStr.startsWith('b')) acc = -accStr.length;
            else if (accStr.startsWith('#')) acc = accStr.length;
            else if (accStr.startsWith('x')) acc = accStr.length * 2;
        }

        return {
            baseDegree: base,
            semitone: (semiMap[baseName] + acc + 120) % 12,
            acc: acc,
            baseName: baseName,
        };
    }

    private splitChord(input: string): { root: string | null; quality: string | null } {
        if (!input) return { root: null, quality: null };
        input = input.trim();
        const match = input.match(/^([A-G](?:b+|#+|x)?)(.*)$/);
        if (!match) return { root: null, quality: null };
        return { root: match[1], quality: match[2] };
    }

    private calculateNoteFromInterval(rootStruct: NoteStruct, intervalId: string): CalculatedNote {
        const intervalDef = this.intervals[intervalId];
        if (!intervalDef) return { name: '?', semi: 0, interval: intervalId };

        const dDeg = parseInt(intervalDef.DeltaDegree);
        const dSemi = parseInt(intervalDef.DeltaSemitone);

        const newBaseDeg = (rootStruct.baseDegree + dDeg) % 7;
        const baseNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const newBaseName = baseNames[newBaseDeg];

        const naturalSemis: { [key: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        const targetNaturalSemi = naturalSemis[newBaseName];
        const targetSemi = (rootStruct.semitone + dSemi) % 12;

        let bestAcc = 0;
        let minErr = 999;

        // Brute force search for best accidental (-4 to +4)
        for (let a = -4; a <= 4; a++) {
            let checkSemi = (targetNaturalSemi + a + 120) % 12;
            if (checkSemi === targetSemi) {
                if (Math.abs(a) < Math.abs(bestAcc) || minErr === 999) {
                    bestAcc = a;
                    minErr = 0;
                }
            }
        }

        let accStr = '';
        if (bestAcc > 0) accStr = '#'.repeat(bestAcc);
        else if (bestAcc < 0) accStr = 'b'.repeat(Math.abs(bestAcc));
        if (bestAcc === 2 && accStr === '') accStr = 'x'; // Should be covered by # loop but safety

        return { name: newBaseName + accStr, semi: targetSemi, interval: intervalId };
    }

    private getInterval(rootStruct: NoteStruct, chordRootStruct: NoteStruct): string | null {
        const dDeg = (chordRootStruct.baseDegree - rootStruct.baseDegree + 7) % 7;
        const dSemi = (chordRootStruct.semitone - rootStruct.semitone + 12) % 12;

        // Lookup in DB array
        const match = DB.intervals.find(
            (i) => parseInt(i.DeltaDegree) === dDeg && parseInt(i.DeltaSemitone) === dSemi
        );
        return match ? match.IntervalID : null;
    }

    private formatNoteList(notes: CalculatedNote[] | { name: string }[]): string {
        return notes.map((n) => n.name.padEnd(6, ' ')).join('');
    }

    public analyze(keyStr: string, chordInput: string): AnalysisResult {
        const res: AnalysisResult = {
            input: chordInput,
            isValid: false,
            roman: '-',
            func: '-',
            scaleName: '-',
            chordTonesDisplay: '',
            scaleTonesDisplay: '',
            keyboardMap: {},
        };

        // Parse Key
        let keyRootStr = 'C';
        let keyType = 'Major';
        if (keyStr) {
            keyStr = keyStr.trim();
            if (keyStr.endsWith('m')) {
                keyType = 'Minor';
                keyRootStr = keyStr.substring(0, keyStr.length - 1);
            } else {
                keyRootStr = keyStr;
            }
        }

        const keyRoot = this.parseNoteStruct(keyRootStr);
        const parts = this.splitChord(chordInput);
        const chordRoot = this.parseNoteStruct(parts.root || '');

        if (!keyRoot || !chordRoot || !parts.root) return res;
        res.isValid = true;

        const rootIntervalId = this.getInterval(keyRoot, chordRoot);

        if (!rootIntervalId) {
            res.roman = 'Err:Int';
        } else {
            // Find ALL matching rules
            let candidates = DB.rules.filter(
                (r) =>
                    r.KeyType === keyType &&
                    r.DegreeIntervalID === rootIntervalId &&
                    r.ChordSymbol === parts.quality
            );

            // Prioritize UsageType "Main"
            let rule = candidates.find((r) => r.UsageType === 'Main') || candidates[0];

            if (rule) {
                res.roman = rule.DegreeIntervalID;
                res.func = rule.HarmonicFunction || '';
                res.scaleName = rule.ScaleName;
            } else {
                res.roman = rootIntervalId;
                res.scaleName = '(No Rule)';
            }
        }

        const chordDef = this.chords[parts.quality || ''];
        const scaleDef = this.scales[res.scaleName];

        const calcNotes = (strList: string) => {
            if (!strList) return [];
            return String(strList)
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s)
                .map((intId) => {
                    return this.calculateNoteFromInterval(chordRoot, intId);
                });
        };

        let cTones: CalculatedNote[] = [];
        let sTones: CalculatedNote[] = [];
        let gIntervals: string[] = [];
        let aIntervals: string[] = [];

        if (chordDef) {
            cTones = calcNotes(chordDef.IntervalsStructure);
            gIntervals = String(chordDef.GuideToneIntervals || '')
                .split(',')
                .map((s) => s.trim());
        }

        if (scaleDef) {
            sTones = calcNotes(scaleDef.IntervalsStructure);
            aIntervals = String(scaleDef.AvoidNoteIntervals || '')
                .split(',')
                .map((s) => s.trim());
        }

        // Build Keyboard Map
        const kb: AnalysisResult['keyboardMap'] = {};
        
        cTones.forEach((t) => {
            if (!kb[t.semi]) kb[t.semi] = { isChord: false, dotType: null };
            kb[t.semi].isChord = true;
        });

        sTones.forEach((t) => {
            if (!kb[t.semi]) kb[t.semi] = { isChord: false, dotType: null };
            let type = 'scale';
            if (aIntervals.includes(t.interval)) type = 'avoid';
            else if (gIntervals.includes(t.interval)) type = 'guide';
            
            // Note: t.interval is relative to chord root. P1 is root.
            if (t.interval === 'P1') type = 'root';

            // Priority: Root(4) > Avoid(3) > Guide(2) > Scale(1)
            const priorities: { [key: string]: number } = { root: 4, avoid: 3, guide: 2, scale: 1 };
            const currentType = kb[t.semi].dotType;
            const currentPrio = currentType ? priorities[currentType] : 0;
            
            if (priorities[type] > currentPrio) {
                kb[t.semi].dotType = type;
            }
        });
        res.keyboardMap = kb;

        // Formatting
        res.chordTonesDisplay = this.formatNoteList(cTones);

        const scaleToneNames = sTones.map((t) => {
            let name = t.name;
            if (aIntervals.includes(t.interval)) return { name: `(${name})` };
            if (gIntervals.includes(t.interval)) return { name: `${name}'` };
            return { name: name };
        });
        res.scaleTonesDisplay = this.formatNoteList(scaleToneNames);

        return res;
    }
}

// === App Controller ===
class App {
    public rows: AppRow[];
    private engine: TheoryEngine;

    constructor() {
        this.engine = new TheoryEngine();
        this.rows = [
            { key: "Ebm", chord: "Ebm" },
            { key: "Ebm", chord: "Bbm7" },
            { key: "Gb",  chord: "BM7" },
            { key: "Gb",  chord: "Abm6" },
            { key: "Gb",  chord: "Bbm7" },
            { key: "Gb",  chord: "Ebm7" },
            { key: "Gb",  chord: "Abm7" },
            { key: "Gb",  chord: "Db7" },
            { key: "Gb",  chord: "GbM7" },
            { key: "Ebm", chord: "Fm7b5" },
            { key: "Ebm", chord: "Bb7b9" }
        ];
    }

    public init(): void {
        this.renderTable();
        this.setupKeyboardUI();
    }

    public toggleDarkMode(): void {
        document.body.classList.toggle('dark-mode');
    }

    public insertRow(index: number): void {
        const refRow = this.rows[index];
        this.rows.splice(index + 1, 0, { key: refRow.key, chord: "" });
        this.renderTable();
    }

    public deleteRow(index: number): void {
        if (this.rows.length <= 1) {
            this.rows[0].chord = "";
        } else {
            this.rows.splice(index, 1);
        }
        this.renderTable();
    }

    public updateRow(index: number, field: keyof AppRow, value: string): void {
        // Clean pastes
        const cleanValue = value.replace(/(\r\n|\n|\r)/gm, "");
        if (cleanValue !== value) {
            this.rows[index][field] = cleanValue;
            this.renderTable();
        } else {
            this.rows[index][field] = value;
            this.recalcAll();
        }
    }

    public handleEnter(e: KeyboardEvent, el: HTMLElement): void {
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        }
    }

    public recalcAll(): void {
        this.renderTable();
    }

    public copyTSV(): void {
        let tsv = "#\tKey\tChord\tDeg\tFunc\tScale Name\tChord Tones\tScale Notes\n";
        this.rows.forEach((row, i) => {
            const analysis = this.engine.analyze(row.key, row.chord);
            const cTones = analysis.chordTonesDisplay.replace(/\s+/g, ' ').trim();
            const sNotes = analysis.scaleTonesDisplay.replace(/\s+/g, ' ').trim();
            tsv += `${i+1}\t${row.key}\t${row.chord}\t${analysis.roman}\t${analysis.func}\t${analysis.scaleName}\t${cTones}\t${sNotes}\n`;
        });
        navigator.clipboard.writeText(tsv).then(() => {
            alert("Copied to clipboard!");
        });
    }

    public renderTable(): void {
        const tbody = document.querySelector('#mainTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.rows.forEach((row, i) => {
            const analysis = this.engine.analyze(row.key, row.chord);
            
            const tr = document.createElement('tr');
            tr.onclick = () => this.highlightRow(i, analysis);
            
            // Buttons using strict template literal
            const actions = `
                <button class="btn-action btn-add" onclick="event.stopPropagation(); app.insertRow(${i})">+</button>
                <button class="btn-action btn-del" onclick="event.stopPropagation(); app.deleteRow(${i})">-</button>
            `;

            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="col-key">
                    <div class="editable-cell" contenteditable="true" 
                         onblur="app.updateRow(${i}, 'key', this.innerText)"
                         onkeydown="app.handleEnter(event, this)">${row.key}</div>
                </td>
                <td class="col-chord">
                    <div class="editable-cell" contenteditable="true" 
                         onblur="app.updateRow(${i}, 'chord', this.innerText)"
                         onkeydown="app.handleEnter(event, this)">${row.chord}</div>
                </td>
                <td>${analysis.roman}</td>
                <td>${analysis.func}</td>
                <td>${analysis.scaleName}</td>
                <td class="mono-col">${analysis.chordTonesDisplay}</td>
                <td class="mono-col">${analysis.scaleTonesDisplay}</td>
                <td style="text-align:center;">${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    public highlightRow(index: number, analysis: AnalysisResult): void {
        const rows = document.querySelectorAll('#mainTable tbody tr');
        rows.forEach(r => r.classList.remove('selected-row'));
        if (rows[index]) rows[index].classList.add('selected-row');
        this.updateKeyboard(analysis.keyboardMap);
    }

    public setupKeyboardUI(): void {
        const kb = document.getElementById('keyboard');
        if (!kb) return;
        let html = '';
        const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const isBlack = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
        // 3 Octaves
        for(let oct=0; oct<3; oct++) {
            for(let i=0; i<12; i++) {
                const type = isBlack[i] ? 'black' : 'white';
                html += `<div class="key ${type}" data-semi="${i}">
                            <div class="key-label">${notes[i]}</div>
                         </div>`;
            }
        }
        html += `<div class="key white" data-semi="0"><div class="key-label">C</div></div>`;
        kb.innerHTML = html;
    }

    public updateKeyboard(map: AnalysisResult['keyboardMap']): void {
        const keys = document.querySelectorAll('.key');
        keys.forEach(k => {
            k.classList.remove('chord-bg');
            const oldDot = k.querySelector('.dot');
            if(oldDot) oldDot.remove();
            
            const semiStr = k.getAttribute('data-semi');
            if (!semiStr) return;
            const semi = parseInt(semiStr);

            if (map && map[semi]) {
                const data = map[semi];
                if (data.isChord) k.classList.add('chord-bg');
                if (data.dotType) {
                    const dot = document.createElement('div');
                    dot.className = `dot ${data.dotType}`;
                    k.appendChild(dot);
                }
            }
        });
    }
}

// Global hook
const app = new App();
// In browser environment, we usually wait for DOM, but script is at bottom of body
app.init();

