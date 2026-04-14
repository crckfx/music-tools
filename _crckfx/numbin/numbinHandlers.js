// numbinHandlers.js

// --- type: RANGE ---
// for a range of numbers with min and max
export function beforeInput_range(e, numbin) {
    if (e.isComposing) return;
    
    const t = e.inputType;
    if (t.startsWith("delete")) return;
    if (!(t.startsWith("insert") || t === "insertReplacementText" || t === "insertFromPaste")) return;
        
    const data = e.data ?? "";
    if (/\D/.test(data)) { e.preventDefault(); return; }
    
    const input = numbin.input;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const selLen = end - start;

    // what the new value would look like after this input
    const candidate = input.value.slice(0, start) + data + input.value.slice(end);
    const nextLen = input.value.length - selLen + data.length;

    const maxDigits = String(numbin.max).length;
    const numericMax = numbin.max;

    // only block when it would exceed allowed length *after replacing selection*
    if (nextLen > maxDigits || parseInt(candidate, 10) > numericMax) {
        e.preventDefault();
    }

    // allow it to dispatch the event???
}

// --- type: DIGIT ---
// for a single digit
export function beforeInput_singleDigit(e) {
    if (e.isComposing) return;

    const t = e.inputType;
    if (t.startsWith('delete')) return; // allow deletes
    if (!t.startsWith('insert')) return;

    const data = e.data ?? '';
    const digits = data.replace(/\D/g, '');
    if (digits.length === 0) {
        e.preventDefault(); // ignore letters or symbols
        return;
    }

    // decide what to keep
    const keep = t === 'insertFromPaste'
        ? digits[0]               // paste: keep first numeric char
        : digits[digits.length - 1]; // normal typing: keep last numeric char

    // override normal behaviour
    e.preventDefault();
    e.target.value = keep;
    e.target.dispatchEvent(
        new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText'
        })
    );
}