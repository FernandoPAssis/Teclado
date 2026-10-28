(function () {
    var NOTES_DATA = [
        { name: 'C', pt: 'DÓ', isBlack: false },
        { name: 'C#', pt: 'DÓ#', isBlack: true },
        { name: 'D', pt: 'RÉ', isBlack: false },
        { name: 'D#', pt: 'RÉ#', isBlack: true },
        { name: 'E', pt: 'MI', isBlack: false },
        { name: 'F', pt: 'FÁ', isBlack: false },
        { name: 'F#', pt: 'FÁ#', isBlack: true },
        { name: 'G', pt: 'SOL', isBlack: false },
        { name: 'G#', pt: 'SOL#', isBlack: true },
        { name: 'A', pt: 'LÁ', isBlack: false },
        { name: 'A#', pt: 'LÁ#', isBlack: true },
        { name: 'B', pt: 'SI', isBlack: false }
    ];

    var baseOctave = 4;
    var numOctaves = 2; // Padrão: 2 Oitavas
    var currentInstIndex = 0; // Padrão: Piano Acústico
    var audioCtx = null;
    var activeOscillators = {};

    var container = document.getElementById('piano-container');
    var toggleLabels = document.getElementById('toggle-labels');
    var instSelect = document.getElementById('inst-select');

    function initAudio() {
        if (!audioCtx) {
            var AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function noteToFreq(noteIndex) {
        return 440 * Math.pow(2, (noteIndex - 69) / 12);
    }

    // Gerador de Ruído Branco para a Bateria (Caixa e Pratos)
    function createNoiseBuffer() {
        if (!audioCtx) return null;
        var bufferSize = audioCtx.sampleRate * 0.5;
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var output = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // SÍNTESE DOS TIMBRES E BATERIAS
    function playNote(midiNumber) {
        initAudio();
        if (!audioCtx) return;
        if (activeOscillators[midiNumber]) return;

        var freq = noteToFreq(midiNumber);
        var now = audioCtx.currentTime;
        var inst = parseInt(currentInstIndex, 10);

        // --- MODO BATERIA ACÚSTICA (16) E ELETRÔNICA 808 (17) ---
        if (inst === 16 || inst === 17) {
            playDrumSound(midiNumber, inst, now);
            return;
        }

        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();

        switch (inst) {
            case 0: // Piano Acústico
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
                break;

            case 1: // Piano Elétrico (Rhodes)
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                break;

            case 2: // Cravo Clássico
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                break;

            case 3: // Órgão Hammond
                osc.type = 'square';
                gain.gain.setValueAtTime(0.3, now);
                break;

            case 4: // Caixinha de Música
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
                break;

            case 5: // Violão de Nylon
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                break;

            case 6: // Violão de Aço
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
                break;

            case 7: // Guitarra Limpa
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.3);
                break;

            case 8: // Guitarra com Distorção (Overdrive)
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.35, now);
                // Onda distorcida com atenuação lenta
                gain.gain.exponentialRampToValueAtTime(0.02, now + 1.5);
                break;

            case 9: // Baixo Elétrico
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq / 2, now); // Oitava abaixo
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
                break;

            case 10: // Orquestra de Cordas (Violino)
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.35, now + 0.15);
                break;

            case 11: // Harpa Angelical
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
                break;

            case 12: // Flauta Doce
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
                break;

            case 13: // Saxofone Alto
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.06);
                break;

            case 14: // Trompete de Metal
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.45, now);
                break;

            case 15: // Gaita de Boca
                osc.type = 'square';
                gain.gain.setValueAtTime(0.25, now);
                break;

            case 18: // Xilofone / Marimba
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                break;

            case 19: // Steel Drum
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                break;

            case 20: // 8-Bit Game Boy
                osc.type = 'square';
                gain.gain.setValueAtTime(0.3, now);
                break;

            case 21: // Synth Pad (Névoa)
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.25);
                break;

            default:
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                break;
        }

        if (inst !== 9) {
            osc.frequency.setValueAtTime(freq, now);
        }

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();

        activeOscillators[midiNumber] = { osc: osc, gain: gain };
    }

    // SIMULADOR DE BATERIA
    function playDrumSound(midiNumber, instType, now) {
        var noteInOctave = midiNumber % 12;

        if (noteInOctave === 0) {
            // BUMBO (Kick)
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(instType === 17 ? 120 : 150, now);
            osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.25);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + 0.25);
        } else if (noteInOctave === 2 || noteInOctave === 3) {
            // CAIXA (Snare)
            var noise = audioCtx.createBufferSource();
            noise.buffer = createNoiseBuffer();
            var noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 800;

            var noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(audioCtx.destination);

            noise.start();
            noise.stop(now + 0.2);
        } else if (noteInOctave === 4 || noteInOctave === 5) {
            // PRATO (Hi-Hat)
            var noise = audioCtx.createBufferSource();
            noise.buffer = createNoiseBuffer();
            var filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000;

            var gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);

            noise.start();
            noise.stop(now + 0.08);
        } else {
            // TOMS & PERCUSSÃO (Tons variados)
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            var tomFreq = 100 + (noteInOctave * 25);
            osc.frequency.setValueAtTime(tomFreq, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + 0.2);
        }
    }

    function stopNote(midiNumber) {
        if (activeOscillators[midiNumber]) {
            var item = activeOscillators[midiNumber];
            var now = audioCtx ? audioCtx.currentTime : 0;
            if (audioCtx) {
                item.gain.gain.setValueAtTime(item.gain.gain.value, now);
                item.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                setTimeout(function () {
                    try { item.osc.stop(); } catch (e) { }
                }, 100);
            }
            delete activeOscillators[midiNumber];
        }
    }

    function renderPiano() {
        container.innerHTML = '';

        var totalWhiteKeys = numOctaves * 7;
        var whiteWidthPercent = 100 / totalWhiteKeys;
        var blackWidthPercent = whiteWidthPercent * 0.65;

        container.style.setProperty('--black-width', blackWidthPercent + '%');

        var startMidi = (baseOctave * 12) + 12;

        for (var oct = 0; oct < numOctaves; oct++) {
            for (var i = 0; i < 12; i++) {
                var noteInfo = NOTES_DATA[i];
                var currentMidi = startMidi + (oct * 12) + i;

                var keyEl = document.createElement('div');
                keyEl.className = 'key ' + (noteInfo.isBlack ? 'black' : 'white');
                keyEl.dataset.midi = currentMidi;

                if (!noteInfo.isBlack) {
                    keyEl.style.width = whiteWidthPercent + '%';
                } else {
                    keyEl.style.width = blackWidthPercent + '%';
                }

                var labelEl = document.createElement('span');
                labelEl.className = 'note-label';
                labelEl.textContent = noteInfo.pt;
                keyEl.appendChild(labelEl);

                bindKeyEvents(keyEl, currentMidi);
                container.appendChild(keyEl);
            }
        }
    }

    function bindKeyEvents(el, midi) {
        function triggerPress(e) {
            e.preventDefault();
            playNote(midi);
            el.classList.add('active');
        }

        function triggerRelease(e) {
            e.preventDefault();
            stopNote(midi);
            el.classList.remove('active');
        }

        el.addEventListener('touchstart', triggerPress, false);
        el.addEventListener('touchend', triggerRelease, false);
        el.addEventListener('touchcancel', triggerRelease, false);

        el.addEventListener('mousedown', triggerPress, false);
        el.addEventListener('mouseup', triggerRelease, false);
        el.addEventListener('mouseleave', triggerRelease, false);
    }

    // CONTROLES DE OITAVA BASE
    document.getElementById('btn-octave-down').addEventListener('click', function () {
        if (baseOctave > 1) {
            baseOctave--;
            renderPiano();
        }
    });

    document.getElementById('btn-octave-up').addEventListener('click', function () {
        if (baseOctave < 6) {
            baseOctave++;
            renderPiano();
        }
    });

    // BOTÕES DE OITAVA (1 A 4)
    var octBtns = document.querySelectorAll('.btn-oct-count');
    for (var b = 0; b < octBtns.length; b++) {
        octBtns[b].addEventListener('click', function () {
            for (var x = 0; x < octBtns.length; x++) octBtns[x].classList.remove('active');
            this.classList.add('active');
            numOctaves = parseInt(this.dataset.count, 10);
            renderPiano();
        });
    }

    // TROCA DE INSTRUMENTOS (DROPDOWN E SETAS)
    instSelect.addEventListener('change', function () {
        currentInstIndex = parseInt(this.value, 10);
    });

    document.getElementById('prev-inst').addEventListener('click', function () {
        var options = instSelect.options;
        var selectedIndex = instSelect.selectedIndex;
        if (selectedIndex > 0) {
            instSelect.selectedIndex = selectedIndex - 1;
            currentInstIndex = parseInt(instSelect.value, 10);
        }
    });

    document.getElementById('next-inst').addEventListener('click', function () {
        var options = instSelect.options;
        var selectedIndex = instSelect.selectedIndex;
        if (selectedIndex < options.length - 1) {
            instSelect.selectedIndex = selectedIndex + 1;
            currentInstIndex = parseInt(instSelect.value, 10);
        }
    });

    toggleLabels.addEventListener('change', function () {
        if (this.checked) {
            container.classList.add('show-labels');
        } else {
            container.classList.remove('show-labels');
        }
    });

    renderPiano();
})();