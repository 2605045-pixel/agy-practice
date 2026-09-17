/**
 * SUPER RETRO PLATFORMER (MARIO STYLE)
 * Implementación completa de juego de plataformas 8-bit en Canvas HTML5.
 */

// ============================================================
// CONSTANTES Y CONFIGURACIÓN DEL JUEGO
// ============================================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const TILE_SIZE = 32;

// Tipos de baldosas (tiles)
const TILE = {
  EMPTY: 0,
  GROUND: 1,
  BRICK: 2,
  Q_COIN: 3,
  Q_MUSHROOM: 4,
  USED: 5,
  PIPE_TL: 6,
  PIPE_TR: 7,
  PIPE_BODY_L: 8,
  PIPE_BODY_R: 9,
  CASTLE_BRICK: 10
};

// ============================================================
// SISTEMA DE SONIDO Y MÚSICA SINTETIZADA (Web Audio API)
// ============================================================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmInterval = null;
    this.bgmStep = 0;
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

  playTone(freq, type = 'square', duration = 0.1, gainVal = 0.1, slideTo = null) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playJump() {
    this.playTone(150, 'square', 0.18, 0.12, 450);
  }

  playStomp() {
    this.playTone(80, 'square', 0.12, 0.15, 20);
  }

  playCoin() {
    if (this.muted || !this.ctx) return;
    this.playTone(987, 'sine', 0.08, 0.12);
    setTimeout(() => this.playTone(1318, 'sine', 0.22, 0.12), 70);
  }

  playBump() {
    this.playTone(100, 'triangle', 0.1, 0.15, 50);
  }

  playPowerup() {
    if (this.muted || !this.ctx) return;
    const notes = [330, 392, 659, 523, 587, 784];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 'triangle', 0.08, 0.1), i * 60);
    });
  }

  playDeath() {
    this.stopBGM();
    if (this.muted || !this.ctx) return;
    const notes = [500, 480, 450, 400, 350, 300, 200];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 'sawtooth', 0.15, 0.12), i * 110);
    });
  }

  playVictory() {
    this.stopBGM();
    if (this.muted || !this.ctx) return;
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 'triangle', 0.25, 0.12), i * 130);
    });
  }

  startBGM() {
    if (this.bgmPlaying || this.muted) return;
    this.init();
    this.bgmPlaying = true;
    this.bgmStep = 0;

    // Melodía retro simplificada inspirada en Mario 8-bit
    const melody = [
      659, 659, 0, 659, 0, 523, 659, 0, 784, 0, 0, 0, 392, 0, 0, 0,
      523, 0, 0, 392, 0, 0, 330, 0, 0, 440, 0, 494, 0, 466, 440, 0
    ];

    this.bgmInterval = setInterval(() => {
      if (!this.bgmPlaying || this.muted) return;
      const freq = melody[this.bgmStep % melody.length];
      if (freq > 0) {
        this.playTone(freq, 'triangle', 0.1, 0.04);
      }
      this.bgmStep++;
    }, 150);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.muted;
  }
}

// ============================================================
// PARTÍCULAS Y EFECTOS
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  spawnText(x, y, text, color = '#ffffff') {
    this.particles.push({
      type: 'text',
      x,
      y,
      vy: -1.8,
      text,
      color,
      alpha: 1,
      life: 45
    });
  }

  spawnBlockDebris(x, y) {
    // 4 fragmentos de ladrillo rotos
    const dirs = [
      { vx: -2.5, vy: -6 },
      { vx: 2.5, vy: -6 },
      { vx: -1.8, vy: -4 },
      { vx: 1.8, vy: -4 }
    ];
    dirs.forEach(d => {
      this.particles.push({
        type: 'debris',
        x: x + 16,
        y: y + 16,
        vx: d.vx,
        vy: d.vy,
        size: 8,
        life: 50
      });
    });
  }

  spawnCoinSparkle(x, y) {
    this.particles.push({
      type: 'coin',
      x: x + 8,
      y,
      vy: -8,
      ay: 0.45,
      life: 25
    });
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'text') {
        p.y += p.vy;
        p.alpha = p.life / 45;
      } else if (p.type === 'debris') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // Gravedad
      } else if (p.type === 'coin') {
        p.y += p.vy;
        p.vy += p.ay;
      }
    }
  }

  draw(ctx, cameraX) {
    this.particles.forEach(p => {
      const screenX = p.x - cameraX;

      if (p.type === 'text') {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText(p.text, screenX, p.y);
        ctx.restore();
      } else if (p.type === 'debris') {
        ctx.fillStyle = '#b84418';
        ctx.fillRect(screenX, p.y, p.size, p.size);
        ctx.fillStyle = '#ff8040';
        ctx.fillRect(screenX + 1, p.y + 1, p.size - 2, p.size - 2);
      } else if (p.type === 'coin') {
        // Moneda saltando
        ctx.fillStyle = '#fcc03c';
        ctx.fillRect(screenX, p.y, 14, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(screenX + 4, p.y + 4, 6, 12);
      }
    });
  }
}

// ============================================================
// ENTIDADES: ENEMIGOS (GOOMBA) Y HONGOS
// ============================================================
class Goomba {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 28;
    this.height = 28;
    this.vx = -1.0;
    this.vy = 0;
    this.isSquashed = false;
    this.squashTimer = 0;
    this.isDead = false;
    this.animFrame = 0;
    this.animTimer = 0;
  }

  update(level) {
    if (this.isDead) return;

    if (this.isSquashed) {
      this.squashTimer++;
      if (this.squashTimer > 25) {
        this.isDead = true;
      }
      return;
    }

    // Gravedad
    this.vy = Math.min(this.vy + 0.45, 10);

    // Movimiento horizontal y colisiones
    this.x += this.vx;
    if (level.checkSolid(this.x, this.y, this.width, this.height)) {
      this.vx = -this.vx;
      this.x += this.vx * 2;
    }

    // Movimiento vertical
    this.y += this.vy;
    const groundTile = level.checkSolid(this.x, this.y, this.width, this.height);
    if (groundTile) {
      this.y = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + (TILE_SIZE - this.height);
      this.vy = 0;
    }

    // Animación de caminata
    this.animTimer++;
    if (this.animTimer > 12) {
      this.animFrame = 1 - this.animFrame;
      this.animTimer = 0;
    }

    // Caída al vacío
    if (this.y > CANVAS_HEIGHT + 50) {
      this.isDead = true;
    }
  }

  squash() {
    this.isSquashed = true;
    this.vx = 0;
    this.vy = 0;
  }

  draw(ctx, cameraX) {
    if (this.isDead) return;
    const sx = this.x - cameraX;

    if (this.isSquashed) {
      // Goomba aplastado
      ctx.fillStyle = '#a84000';
      ctx.fillRect(sx, this.y + 16, this.width, 12);
      ctx.fillStyle = '#fcb070';
      ctx.fillRect(sx + 4, this.y + 18, this.width - 8, 8);
      return;
    }

    // Cabeza de Goomba
    ctx.fillStyle = '#a84000';
    ctx.beginPath();
    ctx.arc(sx + 14, this.y + 12, 13, Math.PI, 0, false);
    ctx.fill();
    ctx.fillRect(sx + 2, this.y + 12, 24, 10);

    // Ojos
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 6, this.y + 8, 4, 8);
    ctx.fillRect(sx + 18, this.y + 8, 4, 8);
    ctx.fillStyle = '#000000';
    ctx.fillRect(sx + 7, this.y + 11, 3, 5);
    ctx.fillRect(sx + 18, this.y + 11, 3, 5);

    // Pies alternados
    ctx.fillStyle = '#000000';
    if (this.animFrame === 0) {
      ctx.fillRect(sx + 1, this.y + 22, 10, 6);
      ctx.fillRect(sx + 17, this.y + 24, 10, 4);
    } else {
      ctx.fillRect(sx + 1, this.y + 24, 10, 4);
      ctx.fillRect(sx + 17, this.y + 22, 10, 6);
    }
  }
}

class Mushroom {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 24;
    this.height = 24;
    this.vx = 1.6;
    this.vy = -3;
    this.isDead = false;
  }

  update(level) {
    if (this.isDead) return;

    this.vy = Math.min(this.vy + 0.45, 8);

    // Movimiento horizontal
    this.x += this.vx;
    if (level.checkSolid(this.x, this.y, this.width, this.height)) {
      this.vx = -this.vx;
      this.x += this.vx * 2;
    }

    // Movimiento vertical
    this.y += this.vy;
    if (level.checkSolid(this.x, this.y, this.width, this.height)) {
      this.y = Math.floor(this.y / TILE_SIZE) * TILE_SIZE + (TILE_SIZE - this.height);
      this.vy = 0;
    }

    if (this.y > CANVAS_HEIGHT + 50) {
      this.isDead = true;
    }
  }

  draw(ctx, cameraX) {
    if (this.isDead) return;
    const sx = this.x - cameraX;

    // Sombrero rojo con motas blancas
    ctx.fillStyle = '#d82800';
    ctx.beginPath();
    ctx.arc(sx + 12, this.y + 10, 11, Math.PI, 0, false);
    ctx.fill();
    ctx.fillRect(sx + 2, this.y + 10, 20, 6);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 9, this.y + 2, 6, 6);
    ctx.fillRect(sx + 3, this.y + 8, 4, 4);
    ctx.fillRect(sx + 17, this.y + 8, 4, 4);

    // Tallo y ojos
    ctx.fillStyle = '#fcb070';
    ctx.fillRect(sx + 5, this.y + 15, 14, 9);
    ctx.fillStyle = '#000000';
    ctx.fillRect(sx + 8, this.y + 17, 2, 4);
    ctx.fillRect(sx + 14, this.y + 17, 2, 4);
  }
}

// ============================================================
// JUGADOR: MARIO
// ============================================================
class Player {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.width = 24;
    this.height = 30;
    this.onGround = false;
    this.facing = 'right';
    this.isSuper = false;
    this.isDead = false;
    this.isDying = false;
    this.dyingTimer = 0;
    this.invulnerableTimer = 0;
    this.flagpoleMode = false;
    this.walkFrame = 0;
    this.walkTimer = 0;
    this.coyoteTime = 0;
    this.jumpBuffer = 0;
  }

  grow() {
    this.isSuper = true;
    this.height = 44;
    this.y -= 14;
  }

  shrink() {
    this.isSuper = false;
    this.height = 30;
    this.invulnerableTimer = 90; // 1.5s invencibilidad
  }

  die() {
    if (this.isDead || this.isDying) return;
    this.isDying = true;
    this.vx = 0;
    this.vy = -11;
    this.dyingTimer = 0;
  }

  update(keys, level, audio, particles, onBlockHit) {
    // Si está muriendo, animación hacia arriba y caída
    if (this.isDying) {
      this.dyingTimer++;
      this.vy += 0.45;
      this.y += this.vy;
      if (this.dyingTimer > 90) {
        this.isDead = true;
      }
      return;
    }

    // Modo fin de nivel (deslizándose por la bandera o caminando al castillo)
    if (this.flagpoleMode) {
      if (this.flagpoleSlide) {
        this.y += 3;
        if (this.y >= level.groundY - this.height) {
          this.y = level.groundY - this.height;
          this.flagpoleSlide = false;
          this.vx = 2; // Caminar hacia el castillo
        }
      } else {
        this.x += this.vx;
        this.walkTimer++;
        if (this.walkTimer > 8) {
          this.walkFrame = (this.walkFrame + 1) % 3;
          this.walkTimer = 0;
        }
      }
      return;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer--;
    }

    // Controles horizontales
    const maxSpeed = keys.sprint ? 5.8 : 3.6;
    const accel = 0.55;
    const friction = this.onGround ? 0.82 : 0.92;

    if (keys.left) {
      this.vx = Math.max(this.vx - accel, -maxSpeed);
      this.facing = 'left';
    } else if (keys.right) {
      this.vx = Math.min(this.vx + accel, maxSpeed);
      this.facing = 'right';
    } else {
      this.vx *= friction;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Salto con Coyote Time y Jump Buffer
    if (this.onGround) {
      this.coyoteTime = 6;
    } else {
      this.coyoteTime = Math.max(0, this.coyoteTime - 1);
    }

    if (keys.jumpJustPressed) {
      this.jumpBuffer = 6;
    } else {
      this.jumpBuffer = Math.max(0, this.jumpBuffer - 1);
    }

    if (this.jumpBuffer > 0 && this.coyoteTime > 0) {
      this.vy = keys.sprint ? -11.8 : -11.0;
      this.onGround = false;
      this.coyoteTime = 0;
      this.jumpBuffer = 0;
      audio.playJump();
    }

    // Salto variable: menor gravedad si se mantiene presionado el botón
    const gravity = (keys.jump && this.vy < 0) ? 0.35 : 0.65;
    this.vy = Math.min(this.vy + gravity, 12);

    // Mover y colisionar en X
    this.x += this.vx;
    let colX = level.checkSolid(this.x, this.y, this.width, this.height);
    if (colX) {
      if (this.vx > 0) {
        this.x = colX.x - this.width;
      } else if (this.vx < 0) {
        this.x = colX.x + TILE_SIZE;
      }
      this.vx = 0;
    }

    // Impedir salir por la izquierda de la pantalla
    const minX = Math.max(0, level.cameraX);
    if (this.x < minX) {
      this.x = minX;
      this.vx = 0;
    }

    // Mover y colisionar en Y
    this.y += this.vy;
    this.onGround = false;

    let colY = level.checkSolid(this.x, this.y, this.width, this.height);
    if (colY) {
      if (this.vy > 0) {
        // Aterrizar sobre el suelo/bloque
        this.y = colY.y - this.height;
        this.vy = 0;
        this.onGround = true;
      } else if (this.vy < 0) {
        // Golpear bloque desde abajo
        this.y = colY.y + TILE_SIZE;
        this.vy = 0;
        const hitResult = level.hitBlock(colY.tileX, colY.tileY, this.isSuper, audio, particles);
        if (hitResult && onBlockHit) {
          onBlockHit(hitResult);
        }
      }
    }

    // Animación de pasos
    if (this.onGround && Math.abs(this.vx) > 0.2) {
      this.walkTimer += Math.abs(this.vx);
      if (this.walkTimer > 16) {
        this.walkFrame = (this.walkFrame + 1) % 3;
        this.walkTimer = 0;
      }
    } else {
      this.walkFrame = 0;
    }

    // Muerte por caída al abismo
    if (this.y > CANVAS_HEIGHT + 20) {
      audio.playDeath();
      this.die();
    }
  }

  draw(ctx, cameraX) {
    // Parpadeo de invencibilidad
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const sx = this.x - cameraX;
    ctx.save();

    if (this.facing === 'left') {
      ctx.translate(sx + this.width, this.y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, this.y);
    }

    const h = this.height;
    const w = this.width;

    if (this.isSuper) {
      // Mario Grande
      // Gorra
      ctx.fillStyle = '#d82800';
      ctx.fillRect(4, 0, 16, 6);
      ctx.fillRect(6, 6, 18, 4);

      // Cara y bigote
      ctx.fillStyle = '#fcb070';
      ctx.fillRect(4, 10, 16, 10);
      ctx.fillStyle = '#5c3800';
      ctx.fillRect(2, 10, 6, 8); // Pelo
      ctx.fillRect(14, 14, 8, 4); // Bigote
      ctx.fillStyle = '#000000';
      ctx.fillRect(16, 11, 3, 3); // Ojo

      // Overol azul y camisa roja
      ctx.fillStyle = '#d82800';
      ctx.fillRect(2, 20, 20, 10);
      ctx.fillStyle = '#0028fc';
      ctx.fillRect(6, 26, 12, 12);
      ctx.fillRect(4, 34, 16, 4);

      // Botones amarillos
      ctx.fillStyle = '#fcc03c';
      ctx.fillRect(8, 28, 2, 2);
      ctx.fillRect(14, 28, 2, 2);

      // Zapatos marrones
      ctx.fillStyle = '#5c3800';
      if (!this.onGround) {
        ctx.fillRect(0, 38, 10, 6);
        ctx.fillRect(14, 38, 10, 6);
      } else if (this.walkFrame === 1) {
        ctx.fillRect(2, 38, 10, 6);
        ctx.fillRect(12, 38, 10, 6);
      } else {
        ctx.fillRect(0, 38, 10, 6);
        ctx.fillRect(14, 38, 10, 6);
      }
    } else {
      // Mario Clásico Pequeño
      // Gorra roja
      ctx.fillStyle = '#d82800';
      ctx.fillRect(3, 0, 14, 4);
      ctx.fillRect(5, 4, 16, 4);

      // Cara
      ctx.fillStyle = '#fcb070';
      ctx.fillRect(3, 8, 14, 8);
      ctx.fillStyle = '#5c3800';
      ctx.fillRect(1, 8, 5, 6); // Cabello
      ctx.fillRect(12, 11, 7, 3); // Bigote
      ctx.fillStyle = '#000000';
      ctx.fillRect(13, 9, 2, 2); // Ojo

      // Overol azul y camisa roja
      ctx.fillStyle = '#d82800';
      ctx.fillRect(2, 16, 18, 6);
      ctx.fillStyle = '#0028fc';
      ctx.fillRect(5, 20, 12, 6);

      // Zapatos
      ctx.fillStyle = '#5c3800';
      if (!this.onGround) {
        ctx.fillRect(0, 24, 8, 6);
        ctx.fillRect(14, 24, 8, 6);
      } else if (this.walkFrame === 1) {
        ctx.fillRect(2, 24, 8, 6);
        ctx.fillRect(12, 24, 8, 6);
      } else {
        ctx.fillRect(0, 24, 8, 6);
        ctx.fillRect(14, 24, 8, 6);
      }
    }

    ctx.restore();
  }
}

// ============================================================
// DISEÑO DEL NIVEL Y SISTEMA DE COLISIONES
// ============================================================
class Level {
  constructor() {
    this.cols = 130;
    this.rows = 15;
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;
    this.groundY = 13 * TILE_SIZE;
    this.cameraX = 0;

    this.tiles = Array.from({ length: this.rows }, () => Array(this.cols).fill(TILE.EMPTY));
    this.bouncingBlocks = [];
    this.flagpoleX = 114 * TILE_SIZE;
    this.flagY = 3 * TILE_SIZE;
    this.castleX = 120 * TILE_SIZE;

    this.buildWorld();
  }

  buildWorld() {
    // 1. Suelo continuo con agujeros estratégicos (fosos estilo Mario)
    for (let c = 0; c < this.cols; c++) {
      // Agujeros en columnas 38-40 y 68-70
      if ((c >= 38 && c <= 40) || (c >= 68 && c <= 70)) {
        continue;
      }
      this.tiles[13][c] = TILE.GROUND;
      this.tiles[14][c] = TILE.GROUND;
    }

    // 2. Primera zona de bloques: [?] y ladrillos
    this.tiles[9][16] = TILE.Q_COIN;
    this.tiles[9][20] = TILE.BRICK;
    this.tiles[9][21] = TILE.Q_MUSHROOM; // ¡Hongo!
    this.tiles[9][22] = TILE.BRICK;
    this.tiles[9][23] = TILE.Q_COIN;
    this.tiles[9][24] = TILE.BRICK;

    this.tiles[5][22] = TILE.Q_COIN; // Bloque elevado

    // 3. Tuberías verdes de diferentes alturas
    this.buildPipe(28, 2); // 2 bloques de alto
    this.buildPipe(34, 3); // 3 bloques de alto
    this.buildPipe(46, 4); // 4 bloques de alto
    this.buildPipe(56, 2);

    // 4. Bloques después de la primera tubería
    this.tiles[9][48] = TILE.BRICK;
    this.tiles[9][49] = TILE.Q_COIN;
    this.tiles[9][50] = TILE.BRICK;

    // Fila alta de ladrillos con monedas
    for (let c = 52; c <= 55; c++) {
      this.tiles[5][c] = TILE.BRICK;
    }
    this.tiles[5][53] = TILE.Q_COIN;

    // 5. Estructura de escalera pirámide antes de la bandera
    this.buildStairs(80, 4, true); // Escalera que sube
    this.buildStairs(86, 4, false); // Escalera que baja

    this.buildStairs(100, 8, true); // Gran escalera final hacia la bandera

    // 6. Castillo final
    this.buildCastle(120);
  }

  buildPipe(col, height) {
    const topRow = 13 - height;
    this.tiles[topRow][col] = TILE.PIPE_TL;
    this.tiles[topRow][col + 1] = TILE.PIPE_TR;
    for (let r = topRow + 1; r < 13; r++) {
      this.tiles[r][col] = TILE.PIPE_BODY_L;
      this.tiles[r][col + 1] = TILE.PIPE_BODY_R;
    }
  }

  buildStairs(startCol, height, ascending) {
    for (let h = 1; h <= height; h++) {
      const col = ascending ? startCol + h - 1 : startCol + (height - h);
      for (let r = 13 - h; r < 13; r++) {
        this.tiles[r][col] = TILE.CASTLE_BRICK;
      }
    }
  }

  buildCastle(col) {
    for (let r = 8; r < 13; r++) {
      for (let c = col; c < col + 6; c++) {
        this.tiles[r][c] = TILE.CASTLE_BRICK;
      }
    }
    // Almenas superiores
    this.tiles[7][col] = TILE.CASTLE_BRICK;
    this.tiles[7][col + 2] = TILE.CASTLE_BRICK;
    this.tiles[7][col + 4] = TILE.CASTLE_BRICK;
  }

  checkSolid(x, y, w, h) {
    const startCol = Math.floor(x / TILE_SIZE);
    const endCol = Math.floor((x + w - 0.1) / TILE_SIZE);
    const startRow = Math.floor(y / TILE_SIZE);
    const endRow = Math.floor((y + h - 0.1) / TILE_SIZE);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          const tile = this.tiles[r][c];
          if (tile !== TILE.EMPTY) {
            return {
              x: c * TILE_SIZE,
              y: r * TILE_SIZE,
              tileX: c,
              tileY: r,
              type: tile
            };
          }
        }
      }
    }
    return null;
  }

  hitBlock(tileX, tileY, isSuper, audio, particles, onSpawnMushroom) {
    const tile = this.tiles[tileY][tileX];

    if (tile === TILE.Q_COIN) {
      this.tiles[tileY][tileX] = TILE.USED;
      this.addBouncingBlock(tileX, tileY);
      audio.playCoin();
      particles.spawnCoinSparkle(tileX * TILE_SIZE, (tileY - 1) * TILE_SIZE);
      particles.spawnText(tileX * TILE_SIZE, (tileY - 1) * TILE_SIZE, '+200', '#fcc03c');
      return { score: 200, coin: 1 };
    } else if (tile === TILE.Q_MUSHROOM) {
      this.tiles[tileY][tileX] = TILE.USED;
      this.addBouncingBlock(tileX, tileY);
      audio.playPowerup();
      particles.spawnText(tileX * TILE_SIZE, (tileY - 1) * TILE_SIZE, 'MUSHROOM!', '#00e676');
      return { mushroom: { x: tileX * TILE_SIZE, y: (tileY - 1) * TILE_SIZE } };
    } else if (tile === TILE.BRICK) {
      if (isSuper) {
        this.tiles[tileY][tileX] = TILE.EMPTY;
        audio.playBump();
        particles.spawnBlockDebris(tileX * TILE_SIZE, tileY * TILE_SIZE);
        return { score: 50 };
      } else {
        this.addBouncingBlock(tileX, tileY);
        audio.playBump();
      }
    }
    return null;
  }

  addBouncingBlock(col, row) {
    this.bouncingBlocks.push({
      col,
      row,
      offsetY: 0,
      vy: -4
    });
  }

  updateBouncingBlocks() {
    for (let i = this.bouncingBlocks.length - 1; i >= 0; i--) {
      const b = this.bouncingBlocks[i];
      b.offsetY += b.vy;
      b.vy += 0.8;
      if (b.offsetY >= 0) {
        this.bouncingBlocks.splice(i, 1);
      }
    }
  }

  draw(ctx, cameraX) {
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((cameraX + CANVAS_WIDTH) / TILE_SIZE));

    // Dibujar elementos estáticos del nivel
    for (let r = 0; r < this.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.tiles[r][c];
        if (tile === TILE.EMPTY) continue;

        // Comprobar si este bloque está rebotando
        const bounce = this.bouncingBlocks.find(b => b.col === c && b.row === r);
        const offsetY = bounce ? bounce.offsetY : 0;
        const x = c * TILE_SIZE - cameraX;
        const y = r * TILE_SIZE + offsetY;

        this.drawTile(ctx, tile, x, y);
      }
    }

    // Dibujar Asta de la Bandera y Bandera
    const flagPoleScreenX = this.flagpoleX - cameraX;
    if (flagPoleScreenX > -50 && flagPoleScreenX < CANVAS_WIDTH + 50) {
      // Poste
      ctx.fillStyle = '#00a800';
      ctx.fillRect(flagPoleScreenX + 14, 3 * TILE_SIZE, 4, 10 * TILE_SIZE);
      ctx.fillStyle = '#fcc03c';
      ctx.beginPath();
      ctx.arc(flagPoleScreenX + 16, 3 * TILE_SIZE, 7, 0, Math.PI * 2);
      ctx.fill();

      // Bandera roja triangular
      ctx.fillStyle = '#d82800';
      ctx.beginPath();
      ctx.moveTo(flagPoleScreenX + 14, this.flagY);
      ctx.lineTo(flagPoleScreenX - 18, this.flagY + 12);
      ctx.lineTo(flagPoleScreenX + 14, this.flagY + 24);
      ctx.fill();
    }

    // Puerta del castillo
    const castleDoorX = this.castleX + 2 * TILE_SIZE - cameraX;
    ctx.fillStyle = '#000000';
    ctx.fillRect(castleDoorX, 11 * TILE_SIZE, 2 * TILE_SIZE, 2 * TILE_SIZE);
    ctx.beginPath();
    ctx.arc(castleDoorX + TILE_SIZE, 11 * TILE_SIZE, TILE_SIZE, Math.PI, 0, false);
    ctx.fill();
  }

  drawTile(ctx, type, x, y) {
    switch (type) {
      case TILE.GROUND:
        // Tierra con césped verde arriba
        ctx.fillStyle = '#a84000';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x, y, TILE_SIZE, 6);
        ctx.fillStyle = '#fcb070';
        ctx.fillRect(x + 4, y + 10, 4, 4);
        ctx.fillRect(x + 18, y + 18, 4, 4);
        break;

      case TILE.BRICK:
        // Ladrillos retro
        ctx.fillStyle = '#b84418';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y + 15, TILE_SIZE, 2);
        ctx.fillRect(x + 15, y, 2, 15);
        ctx.fillRect(x + 7, y + 17, 2, 15);
        ctx.fillRect(x + 23, y + 17, 2, 15);
        break;

      case TILE.Q_COIN:
      case TILE.Q_MUSHROOM:
        // Bloque Misterioso amarillo
        ctx.fillStyle = '#fcc03c';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        // Símbolo "?"
        ctx.font = '16px "Press Start 2P"';
        ctx.fillStyle = '#a84000';
        ctx.fillText('?', x + 9, y + 24);
        break;

      case TILE.USED:
        // Bloque usado metálico
        ctx.fillStyle = '#8a5c38';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.fillStyle = '#402810';
        ctx.fillRect(x + 4, y + 4, 3, 3);
        ctx.fillRect(x + TILE_SIZE - 7, y + 4, 3, 3);
        ctx.fillRect(x + 4, y + TILE_SIZE - 7, 3, 3);
        ctx.fillRect(x + TILE_SIZE - 7, y + TILE_SIZE - 7, 3, 3);
        break;

      case TILE.PIPE_TL:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#80e060';
        ctx.fillRect(x + 4, y, 6, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y, 2, TILE_SIZE);
        break;

      case TILE.PIPE_TR:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#005000';
        ctx.fillRect(x + TILE_SIZE - 6, y, 6, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
        break;

      case TILE.PIPE_BODY_L:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x + 3, y, TILE_SIZE - 3, TILE_SIZE);
        ctx.fillStyle = '#80e060';
        ctx.fillRect(x + 6, y, 5, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 3, y, 2, TILE_SIZE);
        break;

      case TILE.PIPE_BODY_R:
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x, y, TILE_SIZE - 3, TILE_SIZE);
        ctx.fillStyle = '#005000';
        ctx.fillRect(x + TILE_SIZE - 9, y, 6, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + TILE_SIZE - 5, y, 2, TILE_SIZE);
        break;

      case TILE.CASTLE_BRICK:
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#000000';
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        break;
    }
  }
}

// ============================================================
// ESCENARIO Y FONDO PARALLAX (NUBES Y COLINAS)
// ============================================================
class Background {
  constructor() {
    this.clouds = [
      { x: 120, y: 70, scale: 1 },
      { x: 450, y: 50, scale: 1.2 },
      { x: 800, y: 80, scale: 0.9 },
      { x: 1200, y: 60, scale: 1.1 },
      { x: 1650, y: 75, scale: 1 },
      { x: 2100, y: 55, scale: 1.3 },
      { x: 2600, y: 65, scale: 1 },
      { x: 3100, y: 70, scale: 1.1 }
    ];

    this.hills = [
      { x: 80, y: 13 * TILE_SIZE, r: 60 },
      { x: 500, y: 13 * TILE_SIZE, r: 85 },
      { x: 950, y: 13 * TILE_SIZE, r: 50 },
      { x: 1400, y: 13 * TILE_SIZE, r: 90 },
      { x: 1900, y: 13 * TILE_SIZE, r: 65 },
      { x: 2400, y: 13 * TILE_SIZE, r: 80 },
      { x: 2900, y: 13 * TILE_SIZE, r: 70 }
    ];
  }

  draw(ctx, cameraX) {
    // Cielo azul retro
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Colinas verdes redondeadas (Parallax lento: 0.3)
    ctx.fillStyle = '#00a800';
    this.hills.forEach(h => {
      const sx = h.x - cameraX * 0.35;
      if (sx > -150 && sx < CANVAS_WIDTH + 150) {
        ctx.beginPath();
        ctx.arc(sx, h.y, h.r, Math.PI, 0, false);
        ctx.fill();
        // Borde oscuro
        ctx.strokeStyle = '#005000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Nubes esponjosas (Parallax: 0.15)
    ctx.fillStyle = '#ffffff';
    this.clouds.forEach(c => {
      const sx = c.x - cameraX * 0.2;
      if (sx > -120 && sx < CANVAS_WIDTH + 120) {
        const s = c.scale;
        ctx.beginPath();
        ctx.arc(sx, c.y, 16 * s, 0, Math.PI * 2);
        ctx.arc(sx + 18 * s, c.y - 6 * s, 18 * s, 0, Math.PI * 2);
        ctx.arc(sx + 36 * s, c.y, 16 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

// ============================================================
// MOTOR PRINCIPAL DEL JUEGO
// ============================================================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.audio = new AudioManager();
    this.particles = new ParticleSystem();
    this.bg = new Background();

    // DOM Elements
    this.hudScore = document.getElementById('hud-score');
    this.hudCoins = document.getElementById('hud-coins');
    this.hudTime = document.getElementById('hud-time');
    this.screenOverlay = document.getElementById('screen-overlay');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlaySubtitle = document.getElementById('overlay-subtitle');
    this.overlayStats = document.getElementById('overlay-stats');
    this.finalScore = document.getElementById('final-score');
    this.finalCoins = document.getElementById('final-coins');
    this.startBtn = document.getElementById('start-btn');
    this.bgmBtn = document.getElementById('bgm-btn');

    // Estado del juego
    this.keys = {
      left: false,
      right: false,
      jump: false,
      jumpJustPressed: false,
      sprint: false
    };

    this.score = 0;
    this.coins = 0;
    this.time = 400;
    this.timerCountdown = 0;
    this.gameState = 'TITLE'; // TITLE, PLAYING, VICTORY, GAMEOVER

    this.initWorld();
    this.bindEvents();
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  initWorld() {
    this.level = new Level();
    this.player = new Player(80, 10 * TILE_SIZE);
    this.enemies = [
      new Goomba(22 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(41 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(51 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(53 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(75 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(78 * TILE_SIZE, 12 * TILE_SIZE),
      new Goomba(92 * TILE_SIZE, 12 * TILE_SIZE)
    ];
    this.mushrooms = [];
    this.time = 400;
  }

  startGame() {
    this.audio.init();
    this.audio.startBGM();
    this.initWorld();
    this.score = 0;
    this.coins = 0;
    this.gameState = 'PLAYING';
    this.screenOverlay.classList.add('hidden');
    this.updateHUD();
  }

  restart() {
    this.audio.init();
    this.audio.startBGM();
    this.initWorld();
    this.gameState = 'PLAYING';
    this.screenOverlay.classList.add('hidden');
    this.updateHUD();
  }

  triggerVictory() {
    this.gameState = 'VICTORY';
    this.audio.playVictory();

    const timeBonus = this.time * 50;
    this.score += timeBonus;
    this.updateHUD();

    setTimeout(() => {
      this.overlayTitle.textContent = '¡NIVEL COMPLETADO!';
      this.overlaySubtitle.textContent = `Bonus de tiempo: +${timeBonus} pts`;
      this.finalScore.textContent = this.score;
      this.finalCoins.textContent = this.coins;
      this.overlayStats.classList.remove('hidden');
      this.startBtn.textContent = 'JUGAR DE NUEVO';
      this.screenOverlay.classList.remove('hidden');
    }, 2500);
  }

  triggerGameOver() {
    this.gameState = 'GAMEOVER';
    this.overlayTitle.textContent = 'GAME OVER';
    this.overlaySubtitle.textContent = '¡Mario se cayó o fue derrotado!';
    this.finalScore.textContent = this.score;
    this.finalCoins.textContent = this.coins;
    this.overlayStats.classList.remove('hidden');
    this.startBtn.textContent = 'INTENTAR DE NUEVO';
    this.screenOverlay.classList.remove('hidden');
  }

  updateHUD() {
    this.hudScore.textContent = this.score.toString().padStart(6, '0');
    this.hudCoins.textContent = `🪙 x${this.coins.toString().padStart(2, '0')}`;
    this.hudTime.textContent = Math.max(0, this.time).toString().padStart(3, '0');
  }

  update(dt) {
    if (this.gameState !== 'PLAYING') return;

    // Temporizador
    this.timerCountdown += dt;
    if (this.timerCountdown > 1000) {
      this.time--;
      this.timerCountdown = 0;
      this.updateHUD();
      if (this.time <= 0) {
        this.player.die();
        this.audio.playDeath();
      }
    }

    // Actualizar jugador
    this.player.update(this.keys, this.level, this.audio, this.particles, (result) => {
      if (result.score) this.score += result.score;
      if (result.coin) this.coins += result.coin;
      if (result.mushroom) {
        this.mushrooms.push(new Mushroom(result.mushroom.x, result.mushroom.y));
      }
      this.updateHUD();
    });

    // Si Mario murió completamente
    if (this.player.isDead) {
      this.triggerGameOver();
      return;
    }

    // Cámara que sigue a Mario suavemente sin retroceder
    const targetCamX = this.player.x - CANVAS_WIDTH * 0.35;
    if (targetCamX > this.level.cameraX) {
      this.level.cameraX = Math.min(targetCamX, this.level.width - CANVAS_WIDTH);
    }

    // Actualizar bloques que rebotan
    this.level.updateBouncingBlocks();

    // Actualizar hongos
    for (let i = this.mushrooms.length - 1; i >= 0; i--) {
      const m = this.mushrooms[i];
      m.update(this.level);

      // Colisión con Mario
      if (
        !m.isDead &&
        this.player.x < m.x + m.width &&
        this.player.x + this.player.width > m.x &&
        this.player.y < m.y + m.height &&
        this.player.y + this.player.height > m.y
      ) {
        m.isDead = true;
        this.mushrooms.splice(i, 1);
        this.player.grow();
        this.score += 1000;
        this.particles.spawnText(m.x, m.y, '1000', '#00e676');
        this.audio.playPowerup();
        this.updateHUD();
      }
    }

    // Actualizar enemigos
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Solo actualizar si está cerca de la pantalla
      if (e.x > this.level.cameraX - 100 && e.x < this.level.cameraX + CANVAS_WIDTH + 150) {
        e.update(this.level);

        // Colisión con Mario
        if (
          !e.isDead &&
          !e.isSquashed &&
          !this.player.isDying &&
          this.player.x < e.x + e.width &&
          this.player.x + this.player.width > e.x &&
          this.player.y < e.y + e.height &&
          this.player.y + this.player.height > e.y
        ) {
          // Si Mario aterriza sobre el Goomba
          if (this.player.vy > 0 && this.player.y + this.player.height - this.player.vy <= e.y + 12) {
            e.squash();
            this.player.vy = -8.5; // Rebote de Mario
            this.audio.playStomp();
            this.score += 200;
            this.particles.spawnText(e.x, e.y, '200', '#ffffff');
            this.updateHUD();
          } else {
            // Golpe lateral a Mario
            if (this.player.invulnerableTimer === 0) {
              if (this.player.isSuper) {
                this.player.shrink();
                this.audio.playBump();
              } else {
                this.audio.playDeath();
                this.player.die();
              }
            }
          }
        }
      }
    }

    // Verificar contacto con el asta de la bandera (Victoria)
    if (!this.player.flagpoleMode && this.player.x >= this.level.flagpoleX) {
      this.player.flagpoleMode = true;
      this.player.flagpoleSlide = true;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.x = this.level.flagpoleX - 6;
      this.audio.playVictory();
      this.triggerVictory();
    }

    // Si está en la bandera, bajar la bandera al mismo tiempo
    if (this.player.flagpoleMode && this.level.flagY < 12 * TILE_SIZE) {
      this.level.flagY += 3;
    }

    // Actualizar partículas
    this.particles.update();

    // Resetear flag de un solo frame
    this.keys.jumpJustPressed = false;
  }

  draw() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Fondo Parallax
    this.bg.draw(this.ctx, this.level.cameraX);

    // 2. Nivel y Bloques
    this.level.draw(this.ctx, this.level.cameraX);

    // 3. Hongos
    this.mushrooms.forEach(m => m.draw(this.ctx, this.level.cameraX));

    // 4. Enemigos
    this.enemies.forEach(e => e.draw(this.ctx, this.level.cameraX));

    // 5. Jugador
    this.player.draw(this.ctx, this.level.cameraX);

    // 6. Partículas y Efectos
    this.particles.draw(this.ctx, this.level.cameraX);
  }

  loop(currentTime) {
    const dt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }

  bindEvents() {
    // Teclado
    window.addEventListener('keydown', e => {
      this.audio.init();

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.keys.left = true;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.keys.right = true;
      }
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        if (!this.keys.jump) {
          this.keys.jumpJustPressed = true;
        }
        this.keys.jump = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ') {
        this.keys.sprint = true;
      }
      if (e.code === 'KeyR') {
        this.restart();
      }
      if (e.code === 'KeyM') {
        const muted = this.audio.toggleMute();
        this.bgmBtn.textContent = muted ? '🔇' : '🎵';
      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.keys.left = false;
      }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.keys.right = false;
      }
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        this.keys.jump = false;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ') {
        this.keys.sprint = false;
      }
    });

    // Botones de interfaz
    this.startBtn.addEventListener('click', () => {
      if (this.gameState === 'TITLE') {
        this.startGame();
      } else {
        this.restart();
      }
    });

    this.bgmBtn.addEventListener('click', () => {
      this.audio.init();
      const muted = this.audio.toggleMute();
      this.bgmBtn.textContent = muted ? '🔇' : '🎵';
    });

    // Controles táctiles en pantalla
    const bindTouch = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;

      const downHandler = e => {
        e.preventDefault();
        this.audio.init();
        onDown();
      };
      const upHandler = e => {
        e.preventDefault();
        if (onUp) onUp();
      };

      el.addEventListener('touchstart', downHandler, { passive: false });
      el.addEventListener('touchend', upHandler, { passive: false });
      el.addEventListener('mousedown', downHandler);
      el.addEventListener('mouseup', upHandler);
    };

    bindTouch(
      'touch-left',
      () => (this.keys.left = true),
      () => (this.keys.left = false)
    );
    bindTouch(
      'touch-right',
      () => (this.keys.right = true),
      () => (this.keys.right = false)
    );
    bindTouch(
      'touch-jump',
      () => {
        this.keys.jumpJustPressed = true;
        this.keys.jump = true;
      },
      () => (this.keys.jump = false)
    );
    bindTouch(
      'touch-sprint',
      () => (this.keys.sprint = true),
      () => (this.keys.sprint = false)
    );
  }
}

// Iniciar al cargar
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
