/**
 * TETRIS ARCADE
 * Juego de navegador moderno, accesible y completo.
 */

// ==========================================
// CONSTANTES Y CONFIGURACIÓN
// ==========================================
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // Tamaño del bloque en píxeles para 300x600

// Definición de tetrominós (matrices y colores neón)
const PIECES = {
  I: {
    color: '#00e5ff',
    shadow: 'rgba(0, 229, 255, 0.3)',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  J: {
    color: '#2979ff',
    shadow: 'rgba(41, 121, 255, 0.3)',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    color: '#ff9100',
    shadow: 'rgba(255, 145, 0, 0.3)',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  O: {
    color: '#ffd600',
    shadow: 'rgba(255, 214, 0, 0.3)',
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  S: {
    color: '#00e676',
    shadow: 'rgba(0, 230, 118, 0.3)',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  T: {
    color: '#d500f9',
    shadow: 'rgba(213, 0, 249, 0.3)',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  Z: {
    color: '#ff1744',
    shadow: 'rgba(255, 23, 68, 0.3)',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  }
};

const PIECE_NAMES = Object.keys(PIECES);

// Puntuación clásica por líneas
const LINE_POINTS = [0, 100, 300, 500, 800];

// ==========================================
// SISTEMA DE SONIDO SINTETIZADO (Web Audio API)
// ==========================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.15) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Ignorar restricciones si el audio fue bloqueado
    }
  }

  playMove() {
    this.playTone(260, 'square', 0.03, 0.04);
  }

  playRotate() {
    this.playTone(440, 'triangle', 0.05, 0.08);
  }

  playDrop() {
    this.playTone(160, 'sine', 0.07, 0.12);
  }

  playClear(lines) {
    if (this.muted || !this.ctx) return;
    const notes = lines === 4 ? [330, 440, 554, 659, 880] : [440, 554, 659];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.12, 0.1);
      }, idx * 60);
    });
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    const notes = [440, 392, 349, 293];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.18, 0.12);
      }, idx * 110);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// ==========================================
// ESTADO PRINCIPAL DEL JUEGO
// ==========================================
class TetrisGame {
  constructor() {
    // Canvases
    this.boardCanvas = document.getElementById('board-canvas');
    this.boardCtx = this.boardCanvas.getContext('2d');

    this.nextCanvas = document.getElementById('next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    this.holdCanvas = document.getElementById('hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');

    // Elementos DOM
    this.scoreDisplay = document.getElementById('score-display');
    this.highScoreDisplay = document.getElementById('high-score-display');
    this.levelDisplay = document.getElementById('level-display');
    this.linesDisplay = document.getElementById('lines-display');
    this.finalScore = document.getElementById('final-score');
    this.gameOverlay = document.getElementById('game-overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.startBtn = document.getElementById('start-btn');
    this.soundBtn = document.getElementById('sound-btn');
    this.pauseBtn = document.getElementById('pause-btn');

    // Sonidos
    this.sound = new SoundManager();

    // Récord
    this.highScore = parseInt(localStorage.getItem('tetris_arcade_highscore') || '0', 10);
    this.highScoreDisplay.textContent = this.highScore;

    // Inicializar estado
    this.reset();
    this.bindEvents();
  }

  reset() {
    // Matriz del tablero (20 filas x 10 columnas)
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.isGameOver = false;
    this.isPaused = false;
    this.canHold = true;
    this.holdPiece = null;

    // Bolsa aleatoria de 7 piezas
    this.bag = [];
    this.currentPiece = this.getNewPiece();
    this.nextPiece = this.getNewPiece();

    this.dropCounter = 0;
    this.lastTime = 0;

    this.updateStats();
    this.hideOverlay();
  }

  // Generador de piezas 7-Bag (garantiza variedad equitativa)
  getNewPiece() {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_NAMES];
      // Barajar Fisher-Yates
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }

    const type = this.bag.pop();
    const pieceData = PIECES[type];
    const matrix = pieceData.matrix.map(row => [...row]);

    return {
      type,
      matrix,
      color: pieceData.color,
      shadow: pieceData.shadow,
      x: Math.floor(COLS / 2) - Math.ceil(matrix[0].length / 2),
      y: 0
    };
  }

  // Velocidad de caída calculada en ms
  getDropInterval() {
    return Math.max(90, 800 - (this.level - 1) * 65);
  }

  // ==========================================
  // LÓGICA DE MOVIMIENTO Y COLISIONES
  // ==========================================
  collide(piece = this.currentPiece, offsetX = 0, offsetY = 0, testMatrix = null) {
    const matrix = testMatrix || piece.matrix;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const newX = piece.x + c + offsetX;
          const newY = piece.y + r + offsetY;

          // Fuera de límites horizontales o fondo
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }

          // Choque con piezas fijadas en el tablero
          if (newY >= 0 && this.grid[newY][newX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  moveLeft() {
    if (this.isGameOver || this.isPaused) return;
    if (!this.collide(this.currentPiece, -1, 0)) {
      this.currentPiece.x--;
      this.sound.playMove();
      this.draw();
    }
  }

  moveRight() {
    if (this.isGameOver || this.isPaused) return;
    if (!this.collide(this.currentPiece, 1, 0)) {
      this.currentPiece.x++;
      this.sound.playMove();
      this.draw();
    }
  }

  softDrop() {
    if (this.isGameOver || this.isPaused) return;
    if (!this.collide(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
      this.score += 1;
      this.updateStats();
      this.dropCounter = 0;
      this.draw();
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.isGameOver || this.isPaused) return;
    let droppedCells = 0;
    while (!this.collide(this.currentPiece, 0, 1)) {
      this.currentPiece.y++;
      droppedCells++;
    }
    this.score += droppedCells * 2;
    this.updateStats();
    this.sound.playDrop();
    this.lockPiece();
  }

  rotate() {
    if (this.isGameOver || this.isPaused) return;
    const m = this.currentPiece.matrix;
    const N = m.length;
    // Transponer e invertir fila para rotación 90° horario
    const rotated = m.map((row, i) =>
      row.map((val, j) => m[N - 1 - j][i])
    );

    // Wall Kicks básicos: intentar en la posición actual, luego +/- 1 y +/- 2
    const kicks = [0, 1, -1, 2, -2];
    for (const kick of kicks) {
      if (!this.collide(this.currentPiece, kick, 0, rotated)) {
        this.currentPiece.matrix = rotated;
        this.currentPiece.x += kick;
        this.sound.playRotate();
        this.draw();
        return;
      }
    }
  }

  hold() {
    if (this.isGameOver || this.isPaused || !this.canHold) return;

    this.sound.playMove();
    const currentType = this.currentPiece.type;

    if (!this.holdPiece) {
      this.holdPiece = currentType;
      this.currentPiece = this.nextPiece;
      this.nextPiece = this.getNewPiece();
    } else {
      const temp = this.holdPiece;
      this.holdPiece = currentType;
      const pieceData = PIECES[temp];
      this.currentPiece = {
        type: temp,
        matrix: pieceData.matrix.map(row => [...row]),
        color: pieceData.color,
        shadow: pieceData.shadow,
        x: Math.floor(COLS / 2) - Math.ceil(pieceData.matrix[0].length / 2),
        y: 0
      };
    }

    this.canHold = false;
    this.draw();
  }

  // Fijar pieza en el tablero
  lockPiece() {
    const { matrix, x, y, color } = this.currentPiece;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardY = y + r;
          const boardX = x + c;

          if (boardY < 0) {
            this.triggerGameOver();
            return;
          }
          this.grid[boardY][boardX] = color;
        }
      }
    }

    this.sound.playDrop();
    this.clearLines();

    // Spawn de la siguiente pieza
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getNewPiece();
    this.canHold = true;

    // Verificar si la nueva pieza colisiona nada más entrar
    if (this.collide(this.currentPiece, 0, 0)) {
      this.triggerGameOver();
      return;
    }

    this.dropCounter = 0;
    this.draw();
  }

  clearLines() {
    let linesCleared = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every(cell => cell !== 0)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0));
        linesCleared++;
        r++; // Reevaluar la misma fila tras el desplazamiento
      }
    }

    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.score += LINE_POINTS[linesCleared] * this.level;
      this.level = Math.floor(this.lines / 10) + 1;

      this.sound.playClear(linesCleared);
      this.updateStats();
    }
  }

  // Calcular la proyección de caída (Ghost Piece)
  getGhostPosition() {
    let ghostY = this.currentPiece.y;
    while (!this.collide(this.currentPiece, 0, (ghostY - this.currentPiece.y) + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  // ==========================================
  // CICLO Y RENDERIZADO
  // ==========================================
  update(time = 0) {
    if (this.isGameOver || this.isPaused) return;

    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    this.dropCounter += deltaTime;

    if (this.dropCounter > this.getDropInterval()) {
      if (!this.collide(this.currentPiece, 0, 1)) {
        this.currentPiece.y++;
      } else {
        this.lockPiece();
      }
      this.dropCounter = 0;
    }

    this.draw();
    requestAnimationFrame(this.update.bind(this));
  }

  draw() {
    this.drawBoard();
    this.drawPreview(this.nextCtx, this.nextCanvas, this.nextPiece.type);
    this.drawPreview(this.holdCtx, this.holdCanvas, this.holdPiece);
  }

  drawBlock(ctx, x, y, color, size = BLOCK_SIZE, isGhost = false) {
    const px = x * size;
    const py = y * size;

    if (isGhost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      return;
    }

    // Fondo del bloque
    ctx.fillStyle = color;
    ctx.fillRect(px, py, size, size);

    // Brillo superior e izquierdo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(px, py, size, 3);
    ctx.fillRect(px, py, 3, size);

    // Sombra inferior y derecha
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(px, py + size - 3, size, 3);
    ctx.fillRect(px + size - 3, py, 3, size);

    // Borde delimitador sutil
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, size, size);
  }

  drawBoard() {
    const ctx = this.boardCtx;
    ctx.clearRect(0, 0, this.boardCanvas.width, this.boardCanvas.height);

    // Cuadrícula de fondo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK_SIZE, 0);
      ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK_SIZE);
      ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      ctx.stroke();
    }

    // Dibujar piezas fijas en la cuadrícula
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] !== 0) {
          this.drawBlock(ctx, c, r, this.grid[r][c]);
        }
      }
    }

    if (!this.isGameOver) {
      // 1. Dibujar Ghost Piece (Sombra)
      const ghostY = this.getGhostPosition();
      const { matrix, color, x, y } = this.currentPiece;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawBlock(ctx, x + c, ghostY + r, color, BLOCK_SIZE, true);
          }
        }
      }

      // 2. Dibujar Pieza Actual
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawBlock(ctx, x + c, y + r, color);
          }
        }
      }
    }
  }

  drawPreview(ctx, canvas, pieceType) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pieceType) return;

    const piece = PIECES[pieceType];
    const matrix = piece.matrix;
    const miniSize = 20;

    // Centrar la figura dentro del canvas de preview
    const pieceWidth = matrix[0].length * miniSize;
    const pieceHeight = matrix.length * miniSize;
    const startX = Math.floor((canvas.width - pieceWidth) / 2);
    const startY = Math.floor((canvas.height - pieceHeight) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const px = startX + c * miniSize;
          const py = startY + r * miniSize;

          ctx.fillStyle = piece.color;
          ctx.fillRect(px, py, miniSize, miniSize);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(px, py, miniSize, 2);
          ctx.fillRect(px, py, 2, miniSize);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(px, py + miniSize - 2, miniSize, 2);
          ctx.fillRect(px + miniSize - 2, py, 2, miniSize);

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.strokeRect(px, py, miniSize, miniSize);
        }
      }
    }
  }

  updateStats() {
    this.scoreDisplay.textContent = this.score;
    this.levelDisplay.textContent = this.level;
    this.linesDisplay.textContent = this.lines;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreDisplay.textContent = this.highScore;
      localStorage.setItem('tetris_arcade_highscore', this.highScore.toString());
    }
  }

  // ==========================================
  // CONTROL DE ESTADOS (Pausa, Game Over)
  // ==========================================
  togglePause() {
    if (this.isGameOver) return;
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.pauseBtn.textContent = '▶';
      this.overlayTitle.textContent = 'PAUSA';
      this.finalScore.textContent = this.score;
      this.startBtn.textContent = 'CONTINUAR';
      this.showOverlay();
    } else {
      this.pauseBtn.textContent = '⏸';
      this.hideOverlay();
      this.lastTime = performance.now();
      requestAnimationFrame(this.update.bind(this));
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    this.sound.playGameOver();
    this.overlayTitle.textContent = 'GAME OVER';
    this.finalScore.textContent = this.score;
    this.startBtn.textContent = 'JUGAR DE NUEVO';
    this.showOverlay();
  }

  showOverlay() {
    this.gameOverlay.classList.remove('hidden');
  }

  hideOverlay() {
    this.gameOverlay.classList.add('hidden');
  }

  startOrResume() {
    this.sound.init();
    if (this.isGameOver) {
      this.reset();
      this.lastTime = performance.now();
      requestAnimationFrame(this.update.bind(this));
    } else if (this.isPaused) {
      this.togglePause();
    }
  }

  // ==========================================
  // EVENTOS (Teclado, Táctil, Botones)
  // ==========================================
  bindEvents() {
    // Teclado
    window.addEventListener('keydown', (e) => {
      this.sound.init();

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this.moveLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this.moveRight();
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this.softDrop();
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          this.rotate();
          break;
        case 'Space':
          e.preventDefault();
          this.hardDrop();
          break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          e.preventDefault();
          this.hold();
          break;
        case 'KeyP':
        case 'Escape':
          e.preventDefault();
          this.togglePause();
          break;
      }
    });

    // Botones Header
    this.soundBtn.addEventListener('click', () => {
      this.sound.init();
      const isMuted = this.sound.toggleMute();
      this.soundBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    this.pauseBtn.addEventListener('click', () => {
      this.togglePause();
    });

    // Botón Overlay
    this.startBtn.addEventListener('click', () => {
      this.startOrResume();
    });

    // Controles táctiles / en pantalla
    const bindTouch = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = (e) => {
        e.preventDefault();
        this.sound.init();
        action();
      };
      el.addEventListener('touchstart', handler, { passive: false });
      el.addEventListener('mousedown', handler);
    };

    bindTouch('touch-left', () => this.moveLeft());
    bindTouch('touch-right', () => this.moveRight());
    bindTouch('touch-down', () => this.softDrop());
    bindTouch('touch-rotate', () => this.rotate());
    bindTouch('touch-hard-drop', () => this.hardDrop());
    bindTouch('touch-hold', () => this.hold());
  }

  start() {
    this.lastTime = performance.now();
    requestAnimationFrame(this.update.bind(this));
  }
}

// Iniciar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
  const game = new TetrisGame();
  game.start();
});
