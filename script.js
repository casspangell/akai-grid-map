// MIDI Controller App - JavaScript

// DOM Elements
const statusEl = document.getElementById('status');
const enableBtn = document.getElementById('enableBtn');
const deviceListEl = document.getElementById('deviceList');
const midiLogEl = document.getElementById('midiLog');
const clearBtn = document.getElementById('clearBtn');
const clearGridBtn = document.getElementById('clearGridBtn');

// MIDI Variables
let midiOutputs = [];

// Controller grid mapping (8x8 = 64 pads, notes 0-63)
// [0,0] = bottom-left = note 0, reading left to right, bottom to top
const gridPads = {};
const controllerNotes = {};
const buttonStates = {}; // Track toggle states: { midiNote: { isOn: boolean, assignedColor: string } }

// Generate 8x8 grid mapping: [0,0] to [7,7] with notes 0-63
for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
        const midiNote = (row * 8) + col;
        controllerNotes[midiNote] = { row: 7 - row, col: col }; // Flip row for display
    }
}

// Additional controls mapping
const circularButtons = {};
const faders = {};

// Color palette - exact colors specified
let selectedColor = 'white';
let selectedButtonBehavior = 'toggle'; // 'toggle' or 'solid'e
const colorPalette = [
    { name: 'White', value: 'white', css: '#FFFFFF', velocity: 3 },
    { name: 'Red', value: 'red', css: '#FF0000', velocity: 5 },
    { name: 'Orange', value: 'orange', css: '#FF5400', velocity: 9 },
    { name: 'Yellow', value: 'yellow', css: '#FFFF00', velocity: 13 },
    { name: 'Green', value: 'green', css: '#00FF00', velocity: 21 },
    { name: 'Blue', value: 'blue', css: '#0000FF', velocity: 45 },
    { name: 'Purple', value: 'purple', css: '#5400FF', velocity: 49 },
    { name: 'Pink', value: 'pink', css: '#FF00FF', velocity: 53 },
    { name: 'Off', value: 'off', css: '#000000', velocity: 0 }
];

// Check if WebMidi.js is available
if (typeof WebMidi === 'undefined') {
    statusEl.textContent = 'WebMidi.js library not loaded';
    statusEl.className = 'status disconnected';
    enableBtn.style.display = 'none';
}

// Event Listeners
enableBtn.addEventListener('click', enableMIDI);
clearBtn.addEventListener('click', () => {
    midiLogEl.innerHTML = '';
});
clearGridBtn.addEventListener('click', clearGrid);

// Reset all pads button
const resetAllBtn = document.getElementById('resetAllBtn');
resetAllBtn.addEventListener('click', resetAllPads);

// Debug button
const debugBtn = document.getElementById('debugBtn');
debugBtn.addEventListener('click', showDebugInfo);

// Button behavior selection
const buttonBehaviorRadios = document.querySelectorAll('input[name="buttonBehavior"]');
buttonBehaviorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        selectedButtonBehavior = e.target.value;
        console.log(`Selected button behavior: ${selectedButtonBehavior}`);
    });
});

// Initialize the controller layout
createColorPalette();
createControllerGrid();
createCircularButtons();
createFaders();

// Initialize button behavior toggle visibility
const buttonBehaviorToggle = document.getElementById('buttonBehaviorToggle');
if (selectedColor === 'off') {
    buttonBehaviorToggle.style.display = 'none';
} else {
    buttonBehaviorToggle.style.display = 'block';
}

// MIDI Functions
async function enableMIDI() {
    try {
        await WebMidi.enable();
        
        statusEl.textContent = 'MIDI enabled successfully';
        statusEl.className = 'status connected';
        enableBtn.style.display = 'none';
        
        updateDeviceList();
        setupMIDIInputs();
        
        // Listen for device changes
        WebMidi.addListener('connected', (e) => {
            console.log('MIDI device connected:', e.port.name);
            updateDeviceList();
            setupMIDIInputs();
        });
        
        WebMidi.addListener('disconnected', (e) => {
            console.log('MIDI device disconnected:', e.port.name);
            updateDeviceList();
            setupMIDIInputs();
        });
        
    } catch (error) {
        statusEl.textContent = 'Failed to access MIDI devices: ' + error.message;
        statusEl.className = 'status disconnected';
    }
}

function updateDeviceList() {
    const devices = [];
    
    // List input devices
    WebMidi.inputs.forEach(input => {
        devices.push(`🎮 ${input.name}`);
    });
    
    // List output devices
    WebMidi.outputs.forEach(output => {
        devices.push(`🔊 ${output.name}`);
    });
    
    if (devices.length === 0) {
        deviceListEl.innerHTML = '<div class="device">No MIDI devices detected</div>';
    } else {
        deviceListEl.innerHTML = devices.map(device => 
            `<div class="device"><h3>${device}</h3></div>`
        ).join('');
    }
}

function setupMIDIInputs() {
    // Clear existing listeners
    WebMidi.inputs.forEach(input => {
        input.removeListener();
    });
    
    // Add listeners to all inputs
    WebMidi.inputs.forEach(input => {
        input.addListener('noteon', handleMIDIMessage);
        input.addListener('noteoff', handleMIDIMessage);
        input.addListener('controlchange', handleMIDIMessage);
        console.log(`Listening to MIDI input: ${input.name}`);
    });
    
    // Store output devices for sending MIDI
    midiOutputs = WebMidi.outputs;
}

function createColorPalette() {
    const colorOptionsEl = document.getElementById('colorOptions');
    
    colorPalette.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color.css;
        colorOption.setAttribute('data-color', color.value);
        colorOption.setAttribute('data-name', color.name);
        
        if (color.value === selectedColor) {
            colorOption.classList.add('selected');
        }
        
        colorOption.addEventListener('click', () => {
            // Remove selected class from all options
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Add selected class to clicked option
            colorOption.classList.add('selected');
            selectedColor = color.value;
            
            // Show/hide button behavior toggle based on color selection
            const buttonBehaviorToggle = document.getElementById('buttonBehaviorToggle');
            if (selectedColor === 'off') {
                buttonBehaviorToggle.style.display = 'none';
            } else {
                buttonBehaviorToggle.style.display = 'block';
            }
            
            console.log(`Selected color: ${color.name}`);
        });
        
        colorOptionsEl.appendChild(colorOption);
    });
}

function sendMIDIToController(midiNote, isOn, velocity = 127) {
    if (midiOutputs.length === 0) {
        console.log('No MIDI output devices available');
        return;
    }
    
    // Get selected color
    const color = colorPalette.find(c => c.value === selectedColor);
    
    // Use WebMidi.js to send MIDI messages for APC Mini MK2
    midiOutputs.forEach(output => {
        try {
            if (isOn && selectedColor !== 'off') {
                // For APC Mini MK2: Note On with Channel 5 (0x90 + 0x05 = 0x95) for solid LED
                // Format: Note, Velocity (color), Channel (behavior)
                const behaviorChannel = 5; // Channel 5 = solid LED
                const colorVelocity = color.velocity;
                
                // Send Note On message with proper APC Mini MK2 format
                output.send([0x95, midiNote, colorVelocity]); // 0x95 = Note On Channel 5
                console.log(`APC Mini MK2: Sent solid ${color.name} LED - Note: ${midiNote}, Color: ${colorVelocity}, Channel: ${behaviorChannel} (0x${behaviorChannel.toString(16).toUpperCase()})`);
            } else {
                // Send Note On with velocity 0 to turn off LED (APC Mini MK2 format)
                output.send([0x95, midiNote, 0]); // 0x95 = Note On Channel 5 with velocity 0 (off)
                console.log(`APC Mini MK2: Sent LED Off - Note: ${midiNote}, Channel: 5, Velocity: 0`);
            }
        } catch (error) {
            console.error(`Error sending MIDI to ${output.name}:`, error);
        }
    });
}

function handleMIDIMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    let messageType = '';
    let className = '';
    let messageText = '';
    
    if (message.type === 'noteon') {
        messageType = 'Note On';
        className = 'note-on';
        messageText = `Note: ${getNoteNameFromMIDI(message.note.number)}, Velocity: ${message.velocity}, Channel: ${message.channel}`;
        
        // Toggle button state if it has an assigned color
        toggleButtonState(message.note.number);
        
    } else if (message.type === 'noteoff') {
        messageType = 'Note Off';
        className = 'note-off';
        messageText = `Note: ${getNoteNameFromMIDI(message.note.number)}, Channel: ${message.channel}`;
        
        // Note: We don't handle noteoff for toggling - only noteon triggers the toggle
        
    } else if (message.type === 'controlchange') {
        messageType = 'Control Change';
        className = 'control-change';
        messageText = `Controller: ${message.controller.number}, Value: ${message.controller.value}, Channel: ${message.channel}`;
    }
    
    // Log the MIDI message
    const logEntry = document.createElement('div');
    logEntry.className = `midi-message ${className}`;
    logEntry.innerHTML = `
        <strong>[${timestamp}] ${messageType}</strong><br>
        ${messageText}<br>
        <small>Raw: [${message.rawData.join(', ')}]</small>
    `;
    
    midiLogEl.appendChild(logEntry);
    midiLogEl.scrollTop = midiLogEl.scrollHeight;
}

function updateGridPad(midiNote, isPressed, velocity) {
    const pad = gridPads[midiNote];
    if (!pad) return;
    
    // Remove all velocity classes
    pad.classList.remove('velocity-low', 'velocity-medium', 'velocity-high');
    
    if (isPressed) {
        pad.classList.add('active');
        
        // Add velocity-based styling
        if (velocity < 42) {
            pad.classList.add('velocity-low');
        } else if (velocity < 84) {
            pad.classList.add('velocity-medium');
        } else {
            pad.classList.add('velocity-high');
        }
        
        // Auto-release after a short time for visual feedback
        setTimeout(() => {
            pad.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high');
        }, 200);
    } else {
        pad.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high');
    }
}

function createControllerGrid() {
    const gridEl = document.getElementById('apcGrid');
    
    // Create 8x8 grid (64 pads)
    for (let displayRow = 0; displayRow < 8; displayRow++) {
        for (let col = 0; col < 8; col++) {
            const coordRow = 7 - displayRow; // Flip row for display coordinates
            const midiNote = (coordRow * 8) + col;
            
            const pad = document.createElement('div');
            pad.className = 'grid-pad';
            pad.setAttribute('data-note', midiNote);
            pad.setAttribute('data-row', displayRow);
            pad.setAttribute('data-col', col);
            pad.setAttribute('data-coords', `[${coordRow},${col}]`);
            pad.textContent = midiNote;
            
            // Store reference
            gridPads[midiNote] = pad;
            
            // Add click event listener
            pad.addEventListener('click', () => {
                togglePadClick(pad);
            });
            
            gridEl.appendChild(pad);
        }
    }
}

function createCircularButtons() {
    const numberButtonsEl = document.getElementById('numberButtons');
    const letterButtonsEl = document.getElementById('letterButtons');
    
    // Number buttons (1-8)
    for (let i = 1; i <= 8; i++) {
        const button = document.createElement('div');
        button.className = 'circular-button';
        button.textContent = i.toString();
        button.setAttribute('data-control', `Number${i}`);
        button.setAttribute('data-note', 64 + i); // Start after grid pads
        
        circularButtons[`Number${i}`] = button;
        
        // Add click event listener
        button.addEventListener('click', () => {
            toggleButtonClick(button);
        });
        
        numberButtonsEl.appendChild(button);
    }
    
    // Letter buttons (A-H)
    for (let i = 0; i < 8; i++) {
        const letter = String.fromCharCode(65 + i); // A-H
        const button = document.createElement('div');
        button.className = 'circular-button';
        button.textContent = letter;
        button.setAttribute('data-control', `Letter${letter}`);
        button.setAttribute('data-note', 72 + i); // Start after number buttons
        
        circularButtons[`Letter${letter}`] = button;
        
        // Add click event listener
        button.addEventListener('click', () => {
            toggleButtonClick(button);
        });
        
        letterButtonsEl.appendChild(button);
    }
}

function createFaders() {
    const fadersContainerEl = document.getElementById('fadersContainer');
    
    for (let i = 1; i <= 9; i++) {
        const faderContainer = document.createElement('div');
        faderContainer.className = 'fader';
        
        const faderLabel = document.createElement('div');
        faderLabel.className = 'fader-label';
        faderLabel.textContent = `F${i}`;
        
        const faderTrack = document.createElement('div');
        faderTrack.className = 'fader-track';
        
        const faderKnob = document.createElement('div');
        faderKnob.className = 'fader-knob';
        faderKnob.style.top = '50%';
        
        faderTrack.appendChild(faderKnob);
        faderContainer.appendChild(faderLabel);
        faderContainer.appendChild(faderTrack);
        fadersContainerEl.appendChild(faderContainer);
        
        // Store reference
        faders[`Fader${i}`] = {
            track: faderTrack,
            knob: faderKnob,
            value: 64
        };
    }
}

function togglePadClick(pad) {
    const midiNote = parseInt(pad.getAttribute('data-note'));
    const row = pad.getAttribute('data-row');
    const col = pad.getAttribute('data-col');
    const coordRow = 7 - row; // Convert to display coordinates
    
    // Get selected color
    const color = colorPalette.find(c => c.value === selectedColor);
    
    // Handle "Off" color specially - remove assignment and turn off LED
    if (selectedColor === 'off') {
        pad.classList.remove('clicked');
        // Remove color styling
        pad.style.backgroundColor = '';
        pad.style.borderColor = '';
        // Remove button state tracking
        delete buttonStates[midiNote];
        console.log(`Web App: Removed color assignment from pad [${coordRow},${col}] - MIDI Note: ${midiNote}`);
        // Send Note Off to controller (turn off LED)
        sendMIDIToController(midiNote, false, 0);
        return;
    }
    
    // Assign color to button (this sets up the button for the selected behavior)
    buttonStates[midiNote] = {
        isOn: true, // Always start ON when assigned
        assignedColor: selectedColor,
        behavior: selectedButtonBehavior // Store the behavior type
    };
    
    // Apply visual styling to show assignment
    pad.classList.add('clicked');
    pad.style.backgroundColor = color.css;
    pad.style.borderColor = color.css;
    console.log(`Web App: Assigned ${color.name} color to pad [${coordRow},${col}] - MIDI Note: ${midiNote} (immediately ON)`);
    
    // Immediately turn ON the LED on the physical controller
    sendMIDIToController(midiNote, true, color.velocity);
}

function toggleButtonState(midiNote) {
    // Check if this button has an assigned color
    if (!buttonStates[midiNote]) {
        console.log(`Physical Controller: Button ${midiNote} pressed but no color assigned - ignoring`);
        return;
    }
    
    const buttonState = buttonStates[midiNote];
    const pad = gridPads[midiNote];
    
    if (!pad) {
        console.log(`Physical Controller: Button ${midiNote} pressed but pad not found`);
        return;
    }
    
    // Handle behavior based on button type
    if (buttonState.behavior === 'solid') {
        // "Solid" behavior: Button stays ON when pressed (no toggle)
        console.log(`Physical Controller: Button ${midiNote} pressed but behavior is "solid" - staying ON`);
        return;
    } else if (buttonState.behavior === 'toggle') {
        // "Toggle" behavior: Toggle between ON and OFF
        buttonState.isOn = !buttonState.isOn;
        
        // Get the assigned color
        const color = colorPalette.find(c => c.value === buttonState.assignedColor);
        
        if (buttonState.isOn) {
            // Turn ON: Send LED with assigned color
            sendMIDIToController(midiNote, true, color.velocity);
            console.log(`Physical Controller: Toggled button ${midiNote} ON with ${color.name} color`);
        } else {
            // Turn OFF: Send LED off
            sendMIDIToController(midiNote, false, 0);
            console.log(`Physical Controller: Toggled button ${midiNote} OFF`);
        }
    }
}

function toggleButtonClick(button) {
    const control = button.getAttribute('data-control');
    const midiNote = parseInt(button.getAttribute('data-note'));
    
    // Get selected color
    const color = colorPalette.find(c => c.value === selectedColor);
    
    // Handle "Off" color specially - always turn off LED
    if (selectedColor === 'off') {
        button.classList.remove('clicked');
        // Remove color styling
        button.style.backgroundColor = '';
        button.style.borderColor = '';
        console.log(`Web App: Turned off button ${control} with Off color`);
        // Send Note Off to controller (turn off LED)
        if (midiNote !== null && !isNaN(midiNote)) {
            sendMIDIToController(midiNote, false, 0);
        }
        return;
    }
    
    // Toggle clicked state for non-off colors
    if (button.classList.contains('clicked')) {
        button.classList.remove('clicked');
        // Remove color styling
        button.style.backgroundColor = '';
        button.style.borderColor = '';
        console.log(`Web App: Released button ${control}`);
        // Send Note Off to controller (turn off LED)
        if (midiNote !== null && !isNaN(midiNote)) {
            sendMIDIToController(midiNote, false, 0);
        }
    } else {
        button.classList.add('clicked');
        // Apply selected color styling
        button.style.backgroundColor = color.css;
        button.style.borderColor = color.css;
        console.log(`Web App: Pressed button ${control} with ${color.name}`);
        // Send Note On to controller (turn on LED with selected color)
        if (midiNote !== null && !isNaN(midiNote)) {
            sendMIDIToController(midiNote, true, color.velocity);
        }
    }
}

function clearGrid() {
    // Remove active states from all grid pads
    Object.values(gridPads).forEach(pad => {
        pad.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high', 'clicked');
    });
    
    // Turn off all LEDs on controller
    Object.keys(gridPads).forEach(midiNote => {
        sendMIDIToController(parseInt(midiNote), false, 0);
    });
    
    // Remove active states from circular buttons
    Object.values(circularButtons).forEach(button => {
        button.classList.remove('active', 'clicked');
    });
    
    // Reset faders to middle position
    Object.values(faders).forEach(fader => {
        fader.knob.style.top = '50%';
        fader.value = 64;
    });
}

function resetAllPads() {
    // Turn off all grid pad LEDs on controller
    for (let midiNote = 0; midiNote < 64; midiNote++) {
        sendMIDIToController(midiNote, false, 0);
    }
    
    // Remove clicked states from all web app pads
    Object.values(gridPads).forEach(pad => {
        pad.classList.remove('clicked');
        // Reset to default background color
        pad.style.backgroundColor = '';
        pad.style.borderColor = '';
    });
    
    // Remove clicked states from circular buttons
    Object.values(circularButtons).forEach(button => {
        button.classList.remove('clicked');
        // Reset to default background color
        button.style.backgroundColor = '';
        button.style.borderColor = '';
    });
    
    // Clear all button states
    Object.keys(buttonStates).forEach(midiNote => {
        delete buttonStates[midiNote];
    });
    
    console.log('All pads reset - LEDs turned off and button states cleared');
}

function showDebugInfo() {
    console.log('=== DEBUG INFO ===');
    console.log('Selected Color:', selectedColor);
    console.log('Selected Button Behavior:', selectedButtonBehavior);
    console.log('MIDI Outputs:', midiOutputs.length);
    console.log('Active Grid Pads:', Object.keys(gridPads).length);
    console.log('Clicked Pads:', Object.values(gridPads).filter(pad => pad.classList.contains('clicked')).length);
    console.log('Button States:', Object.keys(buttonStates).length);
    console.log('WebMidi.js Version:', WebMidi ? 'Available' : 'Not Available');
    console.log('Current Timestamp:', new Date().toLocaleTimeString());
    
    // Show button states details
    if (Object.keys(buttonStates).length > 0) {
        console.log('Button State Details:');
        Object.entries(buttonStates).forEach(([midiNote, state]) => {
            console.log(`  Note ${midiNote}: ${state.assignedColor} - ${state.isOn ? 'ON' : 'OFF'} (${state.behavior})`);
        });
    }
    
    // Check for any potential issues
    const clickedPads = Object.values(gridPads).filter(pad => pad.classList.contains('clicked'));
    if (clickedPads.length > 0) {
        console.log('Clicked Pad Details:');
        clickedPads.forEach(pad => {
            const midiNote = pad.getAttribute('data-note');
            const color = colorPalette.find(c => c.value === selectedColor);
            console.log(`  Pad ${midiNote}: Color ${color.name}, Velocity ${color.velocity}`);
        });
    }
    console.log('=== END DEBUG ===');
}

function getNoteNameFromMIDI(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave} (${midiNote})`;
}
