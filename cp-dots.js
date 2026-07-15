let recognizer;
let mic;
let isListening = false;

async function initVosk() {
  const model = await Vosk.createModel('model');
  recognizer = new model.Recognizer({ sampleRate: 16000 });
  console.log("Vosk model loaded.");

  const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = audioContext.createMediaStreamSource(stream);

  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!isListening) return;
    const input = e.inputBuffer.getChannelData(0);
    const buffer = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) buffer[i] = input[i] * 32767;
    recognizer.acceptWaveform(buffer);

    const res = recognizer.result();
    if (res && res.text && res.text.trim()) {
      document.getElementById('text').value = res.text.trim();
    }
  };

  mic = { audioContext, processor, stream };
}

document.getElementById('voice-input').addEventListener('click', async () => {
  if (!recognizer) {
    await initVosk();
  }

  isListening = !isListening;
  const button = document.getElementById('voice-input');
  
  if (isListening) {
    button.textContent = "🎙️ Stop Listening";
    console.log("Vosk listening started");
  } else {
    button.textContent = "Voice Input";
    console.log("Vosk listening stopped");
    const finalResult = recognizer.finalResult();
    if (finalResult && finalResult.text) {
      document.getElementById('text').value = finalResult.text;
    }
  }
});


document.getElementById('image-input').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const textArea = document.getElementById('text');
  textArea.value = "⏳ Extracting text from image...";

  try {
    const result = await Tesseract.recognize(file, 'eng');
    textArea.value = result.data.text.trim() || "No readable text detected.";
  } catch (err) {
    console.error(err);
    textArea.value = "Error extracting text from image.";
  }
});

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

const morse = {
  'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..',
  'e': '.', 'f': '..-.', 'g': '--.', 'h': '....',
  'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
  'm': '--', 'n': '-.', 'o': '---', 'p': '.--.',
  'q': '--.-', 'r': '.-.', 's': '...', 't': '-',
  'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
  'y': '-.--', 'z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
  ' ': '/'
};

const morseToText = Object.fromEntries(Object.entries(morse).map(([k, v]) => [v, k]));

function decodeMorse(morseString) {
  if (!morseString || !morseString.trim()) return ""; 

  const clean = morseString.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const tokens = clean.split(' ');
  let decoded = '';

  for (let token of tokens) {
    if (!token) continue;
    if (token === '/' || token === '|') {
      decoded += ' ';
    } else if (morseToText[token]) {
      decoded += morseToText[token];
    } else {
      decoded += '';
    }
  }
  return decoded;
}

function shiftText(text, shift) {
  return text.split('').map(ch => {
    const lower = ch.toLowerCase();
    if (!letters.includes(lower)) return ch;
    const index = (letters.indexOf(lower) + shift + 26) % 26;
    return (ch === ch.toUpperCase()) ? letters[index].toUpperCase() : letters[index];
  }).join('');
}

document.getElementById('encrypt').addEventListener('click', () => {
  const text = document.getElementById('text').value;
  const shift = Number(document.getElementById('key').value) || 0;
  const result = shiftText(text, shift);
  document.getElementById('output').value = result;
});

document.getElementById('decrypt').addEventListener('click', () => {
  const text = document.getElementById('text').value;
  const shift = Number(document.getElementById('key').value) || 0;
  const result = shiftText(text, -shift);
  document.getElementById('output').value = result;
});

document.getElementById('morse-encrypt').addEventListener('click', () => {
  const raw = document.getElementById('text').value || '';
  const shift = Number(document.getElementById('key').value) || 0;

  const shifted = shiftText(raw, shift);

  let resultParts = [];
  for (let ch of shifted.toLowerCase()) {
    resultParts.push(morse[ch] !== undefined ? morse[ch] : ch);
  }

  const result = resultParts.join(' ').replace(/\s{2,}/g, ' ').trim();
  document.getElementById('output').value = result;
});

document.getElementById('morse-decrypt').addEventListener('click', () => {
  const rawInput = document.getElementById('text').value || '';
  const shift = Number(document.getElementById('key').value) || 0;
  const outEl = document.getElementById('output');

  const trimmed = rawInput.trim();

  if (!trimmed) {
    outEl.value = "⚠️ Input is empty.";
    return;
  }

  const onlyMorseRegex = /^[.\-\/\|\s]+$/;
  const hasLetterRegex = /[A-Za-z]/;
  const hasMorseSymbolRegex = /[.\-]/;

  let result = "";

  if (onlyMorseRegex.test(trimmed)) {
    const decoded = decodeMorse(trimmed);
    if (decoded) {
      result = shiftText(decoded, -shift);
      outEl.value = result;
      return;
    } else {
      outEl.value = "⚠️ Could not decode Morse input.";
      return;
    }
  }

  if (hasLetterRegex.test(trimmed)) {
    if (hasMorseSymbolRegex.test(trimmed)) {
      const maybeDecoded = decodeMorse(trimmed);
      if (maybeDecoded && /[A-Za-z]/.test(maybeDecoded)) {
        result = shiftText(maybeDecoded, -shift);
        outEl.value = result;
        return;
      }
      const plainShifted = shiftText(trimmed, -shift);
      outEl.value = plainShifted;
      return;
    } else {
      result = shiftText(trimmed, -shift);
      outEl.value = result;
      return;
    }
  }

  if (hasMorseSymbolRegex.test(trimmed)) {
    const decoded = decodeMorse(trimmed);
    if (decoded) {
      result = shiftText(decoded, -shift);
      outEl.value = result;
      return;
    } else {
      outEl.value = "⚠️ Could not decode Morse input.";
      return;
    }
  }

  outEl.value = "⚠️ Unrecognized input format.";
});
