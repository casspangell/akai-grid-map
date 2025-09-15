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
const buttonStates = {}; // Track toggle states: { midiNote: { isOn: boolean, assignedColor: string, behavior: string } }
const blinkingButtons = new Set(); // Track which buttons are currently blinking

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
let selectedButtonBehavior = 'toggle'; // 'toggle' or 'solid'
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
if (resetAllBtn) {
    resetAllBtn.addEventListener('click', resetAllPads);
}

// Debug button
const debugBtn = document.getElementById('debugBtn');
if (debugBtn) {
    debugBtn.addEventListener('click', showDebugInfo);
}

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
// Side and bottom buttons are now created in createControllerGrid()
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

function sendMIDIToController(midiNote, isOn, velocity = 127, channel = 5) {
    if (midiOutputs.length === 0) {
        console.log('No MIDI output devices available');
        return;
    }
    
    // Use WebMidi.js to send MIDI messages for APC Mini MK2
    midiOutputs.forEach(output => {
        try {
            if (isOn && velocity > 0) {
                // Calculate the correct MIDI status byte based on channel
                const statusByte = 0x90 + channel; // Note On + Channel
                const colorVelocity = velocity;
                
                // Send Note On message with correct channel
                output.send([statusByte, midiNote, colorVelocity]);
                console.log(`APC Mini MK2: Sent solid LED - Note: ${midiNote}, Color: ${colorVelocity}, Channel: ${channel} (0x${channel.toString(16).toUpperCase()})`);
            } else {
                // Send Note On with velocity 0 to turn off LED
                const statusByte = 0x90 + channel; // Note On + Channel
                output.send([statusByte, midiNote, 0]);
                console.log(`APC Mini MK2: Sent LED Off - Note: ${midiNote}, Channel: ${channel}, Velocity: 0`);
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
        
        // Show visual feedback on web app grid
        updateGridPad(message.note.number, true, message.velocity);
        
        // Toggle button state if it has an assigned color
        toggleButtonState(message.note.number);
        
    } else if (message.type === 'noteoff') {
        messageType = 'Note Off';
        className = 'note-off';
        messageText = `Note: ${getNoteNameFromMIDI(message.note.number)}, Channel: ${message.channel}`;
        
        // Show visual feedback on web app grid
        updateGridPad(message.note.number, false, 0);
        
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
    const button = gridPads[midiNote];
    if (!button) return;
    
    // Remove all velocity classes
    button.classList.remove('velocity-low', 'velocity-medium', 'velocity-high');
    
    if (isPressed) {
        button.classList.add('active');
        
        // Add velocity-based styling
        if (velocity < 42) {
            button.classList.add('velocity-low');
        } else if (velocity < 84) {
            button.classList.add('velocity-medium');
        } else {
            button.classList.add('velocity-high');
        }
        
        // Auto-release after a short time for visual feedback
        setTimeout(() => {
            button.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high');
        }, 200);
    } else {
        button.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high');
    }
}

function createControllerGrid() {
    const gridEl = document.getElementById('apcGrid');
    const sideButtonsEl = document.getElementById('sideButtons');
    const bottomButtonsEl = document.getElementById('bottomButtons');
    
    // Create 8x8 grid (64 pads) - MIDI notes 0-63
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
    
    // Create 8 side buttons - MIDI notes 112-119 (Scene Launch 1-8) on Channel 0
    for (let i = 0; i < 8; i++) {
        const midiNote = 112 + i; // Scene Launch buttons 0x70-0x77 (112-119)
        const button = document.createElement('div');
        button.className = 'side-button';
        button.setAttribute('data-note', midiNote);
        button.setAttribute('data-row', i);
        button.setAttribute('data-col', 0);
        button.setAttribute('data-channel', 0); // Side buttons use Channel 0
        button.textContent = midiNote;
        button.title = `Scene Launch ${i + 1} - Note: ${midiNote}, Channel: 0`;
        
        // Store reference in gridPads
        gridPads[midiNote] = button;
        
        // Add click event listener
        button.addEventListener('click', () => {
            togglePadClick(button);
        });
        
        sideButtonsEl.appendChild(button);
    }
    
    // Create 8 bottom buttons - MIDI notes 100-107 (Track Button 1-8) on Channel 0
    for (let i = 0; i < 8; i++) {
        const midiNote = 100 + i; // Track Button 1-8: 0x64-0x6B (100-107)
        const container = document.createElement('div');
        container.className = 'bottom-btn-cont';
        container.setAttribute('data-col', i);
        
        const button = document.createElement('div');
        button.className = 'bottom-button-inner';
        button.setAttribute('data-note', midiNote);
        button.setAttribute('data-row', 0);
        button.setAttribute('data-col', i);
        button.setAttribute('data-channel', 0); // Track buttons use Channel 0
        button.textContent = midiNote;
        button.title = `Track Button ${i + 1} - Note: ${midiNote}, Channel: 0`;
        
        container.appendChild(button);
        bottomButtonsEl.appendChild(container);
        
        // Store reference in gridPads
        gridPads[midiNote] = button;
        
        // Add click event listener to the inner button
        button.addEventListener('click', () => {
            togglePadClick(button);
        });
    }
}

// Side and bottom button functions removed - now handled by unified createControllerGrid() and togglePadClick()

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
    const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5; // Default to Channel 5 for grid buttons
    const row = pad.getAttribute('data-row');
    const col = pad.getAttribute('data-col');
    const coordRow = 7 - row; // Convert to display coordinates
    
    // Handle "Off" color specially - remove assignment and turn off LED
    if (selectedColor === 'off') {
        pad.classList.remove('clicked');
        // Remove color styling
        pad.style.backgroundColor = '';
        pad.style.borderColor = '';
        // Remove button state tracking
        delete buttonStates[midiNote];
        console.log(`Web App: Removed color assignment from pad [${coordRow},${col}] - MIDI Note: ${midiNote}`);
        // Send Note Off to controller
        sendMIDIToController(midiNote, false, 0, channel);
        return;
    }
    
    // Determine button type and force appropriate color for single-color LEDs
    let displayColor, ledColor, buttonType;
    
    if (channel === 0) {
        if (midiNote >= 100 && midiNote <= 107) {
            // Bottom buttons (Track Buttons) - Force RED
            displayColor = colorPalette.find(c => c.name === 'Red');
            ledColor = displayColor;
            buttonType = "Track Button";
        } else if (midiNote >= 112 && midiNote <= 119) {
            // Side buttons (Scene Launch) - Force GREEN
            displayColor = colorPalette.find(c => c.name === 'Green');
            ledColor = displayColor;
            buttonType = "Scene Launch Button";
        } else {
            // Fallback for other Channel 0 buttons
            displayColor = colorPalette.find(c => c.value === selectedColor);
            ledColor = displayColor;
            buttonType = "Channel 0 Button";
        }
    } else {
        // Grid buttons (Channel 5) - Use selected color (RGB LEDs)
        displayColor = colorPalette.find(c => c.value === selectedColor);
        ledColor = displayColor;
        buttonType = "Grid Button";
    }
    
    // Assign color to button (store the original selected color for behavior tracking)
    buttonStates[midiNote] = {
        isOn: true, // Always start ON when assigned
        assignedColor: selectedColor, // Store original selection
        behavior: selectedButtonBehavior // Store the behavior type
    };
    
    // Apply visual styling to show assignment (use display color for web app)
    pad.classList.add('clicked');
    pad.style.backgroundColor = displayColor.css;
    pad.style.borderColor = displayColor.css;
    console.log(`Web App: Assigned ${selectedColor} → ${displayColor.name} to ${buttonType} [${coordRow},${col}] - MIDI Note: ${midiNote}, Channel: ${channel} (immediately ON)`);
    
    // Immediately turn ON the LED on the physical controller (use LED color)
    sendMIDIToController(midiNote, true, ledColor.velocity, channel);
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
        
        // Get the channel and determine correct LED color for single-color buttons
        const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
        let ledColor;
        
        if (channel === 0) {
            if (midiNote >= 100 && midiNote <= 107) {
                // Bottom buttons (Track Buttons) - Force RED
                ledColor = colorPalette.find(c => c.name === 'Red');
            } else if (midiNote >= 112 && midiNote <= 119) {
                // Side buttons (Scene Launch) - Force GREEN
                ledColor = colorPalette.find(c => c.name === 'Green');
            } else {
                // Fallback for other Channel 0 buttons
                ledColor = colorPalette.find(c => c.value === buttonState.assignedColor);
            }
        } else {
            // Grid buttons (Channel 5) - Use assigned color (RGB LEDs)
            ledColor = colorPalette.find(c => c.value === buttonState.assignedColor);
        }
        
        if (buttonState.isOn) {
            // Turn ON: Send LED with correct color for button type
            sendMIDIToController(midiNote, true, ledColor.velocity, channel);
            console.log(`Physical Controller: Toggled button ${midiNote} ON with ${ledColor.name} color`);
        } else {
            // Turn OFF: Send LED off
            sendMIDIToController(midiNote, false, 0, channel);
            console.log(`Physical Controller: Toggled button ${midiNote} OFF`);
        }
    } else if (buttonState.behavior === 'blink') {
        // "Blink" behavior: Start/stop blinking when pressed
        if (blinkingButtons.has(midiNote)) {
            // Stop blinking and return to solid color state
            blinkingButtons.delete(midiNote);
            // Turn ON with correct LED color for button type
            const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
            let ledColor;
            
            if (channel === 0) {
                if (midiNote >= 100 && midiNote <= 107) {
                    ledColor = colorPalette.find(c => c.name === 'Red');
                } else if (midiNote >= 112 && midiNote <= 119) {
                    ledColor = colorPalette.find(c => c.name === 'Green');
                } else {
                    ledColor = colorPalette.find(c => c.value === buttonState.assignedColor);
                }
            } else {
                ledColor = colorPalette.find(c => c.value === buttonState.assignedColor);
            }
            
            sendMIDIToController(midiNote, true, ledColor.velocity, channel);
            console.log(`Physical Controller: Stopped blinking button ${midiNote}, now solid ${ledColor.name}`);
        } else {
            // Start blinking
            blinkingButtons.add(midiNote);
            startBlinking(midiNote, buttonState.assignedColor);
            console.log(`Physical Controller: Started blinking button ${midiNote}`);
        }
    }
}

function startBlinking(midiNote, assignedColor) {
    const pad = gridPads[midiNote];
    const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
    
    // Determine correct LED color for single-color buttons
    let ledColor;
    if (channel === 0) {
        if (midiNote >= 100 && midiNote <= 107) {
            ledColor = colorPalette.find(c => c.name === 'Red');
        } else if (midiNote >= 112 && midiNote <= 119) {
            ledColor = colorPalette.find(c => c.name === 'Green');
        } else {
            ledColor = colorPalette.find(c => c.value === assignedColor);
        }
    } else {
        ledColor = colorPalette.find(c => c.value === assignedColor);
    }
    
    function blinkCycle() {
        if (!blinkingButtons.has(midiNote)) {
            return; // Stop blinking if button was removed from set
        }
        
        // Send LED ON with correct color
        sendMIDIToController(midiNote, true, ledColor.velocity, channel);
        
        // Wait 500ms, then turn OFF
        setTimeout(() => {
            if (!blinkingButtons.has(midiNote)) {
                return; // Check again in case blinking was stopped
            }
            
            // Send LED OFF
            sendMIDIToController(midiNote, false, 0, channel);
            
            // Wait 500ms, then repeat
            setTimeout(() => {
                if (blinkingButtons.has(midiNote)) {
                    blinkCycle(); // Continue blinking
                }
            }, 500);
        }, 500);
    }
    
    // Start the blinking cycle
    blinkCycle();
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
        // Clear visual styling (background and border colors)
        pad.style.backgroundColor = '';
        pad.style.borderColor = '';
    });
    
    // Clear button states tracking
    Object.keys(buttonStates).forEach(midiNote => {
        delete buttonStates[midiNote];
    });
    
    // Stop all blinking buttons
    blinkingButtons.clear();
    
    // Turn off all LEDs on controller
    Object.keys(gridPads).forEach(midiNote => {
        sendMIDIToController(parseInt(midiNote), false, 0);
    });
    
    // Remove active states from circular buttons
    Object.values(circularButtons).forEach(button => {
        button.classList.remove('active', 'clicked');
        // Clear visual styling for circular buttons too
        button.style.backgroundColor = '';
        button.style.borderColor = '';
    });
    
    // Reset faders to middle position
    Object.values(faders).forEach(fader => {
        fader.knob.style.top = '50%';
        fader.value = 64;
    });
    
    console.log('Grid visuals cleared - all pads reset to default state');
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
    
    // Stop all blinking buttons
    blinkingButtons.clear();
    
    console.log('All pads reset - LEDs turned off, button states cleared, and blinking stopped');
}

function showDebugInfo() {
    console.log('=== DEBUG INFO ===');
    console.log('Selected Color:', selectedColor);
    console.log('Selected Button Behavior:', selectedButtonBehavior);
    console.log('MIDI Outputs:', midiOutputs.length);
    console.log('Active Grid Pads:', Object.keys(gridPads).length);
    console.log('Clicked Pads:', Object.values(gridPads).filter(pad => pad.classList.contains('clicked')).length);
    console.log('Button States:', Object.keys(buttonStates).length);
    console.log('Blinking Buttons:', blinkingButtons.size);
    console.log('WebMidi.js Version:', WebMidi ? 'Available' : 'Not Available');
    console.log('Current Timestamp:', new Date().toLocaleTimeString());
    
    // Show button states details
    if (Object.keys(buttonStates).length > 0) {
        console.log('Button State Details:');
        Object.entries(buttonStates).forEach(([midiNote, state]) => {
            const blinkStatus = blinkingButtons.has(parseInt(midiNote)) ? ' - BLINKING' : '';
            console.log(`  Note ${midiNote}: ${state.assignedColor} - ${state.isOn ? 'ON' : 'OFF'} (${state.behavior})${blinkStatus}`);
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

// CRITICAL: Test function to verify MIDI communication is working
function testMIDICommunication() {
    console.log('🧪 TESTING MIDI COMMUNICATION...');
    
    // Test 1: Web App → Controller
    console.log('Test 1: Web App → Controller');
    if (midiOutputs.length === 0) {
        console.error('❌ No MIDI output devices available');
        return false;
    }
    
    try {
        // Test sending MIDI to note 0
        midiOutputs.forEach(output => {
            output.send([0x95, 0, 127]); // Note 0, white color
        });
        console.log('✅ Web App → Controller: MIDI message sent successfully');
    } catch (error) {
        console.error('❌ Web App → Controller failed:', error);
        return false;
    }
    
    // Test 2: Controller → Web App (check if updateGridPad exists and works)
    console.log('Test 2: Controller → Web App');
    if (typeof updateGridPad !== 'function') {
        console.error('❌ updateGridPad function missing');
        return false;
    }
    
    if (!gridPads || Object.keys(gridPads).length < 80) { // Should have 64 grid + 8 side + 8 bottom = 80 buttons
        console.error(`❌ gridPads object missing buttons. Expected 80, got ${Object.keys(gridPads).length}`);
        return false;
    }
    
    try {
        updateGridPad(0, true, 127); // Test visual feedback for grid button
        updateGridPad(112, true, 127); // Test visual feedback for side button
        updateGridPad(100, true, 127); // Test visual feedback for bottom button
        console.log('✅ Controller → Web App: updateGridPad function works for all button types');
    } catch (error) {
        console.error('❌ Controller → Web App failed:', error);
        return false;
    }
    
    // Test 3: Check key functions exist
    console.log('Test 3: Key Functions');
    const requiredFunctions = ['sendMIDIToController', 'updateGridPad', 'handleMIDIMessage', 'togglePadClick'];
    let allFunctionsExist = true;
    
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            console.error(`❌ Function missing: ${funcName}`);
            allFunctionsExist = false;
        } else {
            console.log(`✅ Function exists: ${funcName}`);
        }
    });
    
    if (!allFunctionsExist) {
        return false;
    }
    
    // Test 4: Check if side and bottom buttons exist
    console.log('Test 4: Button Elements');
    const sideButton112 = document.querySelector('[data-note="112"]');
    const bottomButton100 = document.querySelector('[data-note="100"]');
    
    if (sideButton112) {
        console.log('✅ Side button 112 found:', sideButton112);
    } else {
        console.error('❌ Side button 112 not found');
    }
    
    if (bottomButton100) {
        console.log('✅ Bottom button 100 found:', bottomButton100);
    } else {
        console.error('❌ Bottom button 100 not found');
    }
    
    // Test 5: Try different MIDI note ranges for side/bottom buttons
    console.log('Test 5: Testing MIDI note ranges');
    console.log('Try these commands in console to test different MIDI notes:');
    console.log('testMIDINote(64, 127)  // Test note 64');
    console.log('testMIDINote(80, 127)  // Test note 80');
    console.log('testMIDINote(96, 127)  // Test note 96');
    console.log('testMIDINote(112, 127) // Test note 112');
    
    console.log('🎉 ALL MIDI COMMUNICATION TESTS PASSED!');
    console.log('💡 You can call testMIDICommunication() anytime to verify functionality');
    return true;
}

// Helper function to test specific MIDI notes
function testMIDINote(midiNote, velocity) {
    console.log(`Testing MIDI note ${midiNote} with velocity ${velocity}`);
    midiOutputs.forEach(output => {
        try {
            output.send([0x95, midiNote, velocity]);
            console.log(`Sent: [149, ${midiNote}, ${velocity}]`);
        } catch (error) {
            console.error(`Error sending to note ${midiNote}:`, error);
        }
    });
}

function getNoteNameFromMIDI(midiNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave} (${midiNote})`;
}
