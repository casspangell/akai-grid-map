// MIDI Controller App - JavaScript

// DOM Elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('statusText');
const loadingSpinnerEl = document.getElementById('loadingSpinner');
const findMidiBtn = document.getElementById('findMidiBtn');
const deviceListEl = document.getElementById('deviceList');
const midiLogEl = document.getElementById('midiLog');
const clearBtn = document.getElementById('clearBtn');
const clearGridBtn = document.getElementById('clearGridBtn');
const saveStateBtn = document.getElementById('saveStateBtn');
const saveStateDialog = document.getElementById('saveStateDialog');
const stateNameInput = document.getElementById('stateNameInput');
const saveStateOk = document.getElementById('saveStateOk');
const saveStateCancel = document.getElementById('saveStateCancel');
const loadStateBtn = document.getElementById('loadStateBtn');

// MIDI Variables
let midiOutputs = [];

// Controller grid mapping (8x8 = 64 pads, notes 0-63)
// [0,0] = bottom-left = note 0, reading left to right, bottom to top
const gridPads = {};
const controllerNotes = {};
const buttonStates = {}; // Track toggle states: { midiNote: { isOn: boolean, assignedColor: string, behavior: string } }
const blinkingButtons = new Set(); // Track which buttons are currently blinking
const pendingConfirmations = {}; // Track pending web->controller state changes awaiting confirmation
const midiMessageQueue = []; // Queue for MIDI messages to prevent overwhelming the controller
let isProcessingQueue = false; // Flag to track if queue is being processed

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
    { name: 'Orange', value: 'orange', css: '#CC4400', velocity: 9 },
    { name: 'Yellow', value: 'yellow', css: '#FFFF00', velocity: 13 },
    { name: 'Green', value: 'green', css: '#00FF00', velocity: 21 },
    { name: 'Blue', value: 'blue', css: '#0000FF', velocity: 45 },
    { name: 'Purple', value: 'purple', css: '#5400FF', velocity: 49 },
    { name: 'Pink', value: 'pink', css: '#FF00FF', velocity: 53 },
    { name: 'Off', value: 'off', css: '#000000', velocity: 0 }
];

// Check if WebMidi.js is available
if (typeof WebMidi === 'undefined') {
    statusEl.className = 'status disconnected';
    statusTextEl.textContent = 'WebMidi.js library not loaded';
    loadingSpinnerEl.style.display = 'none';
    findMidiBtn.style.display = 'block';
}

// Event Listeners
// Auto-enable MIDI on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(enableMIDI, 500); // Small delay to ensure page is fully loaded
});

findMidiBtn.addEventListener('click', enableMIDI);
clearBtn.addEventListener('click', () => {
    midiLogEl.innerHTML = '';
});
clearGridBtn.addEventListener('click', async () => {
    await clearGrid();
});
saveStateBtn.addEventListener('click', showSaveDialog);
saveStateOk.addEventListener('click', saveGridState);
saveStateCancel.addEventListener('click', hideSaveDialog);
loadStateBtn.addEventListener('click', () => loadGridState());


// Reset all pads button
const resetAllBtn = document.getElementById('resetAllBtn');
if (resetAllBtn) {
    resetAllBtn.addEventListener('click', async () => {
        await resetAllPads();
    });
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
        // Show loading state
        statusEl.className = 'status loading';
        statusTextEl.textContent = 'Connecting to MIDI devices...';
        loadingSpinnerEl.style.display = 'block';
        
        await WebMidi.enable();
        
        // Update to connected state
        statusEl.className = 'status connected';
        statusTextEl.textContent = 'MIDI enabled successfully';
        loadingSpinnerEl.style.display = 'none';
        findMidiBtn.style.display = 'none';
        
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
        statusEl.className = 'status disconnected';
        statusTextEl.textContent = 'Failed to access MIDI devices: ' + error.message;
        loadingSpinnerEl.style.display = 'none';
        findMidiBtn.style.display = 'block';
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

// Async function to send MIDI messages (non-blocking)
async function sendMIDIToController(midiNote, isOn, velocity = 127, channel = 5) {
    if (midiOutputs.length === 0) {
        console.log('No MIDI output devices available');
        return;
    }
    
    // Check for duplicate commands in queue (same note, same state)
    // Remove duplicates to prevent redundant messages
    const existingIndex = midiMessageQueue.findIndex(cmd => 
        cmd.midiNote === midiNote && 
        cmd.isOn === isOn && 
        cmd.velocity === velocity && 
        cmd.channel === channel
    );
    
    if (existingIndex !== -1) {
        // Update timestamp of existing command instead of adding duplicate
        midiMessageQueue[existingIndex].timestamp = Date.now();
        console.log(`🔄 Updated existing queue command for note ${midiNote} instead of duplicating`);
        return;
    }
    
    // Add to queue instead of sending immediately
    const midiCommand = {
        midiNote,
        isOn,
        velocity,
        channel,
        timestamp: Date.now()
    };
    
    midiMessageQueue.push(midiCommand);
    console.log(`📝 Queued MIDI message for note ${midiNote} (Queue size: ${midiMessageQueue.length})`);
    
    // Start processing queue if not already running
    if (!isProcessingQueue) {
        processMessageQueue();
    }
}

// Process MIDI message queue asynchronously
async function processMessageQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    
    while (midiMessageQueue.length > 0) {
        const command = midiMessageQueue.shift();
        
        // Send the actual MIDI message with retry logic
        let retries = 0;
        let success = false;
        
        while (!success && retries < 3) {
            try {
                await sendMIDIImmediate(command.midiNote, command.isOn, command.velocity, command.channel);
                success = true;
            } catch (error) {
                retries++;
                console.warn(`⚠️ MIDI send failed for note ${command.midiNote}, retry ${retries}/3`);
                if (retries < 3) {
                    await sleep(20); // Wait 20ms before retry
                }
            }
        }
        
        if (!success) {
            console.error(`❌ Failed to send MIDI message for note ${command.midiNote} after 3 attempts`);
        }
        
        // Longer delay between messages to prevent overwhelming the controller
        // APC Mini MK2 can be sensitive to rapid message bursts
        await sleep(15); // Increased to 15ms delay between messages
    }
    
    isProcessingQueue = false;
}

// Helper function for async sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Immediate MIDI send function (called by queue processor)
async function sendMIDIImmediate(midiNote, isOn, velocity = 127, channel = 5) {
    // Validate MIDI outputs are still available
    if (!midiOutputs || midiOutputs.length === 0) {
        throw new Error('No MIDI outputs available');
    }
    
    // Send the message 5 times for reliability (quintuple-bang)
    const BANG_COUNT = 5;
    const BANG_DELAY = 3; // ms between bangs
    
    for (let bang = 0; bang < BANG_COUNT; bang++) {
        // Use WebMidi.js to send MIDI messages for APC Mini MK2
        const promises = midiOutputs.map(output => {
            return new Promise((resolve, reject) => {
                try {
                    // Check if output is still valid
                    if (!output || typeof output.send !== 'function') {
                        reject(new Error(`Invalid MIDI output: ${output ? output.name : 'null'}`));
                        return;
                    }
                    
                    if (isOn && velocity > 0) {
                        // Calculate the correct MIDI status byte based on channel
                        const statusByte = 0x90 + channel; // Note On + Channel
                        const colorVelocity = velocity;
                        
                        // Send Note On message with correct channel
                        output.send([statusByte, midiNote, colorVelocity]);
                        if (bang === 0) {
                            console.log(`✅ APC Mini MK2: Sent solid LED (x${BANG_COUNT}) - Note: ${midiNote}, Color: ${colorVelocity}, Channel: ${channel} (0x${channel.toString(16).toUpperCase()})`);
                        }
                    } else {
                        // Send Note On with velocity 0 to turn off LED
                        const statusByte = 0x90 + channel; // Note On + Channel
                        output.send([statusByte, midiNote, 0]);
                        if (bang === 0) {
                            console.log(`✅ APC Mini MK2: Sent LED Off (x${BANG_COUNT}) - Note: ${midiNote}, Channel: ${channel}, Velocity: 0`);
                        }
                    }
                    
                    // Small delay to ensure the message is sent before resolving
                    setTimeout(() => resolve(), 1);
                } catch (error) {
                    console.error(`❌ Error sending MIDI to ${output ? output.name : 'unknown'}:`, error);
                    reject(error);
                }
            });
        });
        
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error(`❌ Failed to send MIDI message for note ${midiNote} (bang ${bang + 1}/${BANG_COUNT}):`, error);
            throw error; // Re-throw for retry logic
        }
        
        // Wait between bangs (except after the last one)
        if (bang < BANG_COUNT - 1) {
            await sleep(BANG_DELAY);
        }
    }
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
        
        // Check if this is an echo from a web-initiated command
        if (pendingConfirmations[message.note.number]) {
            const pending = pendingConfirmations[message.note.number];
            
            if (pending.type === 'echo' && Math.abs(Date.now() - pending.timestamp) < 500) {
                // This is likely an echo from our own command - ignore it
                console.log(`🔄 Ignoring controller echo for MIDI Note ${message.note.number} (web-initiated)`);
                delete pendingConfirmations[message.note.number];
                
                // Show brief visual feedback but don't toggle state
                updateGridPad(message.note.number, true, message.velocity);
                
                // Still log it
                const logEntry = document.createElement('div');
                logEntry.className = `midi-message ${className}`;
                logEntry.innerHTML = `
                    <strong>[${timestamp}] ${messageType}</strong> <small>(echo)</small><br>
                    ${messageText}<br>
                    <small>Raw: [${message.rawData.join(', ')}]</small>
                `;
                midiLogEl.appendChild(logEntry);
                midiLogEl.scrollTop = midiLogEl.scrollHeight;
                
                return;
            }
        }
        
        // Special handler for MIDI note 100
        if (message.note.number === 100) {
            console.log("Loading dialogue1.json...");
            loadDialogueState('dialogue1.json');
            return; // Exit early to prevent normal button processing
        }
        
        // Special handler for MIDI note 101
        if (message.note.number === 101) {
            console.log("Loading dialogue2.json...");
            loadDialogueState('dialogue2.json');
            return; // Exit early to prevent normal button processing
        }
        
        // This is a physical button press from the controller
        console.log(`🎮 Physical controller button press detected: MIDI Note ${message.note.number}`);
        
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
            
            // Add click event listener (async to prevent blocking)
            pad.addEventListener('click', async () => {
                await togglePadClick(pad);
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
        
        // Add click event listener (async to prevent blocking)
        button.addEventListener('click', async () => {
            await togglePadClick(button);
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
        
        // Add click event listener to the inner button (async to prevent blocking)
        button.addEventListener('click', async () => {
            await togglePadClick(button);
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
        
        // Add click event listener (async to prevent blocking)
        button.addEventListener('click', async () => {
            await toggleButtonClick(button);
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
        
        // Add click event listener (async to prevent blocking)
        button.addEventListener('click', async () => {
            await toggleButtonClick(button);
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

async function togglePadClick(pad) {
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
        // Send Note Off to controller (async, won't block)
        await sendMIDIToController(midiNote, false, 0, channel);
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
    
    // Add sending indicator
    pad.classList.add('sending');
    console.log(`Web App: Assigned ${selectedColor} → ${displayColor.name} to ${buttonType} [${coordRow},${col}] - MIDI Note: ${midiNote}, Channel: ${channel} (immediately ON)`);
    
    // Immediately turn ON the LED on the physical controller (use LED color)
    // This is async and won't block other button clicks
    await sendMIDIToController(midiNote, true, ledColor.velocity, channel);
    
    // Remove sending indicator after message is queued
    setTimeout(() => {
        pad.classList.remove('sending');
    }, 100);
    
    // Store pending confirmation to handle controller echo
    pendingConfirmations[midiNote] = {
        type: 'echo',
        timestamp: Date.now(),
        expectedVelocity: ledColor.velocity
    };
    
    // Clear the pending echo after 500ms (controller echoes happen quickly)
    setTimeout(() => {
        if (pendingConfirmations[midiNote] && pendingConfirmations[midiNote].type === 'echo') {
            delete pendingConfirmations[midiNote];
        }
    }, 500);
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
            // Turn OFF: Send white color instead of turning off completely
            const whiteColor = colorPalette.find(c => c.name === 'White');
            sendMIDIToController(midiNote, true, whiteColor.velocity, channel);
            console.log(`Physical Controller: Toggled button ${midiNote} to WHITE color`);
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

async function toggleButtonClick(button) {
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
        // Send Note Off to controller (turn off LED, async)
        if (midiNote !== null && !isNaN(midiNote)) {
            await sendMIDIToController(midiNote, false, 0);
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
        // Send Note Off to controller (turn off LED, async)
        if (midiNote !== null && !isNaN(midiNote)) {
            await sendMIDIToController(midiNote, false, 0);
        }
    } else {
        button.classList.add('clicked');
        // Apply selected color styling
        button.style.backgroundColor = color.css;
        button.style.borderColor = color.css;
        console.log(`Web App: Pressed button ${control} with ${color.name}`);
        // Send Note On to controller (turn on LED with selected color, async)
        if (midiNote !== null && !isNaN(midiNote)) {
            await sendMIDIToController(midiNote, true, color.velocity);
        }
    }
}

function clearGridVisuals() {
    // Remove active states from all grid pads (visual only, no MIDI)
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
}

async function resetAllMIDILEDs() {
    // Turn off all LEDs on the MIDI controller
    console.log('🔄 Resetting all MIDI controller LEDs...');
    
    // Clear the message queue first to prevent conflicts
    console.log(`🗑️ Clearing ${midiMessageQueue.length} pending messages from queue`);
    midiMessageQueue.length = 0;
    
    // Wait a moment for any in-progress message to complete
    await sleep(50);
    
    // Turn off all grid pads (notes 0-63) with channel 5
    for (let midiNote = 0; midiNote < 64; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 5);
    }
    
    // Turn off bottom buttons (notes 100-107) with channel 0
    for (let midiNote = 100; midiNote <= 107; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 0);
    }
    
    // Turn off side buttons (notes 112-119) with channel 0
    for (let midiNote = 112; midiNote <= 119; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 0);
    }
    
    // Wait for all queued messages to be sent
    while (isProcessingQueue || midiMessageQueue.length > 0) {
        await sleep(10);
    }
    
    console.log('✅ All MIDI controller LEDs reset complete!');
}

async function clearGrid() {
    console.log('🧹 Starting grid clear...');
    
    // Clear the message queue first to prevent conflicts
    console.log(`🗑️ Clearing ${midiMessageQueue.length} pending messages from queue`);
    midiMessageQueue.length = 0;
    
    // Wait a moment for any in-progress message to complete
    await sleep(50);
    
    // Remove active states from all grid pads
    Object.values(gridPads).forEach(pad => {
        pad.classList.remove('active', 'velocity-low', 'velocity-medium', 'velocity-high', 'clicked', 'sending');
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
    
    // Clear pending confirmations
    Object.keys(pendingConfirmations).forEach(midiNote => {
        delete pendingConfirmations[midiNote];
    });
    
    // Turn off all LEDs on controller with correct channels
    for (const midiNote of Object.keys(gridPads)) {
        const pad = gridPads[midiNote];
        if (pad) {
            const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
            await sendMIDIToController(parseInt(midiNote), false, 0, channel);
        }
    }
    
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
    
    // Wait for all queued messages to be sent
    while (isProcessingQueue || midiMessageQueue.length > 0) {
        await sleep(10);
    }
    
    console.log('✅ Grid cleared - all pads reset to default state');
}

// Save State Functions
function showSaveDialog() {
    saveStateDialog.style.display = 'flex';
    stateNameInput.value = '';
    stateNameInput.focus();
    
    // Add Enter key support
    stateNameInput.addEventListener('keydown', handleEnterKey);
}

function hideSaveDialog() {
    saveStateDialog.style.display = 'none';
    stateNameInput.removeEventListener('keydown', handleEnterKey);
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        saveGridState();
    } else if (event.key === 'Escape') {
        hideSaveDialog();
    }
}

async function saveGridState() {
    const stateName = stateNameInput.value.trim();
    
    if (!stateName) {
        alert('Please enter a name for the state');
        return;
    }
    
    // Collect all current button states
    const gridState = {
        name: stateName,
        timestamp: new Date().toISOString(),
        buttonStates: {},
        gridPads: {},
        circularButtons: {},
        faders: {}
    };
    
    // Save button states
    Object.keys(buttonStates).forEach(midiNote => {
        gridState.buttonStates[midiNote] = { ...buttonStates[midiNote] };
    });
    
    // Save grid pad visual states
    Object.keys(gridPads).forEach(midiNote => {
        const pad = gridPads[midiNote];
        gridState.gridPads[midiNote] = {
            backgroundColor: pad.style.backgroundColor || '',
            borderColor: pad.style.borderColor || '',
            hasClickedClass: pad.classList.contains('clicked'),
            hasActiveClass: pad.classList.contains('active')
        };
    });
    
    // Save circular button states
    Object.keys(circularButtons).forEach(control => {
        const button = circularButtons[control];
        gridState.circularButtons[control] = {
            backgroundColor: button.style.backgroundColor || '',
            borderColor: button.style.borderColor || '',
            hasClickedClass: button.classList.contains('clicked'),
            hasActiveClass: button.classList.contains('active')
        };
    });
    
    // Save fader states
    Object.keys(faders).forEach(control => {
        const fader = faders[control];
        gridState.faders[control] = {
            value: fader.value,
            knobTop: fader.knob.style.top
        };
    });
    
    // Save blinking buttons
    gridState.blinkingButtons = Array.from(blinkingButtons);
    
    // Try to use File System Access API for local development
    if ('showSaveFilePicker' in window) {
        try {
            const filename = `${stateName.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'JSON files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(gridState, null, 2));
            await writable.close();
            
            alert(`Grid state "${stateName}" saved successfully to ${fileHandle.name}!`);
            console.log(`Grid state "${stateName}" saved to file system`);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error saving file:', error);
                fallbackSaveMethod(gridState, stateName);
            }
        }
    } else {
        // Fallback for browsers without File System Access API
        fallbackSaveMethod(gridState, stateName);
    }
    
    hideSaveDialog();
}

function fallbackSaveMethod(gridState, stateName) {
    // Create JSON for adding to saved-states.json
    const jsonString = JSON.stringify(gridState, null, 2);
    
    // Create a formatted entry for the saved-states.json array
    const stateEntry = `    ${jsonString}`;
    
    // Copy the state entry to clipboard for easy pasting
    navigator.clipboard.writeText(stateEntry).then(() => {
        alert(`Grid state "${stateName}" ready to save!\n\n✅ State JSON copied to clipboard\n\n📁 Open saved-states.json in your project folder\n📋 Add a comma after the last state (if any)\n📋 Paste the JSON content as a new array item\n💾 Save the file\n\nThis will add your state to the saved-states.json file.`);
    }).catch(() => {
        alert(`Grid state "${stateName}" ready!\n\n📁 Open saved-states.json in your project folder\n📋 Copy the JSON content from the console\n💾 Paste and save in the file`);
        console.log('=== COPY THIS JSON TO saved-states.json ===');
        console.log('Add this as a new item in the "savedStates" array:');
        console.log(stateEntry);
        console.log('=== END JSON ===');
    });
}

// Load State Functions
async function loadGridState(filename = null) {
    try {
        // If filename is provided, load that specific file
        if (filename) {
            try {
                console.log(filename);
                
                // Check if filename is a string (file path) or FileSystemFileHandle
                let file, content;
                if (typeof filename === 'string') {
                    // For string filenames, fetch the file
                    const response = await fetch(filename);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
                    }
                    content = await response.text();
                } else {
                    // For FileSystemFileHandle objects
                    file = await filename.getFile();
                    content = await file.text();
                }
                
                try {
                    const gridState = JSON.parse(content);
                    restoreGridState(gridState);
                    console.log(`Grid state "${gridState.name || 'Unknown'}" loaded successfully`);
                } catch (parseError) {
                    alert('Error: Invalid JSON file format');
                    console.error('JSON parse error:', parseError);
                }
                return;
            } catch (fetchError) {
                console.error(`Error loading file ${filename}:`, fetchError);
                alert(`Error loading file ${filename}. Please check the filename and try again.`);
                return;
            }
        }

        // Check if File System Access API is available
        if ('showOpenFilePicker' in window) {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            try {
                const gridState = JSON.parse(content);
                restoreGridState(gridState);
                console.log(`Grid state "${gridState.name || 'Unknown'}" loaded successfully`);
            } catch (parseError) {
                alert('Error: Invalid JSON file format');
                console.error('JSON parse error:', parseError);
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error loading file:', error);
            alert('Error loading file. Please try again.');
        }
    }
}

// Load Dialogue State Function
async function loadDialogueState(filename) {
    try {
        console.log(`🎭 Loading dialogue state: ${filename}`);
        
        // Fetch the dialogue JSON file with cache-busting to always get the latest version
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(filename + cacheBuster);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const content = await response.text();
        
        try {
            const dialogueState = JSON.parse(content);
            restoreGridState(dialogueState);
            console.log(`🎭 Dialogue state "${dialogueState.name || filename}" loaded successfully`);
            
            // Show success message to user
            statusEl.className = 'status connected';
            statusTextEl.textContent = `Dialogue "${dialogueState.name || filename}" loaded successfully!`;
            
            // Clear the status message after 3 seconds
            setTimeout(() => {
                statusEl.className = 'status connected';
                statusTextEl.textContent = 'Connected to MIDI devices';
            }, 3000);
            
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            alert(`Error: Invalid JSON format in ${filename}`);
        }
        
    } catch (error) {
        console.error(`Error loading dialogue file ${filename}:`, error);
        alert(`Error loading ${filename}. Please make sure the file exists and is accessible.`);
        
        // Show error status
        statusEl.className = 'status disconnected';
        statusTextEl.textContent = `Failed to load ${filename}`;
        
        // Clear the error status after 3 seconds
        setTimeout(() => {
            statusEl.className = 'status connected';
            statusTextEl.textContent = 'Connected to MIDI devices';
        }, 3000);
    }
}

function restoreGridState(gridState) {
    console.log(`🔄 Loading JSON state: "${gridState.name || 'Unknown'}" - Turning on corresponding buttons on Akai pad...`);
    
    // Reset all MIDI controller LEDs first
    resetAllMIDILEDs();
    
    // Clear current state first (but don't send MIDI commands to avoid conflicts)
    clearGridVisuals();
    
    // Restore button states
    if (gridState.buttonStates) {
        Object.keys(gridState.buttonStates).forEach(midiNote => {
            buttonStates[midiNote] = { ...gridState.buttonStates[midiNote] };
        });
    }
    
    // Restore grid pad visual states
    if (gridState.gridPads) {
        Object.keys(gridState.gridPads).forEach(midiNote => {
            const pad = gridPads[midiNote];
            const padState = gridState.gridPads[midiNote];
            
            if (pad && padState) {
                if (padState.backgroundColor) {
                    pad.style.backgroundColor = padState.backgroundColor;
                }
                if (padState.borderColor) {
                    pad.style.borderColor = padState.borderColor;
                }
                if (padState.hasClickedClass) {
                    pad.classList.add('clicked');
                }
                if (padState.hasActiveClass) {
                    pad.classList.add('active');
                }
            }
        });
    }
    
    // Restore circular button states
    if (gridState.circularButtons) {
        Object.keys(gridState.circularButtons).forEach(control => {
            const button = circularButtons[control];
            const buttonState = gridState.circularButtons[control];
            
            if (button && buttonState) {
                if (buttonState.backgroundColor) {
                    button.style.backgroundColor = buttonState.backgroundColor;
                }
                if (buttonState.borderColor) {
                    button.style.borderColor = buttonState.borderColor;
                }
                if (buttonState.hasClickedClass) {
                    button.classList.add('clicked');
                }
                if (buttonState.hasActiveClass) {
                    button.classList.add('active');
                }
            }
        });
    }
    
    // Restore fader states
    if (gridState.faders) {
        Object.keys(gridState.faders).forEach(control => {
            const fader = faders[control];
            const faderState = gridState.faders[control];
            
            if (fader && faderState) {
                fader.value = faderState.value;
                fader.knob.style.top = faderState.knobTop;
            }
        });
    }
    
    // Restore blinking buttons
    if (gridState.blinkingButtons && Array.isArray(gridState.blinkingButtons)) {
        gridState.blinkingButtons.forEach(midiNote => {
            blinkingButtons.add(midiNote);
            if (buttonStates[midiNote]) {
                startBlinking(midiNote, buttonStates[midiNote].assignedColor);
            }
        });
    }
    
    // Wait a moment for any previous MIDI commands to complete, then restore LED states
    setTimeout(() => {
        console.log('🎯 Starting to restore LED states to physical controller...');
        
        // Send MIDI commands to controller to restore LED states
        // Add delay between commands to prevent overwhelming the controller
        console.log(`🎯 Processing ${Object.keys(buttonStates).length} button states for restoration...`);
        Object.keys(buttonStates).forEach((midiNote, index) => {
            const buttonState = buttonStates[midiNote];
            const pad = gridPads[midiNote];
            
            console.log(`🔍 Processing button ${midiNote}: isOn=${buttonState.isOn}, assignedColor=${buttonState.assignedColor}, behavior=${buttonState.behavior}`);
            
            if (pad && buttonState) {
                const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
                let ledColor;
                
                // Determine correct LED color for button type
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
                
                // Send MIDI command with delay to prevent overwhelming the controller
                setTimeout(() => {
                    if (buttonState.isOn && ledColor) {
                        sendMIDIToController(parseInt(midiNote), true, ledColor.velocity, channel);
                        console.log(`✅ Restored button ${midiNote} to ON with ${ledColor.name} color on channel ${channel}`);
                    } else if (!buttonState.isOn) {
                        // If button should be OFF, send white color (as per toggle behavior)
                        const whiteColor = colorPalette.find(c => c.name === 'White');
                        if (whiteColor) {
                            sendMIDIToController(parseInt(midiNote), true, whiteColor.velocity, channel);
                            console.log(`⚪ Restored button ${midiNote} to WHITE color (OFF state) on channel ${channel} - velocity: ${whiteColor.velocity}`);
                        } else {
                            console.error(`❌ White color not found in palette for button ${midiNote}`);
                        }
                    }
                }, index * 20); // Increased to 20ms delay between each command
            }
        });
        
        // Also restore any buttons that should be completely off (not just white)
        // This ensures buttons without assigned colors are turned off
        const assignedButtonCount = Object.keys(buttonStates).length;
        Object.keys(gridPads).forEach((midiNote, index) => {
            if (!buttonStates[midiNote]) {
                const pad = gridPads[midiNote];
                const channel = pad.getAttribute('data-channel') ? parseInt(pad.getAttribute('data-channel')) : 5;
                
                // Turn off buttons that don't have assigned states
                setTimeout(() => {
                    sendMIDIToController(parseInt(midiNote), false, 0, channel);
                    console.log(`🔴 Turned off unassigned button ${midiNote} on channel ${channel}`);
                }, (assignedButtonCount * 20) + (index * 10)); // Start after assigned buttons with longer delay
            }
        });
    }, 100); // Wait 100ms before starting to send restore commands
    
    console.log(`✅ Grid state "${gridState.name || 'Unknown'}" restored successfully`);
    console.log(`🎯 Restored ${Object.keys(buttonStates).length} button states to physical controller`);
    
    // Log details of what was restored
    if (Object.keys(buttonStates).length > 0) {
        console.log('📋 Restored button details:');
        Object.entries(buttonStates).forEach(([midiNote, state]) => {
            console.log(`  • Button ${midiNote}: ${state.assignedColor} - ${state.isOn ? 'ON' : 'OFF'} (${state.behavior})`);
        });
    }
}

async function resetAllPads() {
    console.log('🔄 Resetting all pads...');
    
    // Clear the message queue first to prevent conflicts
    console.log(`🗑️ Clearing ${midiMessageQueue.length} pending messages from queue`);
    midiMessageQueue.length = 0;
    
    // Wait a moment for any in-progress message to complete
    await sleep(50);
    
    // Turn off all grid pad LEDs on controller
    for (let midiNote = 0; midiNote < 64; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 5);
    }
    
    // Turn off bottom buttons (notes 100-107) with channel 0
    for (let midiNote = 100; midiNote <= 107; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 0);
    }
    
    // Turn off side buttons (notes 112-119) with channel 0
    for (let midiNote = 112; midiNote <= 119; midiNote++) {
        await sendMIDIToController(midiNote, false, 0, 0);
    }
    
    // Remove clicked states from all web app pads
    Object.values(gridPads).forEach(pad => {
        pad.classList.remove('clicked', 'sending');
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
    
    // Clear pending confirmations
    Object.keys(pendingConfirmations).forEach(midiNote => {
        delete pendingConfirmations[midiNote];
    });
    
    // Wait for all queued messages to be sent
    while (isProcessingQueue || midiMessageQueue.length > 0) {
        await sleep(10);
    }
    
    console.log('✅ All pads reset - LEDs turned off, button states cleared, and blinking stopped');
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
