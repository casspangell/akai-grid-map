# Akai APCmini Grid Map

A web application for controlling MIDI controller LEDs with a clean, modern interface.

## 📁 Project Structure

```
Color Patcher/
├── akai-grid-map.html  # Main HTML file
├── styles.css          # All CSS styling
├── script.js           # All JavaScript functionality
├── velocity-color-mapping.txt  # Color reference chart
├── webappmimic.js      # Reference file
└── README.md           # This file
```

## 🚀 Features

- **8x8 Grid Control**: 64 pads with MIDI notes 0-63
- **9 Color Palette**: White, Red, Orange, Yellow, Green, Blue, Purple, Pink, Off
- **Circular Buttons**: Number (1-8) and Letter (A-H) buttons
- **Fader Controls**: 9 faders for additional control
- **Real-time MIDI**: Live MIDI input/output with WebMidi.js
- **Debug Tools**: Debug button for troubleshooting
- **Reset Functionality**: Turn off all LEDs instantly

## 🎨 Color System

The app uses a precise velocity-to-RGB mapping system:

- **White** (`#FFFFFF`) - Velocity 3
- **Red** (`#FF0000`) - Velocity 5
- **Orange** (`#FF5400`) - Velocity 9
- **Yellow** (`#FFFF00`) - Velocity 13
- **Green** (`#00FF00`) - Velocity 21
- **Blue** (`#0000FF`) - Velocity 45
- **Purple** (`#5400FF`) - Velocity 49
- **Pink** (`#FF00FF`) - Velocity 53
- **Off** (`#000000`) - Velocity 0

## 🛠️ Usage

1. **Open `akai-grid-map.html`** in a modern web browser
2. **Click "Enable MIDI"** to connect to your controller
3. **Select a color** from the palette
4. **Click any pad** to light up the corresponding LED
5. **Use "Reset All Pads"** to turn off all LEDs
6. **Check console** for debug information

## 🔧 Technical Details

- **WebMidi.js**: Modern MIDI API wrapper
- **APC Mini MK2 Compatible**: Uses proper 3-byte MIDI Note On format
- **MIDI Format**: Note On Channel 5 (0x95) for solid LEDs, Channel 5 Note Off (0x85) for off
- **Pure JavaScript**: No frameworks, just vanilla JS
- **Responsive Design**: Works on desktop and mobile
- **Dark Theme**: Easy on the eyes
- **Modular Code**: Clean separation of HTML, CSS, and JS

### APC Mini MK2 LED Control
- **Port 0**: MIDI Note On messages
- **3-byte format**: Note, Velocity (color), Channel (behavior)
- **Channel 5**: Solid LED behavior
- **Velocity**: RGB color values (0-127)
- **Example**: `0x95 0x00 0x05` = Solid red pad 1

## 🐛 Troubleshooting

- **Debug Button**: Click to see system information in console
- **Browser Console**: Check for error messages
- **MIDI Device**: Ensure controller is connected and recognized
- **WebMidi.js**: Make sure library loads properly

## 📝 Coordinate System

- **[0,0]** = Bottom-left corner
- **Reading**: Left-to-right, bottom-to-top
- **MIDI Notes**: 0-63 (bottom-left = note 0, top-right = note 63)

## 🎯 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires Web MIDI API support and HTTPS for device access.
