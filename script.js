let audioContext;
let oscillatorLeft;
let oscillatorRight;
let gainNode;
let noiseNode;
let noiseGain;
let noisePanner;
let panLFO;
let isPlaying = false;
let timerInterval;
let startTime;
let lastPanUpdateTime = 0;
const PAN_LFO_FREQ = 1/60; // 1/60 Hz = one cycle per minute

// Wait for DOM to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize audio context on user interaction
    document.getElementById('startButton').addEventListener('click', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        startTone();
        startTimer();
    });

    document.getElementById('stopButton').addEventListener('click', () => {
        stopTone();
        stopTimer();
    });

    // Add pan toggle listener
    document.getElementById('noisePanToggle').addEventListener('change', (e) => {
        if (isPlaying && noiseNode) {
            if (e.target.checked) {
                startPanLFO();
            } else {
                stopPanLFO();
            }
        }
    });

    // Update displays
    ['baseFrequency', 'beatFrequency', 'volume', 'noiseVolume'].forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element with id '${id}' not found`);
            return;
        }

        let valueId;
        switch(id) {
            case 'baseFrequency':
                valueId = 'baseFreqValue';
                break;
            case 'beatFrequency':
                valueId = 'beatFreqValue';
                break;
            case 'volume':
                valueId = 'volumeValue';
                break;
            case 'noiseVolume':
                valueId = 'noiseVolumeValue';
                break;
        }

        const valueDisplay = document.getElementById(valueId);
        if (!valueDisplay) {
            console.error(`Value display element with id '${valueId}' not found`);
            return;
        }
        
        // Update initial values
        valueDisplay.textContent = id.includes('Volume') ? element.value + '%' : element.value + (id.includes('Freq') ? ' Hz' : '');
        
        // Add both input and change event listeners for real-time updates
        ['input', 'change'].forEach(eventType => {
            element.addEventListener(eventType, () => {
                valueDisplay.textContent = id.includes('Volume') ? element.value + '%' : element.value + (id.includes('Freq') ? ' Hz' : '');
                updateAudio();
            });
        });
    });

    // Noise type selection
    document.getElementById('noiseType').addEventListener('change', updateAudio);
});

// Timer functions
function startTimer() {
    startTime = Date.now();
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('timer').textContent = '00:00:00';
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('timer').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTone() {
    if (isPlaying) return;
    isPlaying = true;

    // Create gain node
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    
    // Create oscillators
    oscillatorLeft = audioContext.createOscillator();
    oscillatorRight = audioContext.createOscillator();
    
    // Create stereo panner nodes
    const pannerLeft = audioContext.createStereoPanner();
    const pannerRight = audioContext.createStereoPanner();
    
    pannerLeft.pan.value = -1;  // Left channel
    pannerRight.pan.value = 1;   // Right channel
    
    // Connect nodes
    oscillatorLeft.connect(pannerLeft);
    oscillatorRight.connect(pannerRight);
    pannerLeft.connect(gainNode);
    pannerRight.connect(gainNode);
    
    updateAudio();
    
    // Start oscillators
    oscillatorLeft.start();
    oscillatorRight.start();
}

function stopTone() {
    if (!isPlaying) return;
    isPlaying = false;

    stopPanLFO();
    oscillatorLeft?.stop();
    oscillatorRight?.stop();
    noiseNode?.stop();
    
    oscillatorLeft = null;
    oscillatorRight = null;
    noiseNode = null;
    noisePanner = null;
}

function updateAudio() {
    if (!isPlaying) return;

    const baseFreq = parseFloat(document.getElementById('baseFrequency').value);
    const beatFreq = parseFloat(document.getElementById('beatFrequency').value);
    const volume = parseFloat(document.getElementById('volume').value) / 100;

    // Update oscillator frequencies
    oscillatorLeft.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
    oscillatorRight.frequency.setValueAtTime(baseFreq + beatFreq, audioContext.currentTime);
    
    // Update main volume
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

    // Update noise
    updateNoise();
}

function updateNoise() {
    const noiseType = document.getElementById('noiseType').value;
    const noiseVolume = parseFloat(document.getElementById('noiseVolume').value) / 100;

    // Stop existing noise
    if (noiseNode) {
        noiseNode.stop();
        noiseNode = null;
    }

    if (noiseType !== 'none' && isPlaying) {
        // Create noise nodes
        noiseNode = audioContext.createBufferSource();
        noiseGain = audioContext.createGain();
        noisePanner = audioContext.createStereoPanner();
        
        noiseGain.gain.value = noiseVolume;

        // Create and fill audio buffer
        const bufferSize = audioContext.sampleRate * 2; // 2 seconds of audio
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = noiseBuffer.getChannelData(0);

        // Generate noise
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            
            if (noiseType === 'pink') {
                // Pink noise algorithm
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5;
            } else if (noiseType === 'brown') {
                // Brown noise algorithm
                lastOut = (lastOut + (0.02 * white)) / 1.02;
                data[i] = lastOut * 3.5;
            } else {
                // White noise
                data[i] = white;
            }
        }

        noiseNode.buffer = noiseBuffer;
        noiseNode.loop = true;
        
        // Connect through panner
        noiseNode.connect(noisePanner);
        noisePanner.connect(noiseGain);
        noiseGain.connect(audioContext.destination);
        
        noiseNode.start();

        // Start panning if enabled
        if (document.getElementById('noisePanToggle').checked) {
            startPanLFO();
        }
    }
}

function startPanLFO() {
    if (panLFO) {
        cancelAnimationFrame(panLFO);
    }
    
    lastPanUpdateTime = audioContext.currentTime;
    updatePan();
}

function stopPanLFO() {
    if (panLFO) {
        cancelAnimationFrame(panLFO);
        panLFO = null;
    }
    if (noisePanner) {
        // Smoothly transition to center over 0.5 seconds
        noisePanner.pan.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    }
}

function updatePan() {
    if (!noisePanner || !isPlaying) return;

    const currentTime = audioContext.currentTime;
    const elapsed = currentTime - lastPanUpdateTime;
    
    // Calculate pan position using triangular LFO
    // One complete cycle takes 60 seconds (1/60 Hz)
    const cyclePosition = (elapsed * PAN_LFO_FREQ) % 1;
    let panValue;
    
    if (cyclePosition < 0.25) {
        // First quarter: -1 to 0
        panValue = -1 + (cyclePosition * 4);
    } else if (cyclePosition < 0.75) {
        // Middle half: 0 to 1 and back to 0
        panValue = 1 - ((cyclePosition - 0.25) * 4);
    } else {
        // Last quarter: 0 to -1
        panValue = ((cyclePosition - 0.75) * 4) - 1;
    }
    
    noisePanner.pan.setValueAtTime(panValue, currentTime);
    
    panLFO = requestAnimationFrame(updatePan);
} 