# 🎯 APC Mini MK2 MIDI Controller - WORKING STATE

**Date**: September 14, 2024  
**Status**: ✅ FULLY FUNCTIONAL

## 🔧 Working MIDI Configuration

### LED Control Format:
- **LED On**: `0x95 [note] [color_velocity]` (Note On Channel 5 with color velocity)
- **LED Off**: `0x95 [note] 0x00` (Note On Channel 5 with velocity 0)

### Key Finding:
The APC Mini MK2 uses **Note On messages** for both turning LEDs on AND off:
- **Velocity 0** = LED off
- **Velocity > 0** = LED on with specific color

## 🎨 Working Color Palette (9 colors)

| Color | Hex Code | Velocity | MIDI Message |
|-------|----------|----------|--------------|
| White | #FFFFFF | 3 | 0x95 [note] 0x03 |
| Red | #FF0000 | 5 | 0x95 [note] 0x05 |
| Orange | #FF5400 | 9 | 0x95 [note] 0x09 |
| Yellow | #FFFF00 | 13 | 0x95 [note] 0x0D |
| Green | #00FF00 | 21 | 0x95 [note] 0x15 |
| Blue | #0000FF | 45 | 0x95 [note] 0x2D |
| Purple | #5400FF | 49 | 0x95 [note] 0x31 |
| Pink | #FF00FF | 53 | 0x95 [note] 0x35 |
| Off | #000000 | 0 | 0x95 [note] 0x00 |

## 📁 Project Structure

```
Color Patcher/
├── akai-grid-map.html  # Main HTML file
├── styles.css          # All CSS styling
├── script.js           # All JavaScript functionality
├── velocity-color-mapping.txt  # Color reference chart
├── webappmimic.js      # Reference file
├── README.md           # Documentation
└── WORKING_STATE.md    # This file
```

## ✅ Working Features

- **8x8 Grid Control**: 64 pads with MIDI notes 0-63
- **9 Color Palette**: All colors working correctly
- **Circular Buttons**: Number (1-8) and Letter (A-H) buttons
- **Fader Controls**: 9 faders for additional control
- **Real-time MIDI**: Live MIDI input/output with WebMidi.js
- **Debug Tools**: Debug button for troubleshooting
- **Reset Functionality**: Turn off all LEDs instantly
- **"Off" Color**: Properly turns off LEDs using Note On with velocity 0

## 🔧 Technical Implementation

### MIDI Message Format:
```javascript
// LED On
output.send([0x95, midiNote, colorVelocity]); // 0x95 = Note On Channel 5

// LED Off  
output.send([0x95, midiNote, 0]); // 0x95 = Note On Channel 5 with velocity 0
```

### Console Output:
```
APC Mini MK2: Sent solid Green LED - Note: 59, Color: 21, Channel: 5 (0x5)
APC Mini MK2: Sent LED Off - Note: 59, Channel: 5, Velocity: 0
```

## 🚫 What Doesn't Work

- **Note Off messages** (0x80, 0x85) - These don't turn off LEDs
- **Blinking functionality** - Removed, solid LEDs only
- **Multiple velocity values** - Only highest velocity per color used

## 📝 Notes

- Channel 5 is used for solid LED behavior
- All LEDs are solid (no blinking)
- "Off" color always turns off LEDs (no toggle)
- Project uses clean modular structure (HTML/CSS/JS separated)

## 🎯 Test Results

✅ All 9 colors work correctly  
✅ "Off" color properly turns off LEDs  
✅ No blinking issues  
✅ Proper MIDI message format  
✅ Clean project structure  
✅ All documentation updated  

**This is the stable, working version of the APC Mini MK2 MIDI controller app.**
