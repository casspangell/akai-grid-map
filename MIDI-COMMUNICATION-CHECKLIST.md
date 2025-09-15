# MIDI Communication Checklist

## 🚨 CRITICAL: Bidirectional MIDI Communication Must Be Preserved

This document ensures that the core MIDI communication functionality between the web app and physical controller is never lost during code changes.

## ✅ Core Functionality Requirements

### 1. **Web App → Controller Communication**
- [ ] `togglePadClick()` function calls `sendMIDIToController()`
- [ ] `toggleSideButtonClick()` function calls `sendMIDIToController()`
- [ ] `toggleBottomButtonClick()` function calls `sendMIDIToController()`
- [ ] `sendMIDIToController()` uses the correct APC Mini MK2 format: `[0x95, midiNote, velocity]`
- [ ] `sendMIDIToController()` uses the passed `velocity` parameter (NOT `selectedColor`)
- [ ] LED turns ON when `velocity > 0`
- [ ] LED turns OFF when `velocity = 0`

### 2. **Controller → Web App Communication**
- [ ] `handleMIDIMessage()` processes both `noteon` and `noteoff` events
- [ ] `updateGridPad()` is called on `noteon` and `noteoff`
- [ ] `updateGridPad()` adds `.active` class for visual feedback
- [ ] `updateGridPad()` removes `.active` class after 200ms timeout
- [ ] `updateGridPad()` handles all button types: Grid (0-63), Side (112-119), Bottom (100-107)
- [ ] `gridPads[midiNote]` object is populated during `createControllerGrid()`

### 3. **Key Functions That Must Exist**

#### `sendMIDIToController(midiNote, isOn, velocity)`
```javascript
// CRITICAL: Must use the velocity parameter, not selectedColor
if (isOn && velocity > 0) {
    output.send([0x95, midiNote, velocity]); // APC Mini MK2 format
} else {
    output.send([0x95, midiNote, 0]); // Turn off LED
}
```

#### `updateGridPad(midiNote, isPressed, velocity)`
```javascript
const pad = gridPads[midiNote];
if (!pad) return;

if (isPressed) {
    pad.classList.add('active');
    setTimeout(() => {
        pad.classList.remove('active');
    }, 200);
} else {
    pad.classList.remove('active');
}
```

#### `handleMIDIMessage(message)`
```javascript
if (message.type === 'noteon') {
    updateGridPad(message.note.number, true, message.velocity);
    toggleButtonState(message.note.number);
} else if (message.type === 'noteoff') {
    updateGridPad(message.note.number, false, 0);
}
```

### 4. **Required Data Structures**
- [ ] `gridPads = {}` object exists and is populated
- [ ] `buttonStates = {}` object tracks button assignments
- [ ] `midiOutputs` array contains WebMidi output devices

## 🧪 Testing Protocol

### Before Making ANY Changes:
1. **Run the test suite**: Open `test-midi-communication.html`
2. **Verify bidirectional communication**:
   - Click buttons on web app → LEDs light on controller
   - Press buttons on controller → web app buttons light up
3. **Document current working state**

### After Making Changes:
1. **Run the test suite again**
2. **Manually test both directions**:
   - Web App → Controller
   - Controller → Web App
3. **Check console for errors**
4. **Verify all key functions still exist**

## 🚫 Common Pitfalls That Break Communication

### ❌ DON'T DO THESE:
1. **Remove or modify `sendMIDIToController()` without testing**
2. **Change the MIDI message format without verifying it works**
3. **Remove `updateGridPad()` calls from `handleMIDIMessage()`**
4. **Modify `gridPads` object structure without updating references**
5. **Change event listener setup without testing**
6. **Remove `velocity` parameter usage in `sendMIDIToController()`**

### ✅ ALWAYS DO THESE:
1. **Test bidirectional communication after ANY change**
2. **Keep the test suite up to date**
3. **Document any changes to MIDI communication functions**
4. **Use the velocity parameter passed to `sendMIDIToController()`**
5. **Maintain the APC Mini MK2 format: `[0x95, midiNote, velocity]`**

## 🔧 Quick Fix Commands

If communication breaks, check these in order:

```javascript
// 1. Verify gridPads is populated
console.log('gridPads:', Object.keys(gridPads).length, 'pads');

// 2. Test MIDI output
midiOutputs.forEach(output => {
    output.send([0x95, 0, 127]); // Test note 0 with white color
});

// 3. Test MIDI input
console.log('MIDI inputs:', WebMidi.inputs.length);

// 4. Verify updateGridPad function
updateGridPad(0, true, 127); // Should light up note 0
```

## 📋 Pre-Release Checklist

Before any release or major change:

- [ ] Test suite passes all tests
- [ ] Web App → Controller communication works
- [ ] Controller → Web App communication works
- [ ] All button types work (grid, side, bottom)
- [ ] Color assignment works
- [ ] Toggle behavior works
- [ ] Reset functionality works
- [ ] No console errors
- [ ] MIDI message format is correct
- [ ] All key functions exist and work

## 🆘 Emergency Recovery

If communication is completely broken:

1. **Revert to last known working state**
2. **Run test suite to identify what's broken**
3. **Check console for errors**
4. **Verify all required functions exist**
5. **Test with minimal changes**
6. **Document what broke and why**

---

**Remember: This functionality has been lost multiple times. Always test after changes!**
