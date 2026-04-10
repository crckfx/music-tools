export const SCALES = {
    major:              { name: 'Major',              intervals: [0,2,4,5,7,9,11] },
    natural_minor:      { name: 'Natural Minor',      intervals: [0,2,3,5,7,8,10] },
    harmonic_minor:     { name: 'Harmonic Minor',     intervals: [0,2,3,5,7,8,11] },
    melodic_minor:      { name: 'Melodic Minor',      intervals: [0,2,3,5,7,9,11] },
    pentatonic_major:   { name: 'Pentatonic Major',   intervals: [0,2,4,7,9] },
    pentatonic_minor:   { name: 'Pentatonic Minor',   intervals: [0,3,5,7,10] },
    blues:              { name: 'Blues',              intervals: [0,3,5,6,7,10] },
    dorian:             { name: 'Dorian',             intervals: [0,2,3,5,7,9,10] },
    phrygian:           { name: 'Phrygian',           intervals: [0,1,3,5,7,8,10] },
    lydian:             { name: 'Lydian',             intervals: [0,2,4,6,7,9,11] },
    mixolydian:         { name: 'Mixolydian',         intervals: [0,2,4,5,7,9,10] },
    locrian:            { name: 'Locrian',            intervals: [0,1,3,5,6,8,10] },
    whole_tone:         { name: 'Whole Tone',         intervals: [0,2,4,6,8,10] },
    diminished:         { name: 'Diminished (HW)',    intervals: [0,1,3,4,6,7,9,10] },
};

// Tunings: midi array ordered low string → high string (index 0 = thickest)
export const GUITAR_TUNINGS = {
    standard:    { name: 'Standard',    labels: ['E','A','D','G','B','e'],          midi: [40,45,50,55,59,64] },
    drop_d:      { name: 'Drop D',      labels: ['D','A','D','G','B','e'],          midi: [38,45,50,55,59,64] },
    open_g:      { name: 'Open G',      labels: ['D','G','D','G','B','d'],          midi: [38,43,50,55,59,62] },
    open_e:      { name: 'Open E',      labels: ['E','B','E','G#','B','e'],         midi: [40,47,52,56,61,64] },
    dadgad:      { name: 'DADGAD',      labels: ['D','A','D','G','A','d'],          midi: [38,45,50,55,57,62] },
    eb_standard: { name: 'Eb Standard', labels: ['Eb','Ab','Db','Gb','Bb','eb'],    midi: [39,44,49,54,58,63] },
};