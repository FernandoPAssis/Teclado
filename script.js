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
    var numOctaves = 2;
    var currentInstIndex = 0;
    var activeAudioNodes = {};

    // Samplers do Tone.js para os 3 perfis de Piano de Cauda
    var pianoNormal = null;
    var pianoVibrante = null;
    var pianoUltraBrilho = null;
    var isToneStarted = false;

    // Cache de AudioBuffers para o Piano Acústico Nativo (Opção 2)
    var audioCtx = null;
    var audioBufferCache = {};

    var container = document.getElementById('piano-container');
    var toggleLabels = document.getElementById('toggle-labels');
    var instSelect = document.getElementById('inst-select');

    function initAudioContext() {
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

    // MAPA PADRÃO DE SAMPLES DO SALAMANDER GRAND PIANO
    var sampleUrls = {
        "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
        "A1": "A1.mp3", "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
        "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
        "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
        "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
        "A5": "A5.mp3", "C6": "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
        "A6": "A6.mp3", "C7": "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", "A7": "A7.mp3"
    };

    function initTonePianos() {
        if (pianoNormal) return;

        var sampleBaseUrl = "samples/";
        if (window.location.protocol === 'file:') {
            sampleBaseUrl = "https://tonejs.github.io/audio/salamander/";
        }

        // 1. PIANO NORMAL (Som Puro do Sample, Aveludado)
        pianoNormal = new Tone.Sampler({
            urls: sampleUrls,
            baseUrl: sampleBaseUrl
        }).toDestination();

        // 2. PIANO VIBRANTE (Com EQ equilibrado e Compressor)
        var eqVibrante = new Tone.EQ3({ low: 2, mid: 4, high: 6 });
        var compVibrante = new Tone.Compressor({ threshold: -24, ratio: 3 });

        pianoVibrante = new Tone.Sampler({
            urls: sampleUrls,
            baseUrl: sampleBaseUrl
        });
        pianoVibrante.chain(eqVibrante, compVibrante, Tone.Destination);

        // 3. PIANO ULTRA BRILHO & PUNCH (Agudos ao máximo, Exciter e Compressor pesado)
        var eqUltra = new Tone.EQ3({ low: -4, mid: 9, high: 16 });
        var compUltra = new Tone.Compressor({ threshold: -32, ratio: 8 });
        var distUltra = new Tone.Distortion({ distortion: 0.12, wet: 0.3 });

        pianoUltraBrilho = new Tone.Sampler({
            urls: sampleUrls,
            baseUrl: sampleBaseUrl
        });
        pianoUltraBrilho.chain(eqUltra, compUltra, distUltra, Tone.Destination);
    }

    // AUDIOBUFFER PLAYER NATIVO VIA FETCH/DECODE
    async function loadAudioBuffer(url) {
        if (audioBufferCache[url]) return audioBufferCache[url];
        try {
            var response = await fetch(url);
            var arrayBuffer = await response.arrayBuffer();
            var decodedData = await audioCtx.decodeAudioData(arrayBuffer);
            audioBufferCache[url] = decodedData;
            return decodedData;
        } catch (e) {
            console.error("Erro ao carregar AudioBuffer:", e);
            return null;
        }
    }

    function midiToNoteName(midiNumber) {
        var octave = Math.floor(midiNumber / 12) - 1;
        var noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        var name = noteNames[midiNumber % 12];
        return name + octave;
    }

    function noteToFreq(noteIndex) {
        return 440 * Math.pow(2, (noteIndex - 69) / 12);
    }

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

    // DISPARO DE NOTAS DA APLICAÇÃO
    async function playNote(midiNumber) {
        initAudioContext();
        if (activeAudioNodes[midiNumber]) return;

        var inst = parseInt(currentInstIndex, 10);
        var noteName = midiToNoteName(midiNumber);

        // --- 01, 02, 03: PIANOS DE CAUDA REAL (TONE.JS SAMPLERS) ---
        if (inst === 0 || inst === 1 || inst === 2) {
            if (!isToneStarted) {
                await Tone.start();
                initTonePianos();
                isToneStarted = true;
            }

            var targetSampler = pianoNormal;
            if (inst === 1) targetSampler = pianoVibrante;
            if (inst === 2) targetSampler = pianoUltraBrilho;

            if (targetSampler) {
                targetSampler.triggerAttack(noteName);
                activeAudioNodes[midiNumber] = { mode: 'tone', sampler: targetSampler, note: noteName };
            }
            return;
        }

        // --- 04: PIANO ACÚSTICO (AudioBuffer Nativo) ---
        if (inst === 3) {
            var sampleNote = noteName.replace("#", "s");
            var url = (window.location.protocol === 'file:' ? "https://tonejs.github.io/audio/salamander/" : "samples/") + sampleNote + ".mp3";
            var buffer = await loadAudioBuffer(url);

            if (buffer && audioCtx) {
                var source = audioCtx.createBufferSource();
                source.buffer = buffer;
                var gainNode = audioCtx.createGain();
                gainNode.gain.setValueAtTime(0.85, audioCtx.currentTime);

                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                source.start(0);

                activeAudioNodes[midiNumber] = { mode: 'buffer', source: source, gain: gainNode };
                return;
            }
        }

        // --- OUTROS TIMBRES SINTÉTICOS / BATERIA ---
        if (!audioCtx) return;
        var now = audioCtx.currentTime;
        var freq = noteToFreq(midiNumber);

        // Modo Bateria (22 e 23 no select)
        if (inst === 21 || inst === 22) {
            playDrumSound(midiNumber, inst, now);
            return;
        }

        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();

        switch (inst) {
            case 4: // 05. Piano Sintético Clássico
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
                break;

            case 5: // 06. Piano Digital Limpo
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.7, now + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
                break;

            case 6: // 07. Piano Elétrico (Rhodes)
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                break;

            case 7: // 08. Cravo Clássico
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                break;

            case 8: // 09. Caixinha de Música
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
                break;

            case 9: // 10. Órgão Hammond
                osc.type = 'square';
                gain.gain.setValueAtTime(0.3, now);
                break;

            case 10: // 11. Violão de Nylon
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                break;

            case 11: // 12. Violão de Aço
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
                break;

            case 12: // 13. Guitarra Limpa
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.3);
                break;

            case 13: // 14. Guitarra com Distorção
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.02, now + 1.5);
                break;

            case 14: // 15. Baixo Elétrico
                osc.type = 'triangle';
                freq = freq / 2;
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
                break;

            case 15: // 16. Orquestra de Cordas
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.35, now + 0.15);
                break;

            case 16: // 17. Harpa Angelical
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
                break;

            case 17: // 18. Flauta Doce
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
                break;

            case 18: // 19. Saxofone Alto
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.4, now + 0.06);
                break;

            case 19: // 20. Trompete de Metal
                osc.type = 'sawtooth';
                gain.gain.setValueAtTime(0.45, now);
                break;

            case 20: // 21. Gaita de Boca
                osc.type = 'square';
                gain.gain.setValueAtTime(0.25, now);
                break;

            case 23: // 24. Xilofone / Marimba
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                break;

            case 24: // 25. Steel Drum
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.6, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                break;

            case 25: // 26. 8-Bit Game Boy
                osc.type = 'square';
                gain.gain.setValueAtTime(0.3, now);
                break;

            default:
                osc.type = 'triangle';
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                break;
        }

        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();

        activeAudioNodes[midiNumber] = { mode: 'synth', osc: osc, gain: gain };
    }

    function playDrumSound(midiNumber, instType, now) {
        var noteInOctave = midiNumber % 12;
        if (noteInOctave === 0) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(instType === 22 ? 120 : 150, now);
            osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.25);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(now + 0.25);
        } else if (noteInOctave === 2 || noteInOctave === 3) {
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
        } else {
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

    // INTERRUPÇÃO E SUAVIZAÇÃO AO SOLTAR A TECLA
    function stopNote(midiNumber) {
        if (activeAudioNodes[midiNumber]) {
            var item = activeAudioNodes[midiNumber];

            if (item.mode === 'tone') {
                if (item.sampler) {
                    item.sampler.triggerRelease(item.note);
                }
            } else if (item.mode === 'buffer') {
                if (audioCtx && item.gain) {
                    item.gain.gain.setValueAtTime(item.gain.gain.value, audioCtx.currentTime);
                    item.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
                    setTimeout(function () {
                        try { item.source.stop(); } catch (e) { }
                    }, 130);
                }
            } else if (item.mode === 'synth') {
                if (audioCtx && item.gain) {
                    var now = audioCtx.currentTime;
                    item.gain.gain.setValueAtTime(item.gain.gain.value, now);
                    item.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
                    setTimeout(function () {
                        try { item.osc.stop(); } catch (e) { }
                    }, 100);
                }
            }

            delete activeAudioNodes[midiNumber];
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

    document.getElementById('btn-octave-down').addEventListener('click', function () {
        if (baseOctave > 1) { baseOctave--; renderPiano(); }
    });

    document.getElementById('btn-octave-up').addEventListener('click', function () {
        if (baseOctave < 6) { baseOctave++; renderPiano(); }
    });

    var octBtns = document.querySelectorAll('.btn-oct-count');
    for (var b = 0; b < octBtns.length; b++) {
        octBtns[b].addEventListener('click', function () {
            for (var x = 0; x < octBtns.length; x++) octBtns[x].classList.remove('active');
            this.classList.add('active');
            numOctaves = parseInt(this.dataset.count, 10);
            renderPiano();
        });
    }

    instSelect.addEventListener('change', function () {
        currentInstIndex = parseInt(this.value, 10);
    });

    document.getElementById('prev-inst').addEventListener('click', function () {
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
        if (this.checked) { container.classList.add('show-labels'); }
        else { container.classList.remove('show-labels'); }
    });

    initTonePianos();
    renderPiano();
})();

        // --- BOTÃO DE TELA CHEIA (OCULTAR BARRA DO NAVEGADOR) ---
    var btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', function () {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(function (err) {
                    console.log("Erro ao tentar entrar em tela cheia:", err);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });
    }