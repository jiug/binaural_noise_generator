let audioContext;
let oscillatorLeft;
let oscillatorRight;
let gainNode;
let noiseNode;
let noiseGain;
let isPlaying = false;
let timerInterval;
let startTime;

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

// Update displays
['baseFrequency', 'beatFrequency', 'volume', 'noiseVolume'].forEach(id => {
    const element = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    
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

    oscillatorLeft?.stop();
    oscillatorRight?.stop();
    noiseNode?.stop();
    
    oscillatorLeft = null;
    oscillatorRight = null;
    noiseNode = null;
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
        noiseNode.connect(noiseGain);
        noiseGain.connect(audioContext.destination);
        noiseNode.start();
    }
} 