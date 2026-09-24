/**
 * CYBER DUO: MONSTER ASSAULT
 * Juego de plataformas de disparos cooperativo para 2 jugadores en Canvas HTML5.
 * 
 * Controles:
 * - Jugador 1: WASD para moverse y saltar | Barra Espaciadora para disparar
 * - Jugador 2: Flechas para moverse y saltar | 0 del Teclado Numérico (o tecla 0) para disparar
 */

// ============================================================
// CONSTANTES GLOBALES
// ============================================================
const CANVAS_WIDTH = 840;
const CANVAS_HEIGHT = 480;
const TILE_SIZE = 32;
const GRAVITY = 0.52;

// Tipos de Bloques en el Mapa
const TILE = {
  EMPTY: 0,
  SOLID: 1,         // Bloque sólido metálico
  PLATFORM: 2,      // Plataforma unidireccional (atravesable desde abajo, baja con tecla Abajo)
  HAZARD: 3,        // Ácido / pinchos electrificados
  CRATE: 4,         // Caja destructible de suministros
  EXIT_GATE: 5      // Compuerta de fin de nivel
};

// Tipos de Armas
const WEAPON = {
  BLASTER: { name: 'BLASTER', fireRate: 150, damage: 1, speed: 11, spread: 1, color: '#00e5ff', cost: 0 },
  SPREAD:  { name: 'SPREAD',  fireRate: 220, damage: 1, speed: 10, spread: 3, color: '#39ff14', duration: 900 },
  LASER:   { name: 'LASER',   fireRate: 280, damage: 3, speed: 16, pierce: true, color: '#ff00ff', duration: 750 },
  MISSILE: { name: 'MISSILE', fireRate: 350, damage: 5, speed: 8, explosive: true, color: '#ff9100', duration: 600 }
};

// ============================================================
// SISTEMA DE AUDIO SINTETIZADO (Web Audio API)
// ============================================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'square', duration = 0.1, gainVal = 0.12, slideFreq = null) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideFreq), this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playNoise(duration = 0.15, gainVal = 0.15) {
    if (this.muted || !this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  p1Shoot() {
    this.playTone(850, 'sawtooth', 0.08, 0.08, 220);
  }

  p2Shoot() {
    this.playTone(420, 'square', 0.09, 0.1, 110);
  }

  laserShoot() {
    this.playTone(1200, 'sine', 0.14, 0.12, 100);
  }

  missileExplode() {
    this.playNoise(0.28, 0.25);
    this.playTone(120, 'sawtooth', 0.25, 0.2, 30);
  }

  jump() {
    this.playTone(160, 'sine', 0.14, 0.1, 480);
  }

  hit() {
    this.playNoise(0.06, 0.12);
  }

  enemyDeath() {
    this.playNoise(0.18, 0.18);
    this.playTone(180, 'square', 0.18, 0.1, 40);
  }

  playerHurt() {
    this.playNoise(0.2, 0.22);
    this.playTone(280, 'sawtooth', 0.2, 0.18, 80);
  }

  powerup() {
    if (this.muted || !this.ctx) return;
    const notes = [330, 440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.08, 0.1), i * 50);
    });
  }

  bossRoar() {
    this.playTone(70, 'sawtooth', 0.6, 0.3, 30);
    this.playNoise(0.4, 0.2);
  }

  victory() {
    const notes = [440, 554, 659, 880, 1108];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.22, 0.14), i * 110);
    });
  }

  gameOver() {
    const notes = [400, 360, 320, 240, 180];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.25, 0.15), i * 120);
    });
  }

  startBGM() {
    if (this.bgmPlaying || this.muted) return;
    this.init();
    this.bgmPlaying = true;
    this.bgmStep = 0;

    // Línea de bajo y melodía chiptune synthwave
    const bass = [110, 110, 130, 110, 146, 110, 164, 146];
    const melody = [440, 0, 523, 0, 659, 587, 0, 523, 659, 0, 784, 0, 880, 784, 659, 587];

    this.bgmTimer = setInterval(() => {
      if (!this.bgmPlaying || this.muted) return;
      const bFreq = bass[this.bgmStep % bass.length];
      const mFreq = melody[this.bgmStep % melody.length];

      this.playTone(bFreq, 'triangle', 0.1, 0.04);
      if (mFreq > 0) {
        this.playTone(mFreq, 'square', 0.08, 0.025);
      }
      if (this.bgmStep % 4 === 2) {
        this.playNoise(0.04, 0.03); // Snare chiptune
      }
      this.bgmStep++;
    }, 135);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return !this.muted;
  }
}

// ============================================================
// GESTOR DE ENTRADA / TECLADO
// ============================================================
class InputManager {
  constructor() {
    this.keys = {};
    this.p1 = { left: false, right: false, up: false, down: false, shoot: false, shootPressed: false };
    this.p2 = { left: false, right: false, up: false, down: false, shoot: false, shootPressed: false };
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      this.keys[e.key] = true;

      // Prevenir scroll en teclas de juego
      const preventKeys = [
        'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Numpad0', 'Digit0'
      ];
      if (preventKeys.includes(e.code) || preventKeys.includes(e.key)) {
        e.preventDefault();
      }

      this.updateState();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.keys[e.key] = false;
      this.updateState();
    });
  }

  updateState() {
    // --- CONTROLES JUGADOR 1 (WASD + ESPACIO) ---
    this.p1.left = !!(this.keys['KeyA'] || this.keys['a'] || this.keys['A']);
    this.p1.right = !!(this.keys['KeyD'] || this.keys['d'] || this.keys['D']);
    this.p1.up = !!(this.keys['KeyW'] || this.keys['w'] || this.keys['W']);
    this.p1.down = !!(this.keys['KeyS'] || this.keys['s'] || this.keys['S']);
    this.p1.shoot = !!(this.keys['Space'] || this.keys[' ']);

    // --- CONTROLES JUGADOR 2 (FLECHAS + 0 NUMPAD / 0) ---
    this.p2.left = !!this.keys['ArrowLeft'];
    this.p2.right = !!this.keys['ArrowRight'];
    this.p2.up = !!this.keys['ArrowUp'];
    this.p2.down = !!this.keys['ArrowDown'];
    this.p2.shoot = !!(
      this.keys['Numpad0'] ||
      this.keys['Digit0'] ||
      this.keys['0'] ||
      this.keys['NumpadInsert'] ||
      this.keys['Insert']
    );
  }
}

// ============================================================
// SISTEMA DE PARTÍCULAS Y SCREEN SHAKE
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }

  triggerShake(intensity = 6, duration = 12) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  spawnMuzzleFlash(x, y, color = '#00e5ff') {
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        type: 'spark',
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        size: Math.random() * 3 + 2,
        color,
        life: 8,
        maxLife: 8
      });
    }
  }

  spawnExplosion(x, y, color = '#ff7700', count = 16) {
    this.triggerShake(7, 14);
    // Anillo de choque expansivo
    this.particles.push({
      type: 'shockwave',
      x, y,
      radius: 4,
      maxRadius: 28,
      color,
      life: 14,
      maxLife: 14
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 4.5 + 2;
      this.particles.push({
        type: 'smoke',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 3,
        color: Math.random() > 0.4 ? color : '#ffff55',
        life: 22,
        maxLife: 22
      });
    }
  }

  spawnBloodOrSparks(x, y, color = '#39ff14', count = 6) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'spark',
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.7) * 4,
        size: Math.random() * 3 + 1,
        color,
        life: 16,
        maxLife: 16
      });
    }
  }

  spawnText(x, y, text, color = '#ffffff') {
    this.particles.push({
      type: 'text',
      x, y,
      text,
      color,
      vy: -1.6,
      life: 36,
      maxLife: 36
    });
  }

  update() {
    if (this.shakeDuration > 0) {
      this.shakeDuration--;
    } else {
      this.shakeIntensity = 0;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'spark') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
      } else if (p.type === 'smoke') {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
      } else if (p.type === 'shockwave') {
        p.radius += (p.maxRadius - p.radius) * 0.2;
      } else if (p.type === 'text') {
        p.y += p.vy;
      }
    }
  }

  draw(ctx, camX, camY) {
    this.particles.forEach(p => {
      const screenX = p.x - camX;
      const screenY = p.y - camY;
      const alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'spark' || p.type === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.fillRect(screenX - p.size / 2, screenY - p.size / 2, p.size, p.size);
      } else if (p.type === 'shockwave') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = '9px "Press Start 2P"';
        ctx.fillText(p.text, screenX, screenY);
      }
      ctx.restore();
    });
  }
}

// ============================================================
// PROYECTILES (BALAS Y LÁSERES)
// ============================================================
class Projectile {
  constructor(x, y, vx, vy, damage, ownerId, color, isLaser = false, isMissile = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.ownerId = ownerId; // 1 o 2 (o 'enemy')
    this.color = color;
    this.isLaser = isLaser;
    this.isMissile = isMissile;
    this.width = isLaser ? 24 : (isMissile ? 12 : 7);
    this.height = isLaser ? 6 : (isMissile ? 12 : 7);
    this.dead = false;
    this.life = 120;
  }

  update(level, particles, sfx) {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }

    // Comprobar colisión con bloques sólidos del mapa
    const tile = level.getTileAtPixel(this.x, this.y);
    if (tile === TILE.SOLID || tile === TILE.CRATE) {
      this.dead = true;
      if (this.isMissile) {
        sfx.missileExplode();
        particles.spawnExplosion(this.x, this.y, '#ff9100', 20);
      } else {
        particles.spawnMuzzleFlash(this.x, this.y, this.color);
      }
      if (tile === TILE.CRATE) {
        level.destroyCrate(this.x, this.y);
      }
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;

    ctx.save();
    if (this.isLaser) {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 2, cy - 1, this.width - 4, 2);
    } else if (this.isMissile) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle = '#ff3300';
      ctx.fillRect(sx - 2, sy + 2, 3, this.height - 4);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(sx + this.width - 2, sy + 2, 4, 4);
    } else {
      // Bala esférica de energía
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ============================================================
// JUGADORES (PLAYER 1 & PLAYER 2)
// ============================================================
class Player {
  constructor(id, x, y, name, colorTheme) {
    this.id = id;
    this.startX = x;
    this.startY = y;
    this.name = name;
    this.theme = colorTheme; // { primary, secondary, glow }

    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.width = 24;
    this.height = 36;
    this.onGround = false;
    this.facing = this.id === 1 ? 'right' : 'left';
    this.aimUp = false;
    this.crouching = false;

    this.hp = 5;
    this.maxHp = 5;
    this.isDead = false;
    this.invulnerableTimer = 0;
    this.respawnTimer = 0;

    this.weapon = WEAPON.BLASTER;
    this.weaponTimer = 0;
    this.lastShootTime = 0;

    this.kills = 0;
    this.score = 0;
    this.walkCycle = 0;
    this.prevUp = false;
  }

  setWeapon(w) {
    this.weapon = w;
    this.weaponTimer = w.duration || 0;
  }

  takeDamage(amount, sfx, particles) {
    if (this.invulnerableTimer > 0 || this.isDead) return;
    this.hp -= amount;
    this.invulnerableTimer = 65; // ~1 seg invulnerabilidad
    sfx.playerHurt();
    particles.triggerShake(7, 10);
    particles.spawnBloodOrSparks(this.x + this.width / 2, this.y + this.height / 2, this.theme.primary, 10);

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.respawnTimer = 180; // 3 seg para reaparecer
      particles.spawnExplosion(this.x + this.width / 2, this.y + this.height / 2, this.theme.primary, 24);
    }
  }

  respawnNear(otherPlayer) {
    this.isDead = false;
    this.hp = 3;
    this.x = otherPlayer ? otherPlayer.x : this.startX;
    this.y = otherPlayer ? otherPlayer.y - 40 : this.startY;
    this.vx = 0;
    this.vy = -4;
    this.invulnerableTimer = 120;
    this.setWeapon(WEAPON.BLASTER);
  }

  update(input, level, projectiles, sfx, particles, now) {
    // Si está muerto, cuenta regresiva de reaparición
    if (this.isDead) {
      if (this.respawnTimer > 0) {
        this.respawnTimer--;
      }
      return;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer--;
    }

    // Actualizar temporizador de arma especial
    if (this.weaponTimer > 0) {
      this.weaponTimer--;
      if (this.weaponTimer <= 0) {
        this.weapon = WEAPON.BLASTER;
      }
    }

    // Estados de Apuntado
    this.aimUp = input.up;
    this.crouching = input.down && this.onGround;

    // Movimiento Horizontal
    const speed = 4.2;
    if (input.left && !this.crouching) {
      this.vx = -speed;
      this.facing = 'left';
    } else if (input.right && !this.crouching) {
      this.vx = speed;
      this.facing = 'right';
    } else {
      this.vx *= 0.65;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Salto responsivo con altura variable
    const jumpPressed = input.up && !this.prevUp;
    if (jumpPressed && this.onGround && !this.crouching) {
      this.vy = -12;
      this.onGround = false;
      sfx.jump();
      particles.spawnBloodOrSparks(this.x + this.width / 2, this.y + this.height, '#ffffff', 4);
    }
    // Salto de altura variable si se suelta la tecla mientras sube
    if (!input.up && this.vy < -4) {
      this.vy *= 0.55;
    }
    this.prevUp = input.up;

    // Aplicar Gravedad
    this.vy += GRAVITY;
    if (this.vy > 13) this.vy = 13;

    // --- COLISIÓN EN EJE X ---
    this.x += this.vx;
    this.handleHorizontalCollision(level);

    // --- COLISIÓN EN EJE Y ---
    this.y += this.vy;
    this.handleVerticalCollision(level, input.down, sfx, particles);

    // Comprobar Caída al Vacío o Ácido
    if (this.y > level.heightPixels + 50) {
      this.takeDamage(99, sfx, particles);
    }

    // Animación de caminata
    if (Math.abs(this.vx) > 0.5 && this.onGround) {
      this.walkCycle += 0.25;
    } else {
      this.walkCycle = 0;
    }

    // --- DISPARO ---
    if (input.shoot) {
      if (now - this.lastShootTime >= this.weapon.fireRate) {
        this.shoot(projectiles, sfx, particles, now);
      }
    }
  }

  shoot(projectiles, sfx, particles, now) {
    this.lastShootTime = now;

    // Calcular origen y dirección de la bala
    let originX = this.facing === 'right' ? this.x + this.width + 2 : this.x - 2;
    let originY = this.y + (this.crouching ? 22 : 14);

    let dirX = this.facing === 'right' ? 1 : -1;
    let dirY = 0;

    if (this.aimUp) {
      if (this.vx !== 0) {
        // Diagonal Arriba
        dirY = -0.8;
        dirX *= 0.8;
        originY -= 8;
      } else {
        // Completamente hacia arriba
        dirX = 0;
        dirY = -1;
        originX = this.x + this.width / 2;
        originY = this.y - 4;
      }
    }

    // Sonidos según personaje y arma
    if (this.weapon === WEAPON.LASER) {
      sfx.laserShoot();
    } else if (this.weapon === WEAPON.MISSILE) {
      sfx.p2Shoot();
    } else {
      if (this.id === 1) sfx.p1Shoot();
      else sfx.p2Shoot();
    }

    particles.spawnMuzzleFlash(originX, originY, this.weapon.color);

    if (this.weapon === WEAPON.SPREAD) {
      // Disparo triple en abanico
      [-0.25, 0, 0.25].forEach(angleOffset => {
        const speed = this.weapon.speed;
        let vx, vy;
        if (dirX === 0) {
          vx = angleOffset * speed * 2;
          vy = dirY * speed;
        } else {
          vx = dirX * speed;
          vy = dirY * speed + angleOffset * speed * 1.5;
        }
        projectiles.push(new Projectile(originX, originY, vx, vy, this.weapon.damage, this.id, this.weapon.color));
      });
    } else if (this.weapon === WEAPON.LASER) {
      projectiles.push(new Projectile(originX, originY, dirX * this.weapon.speed, dirY * this.weapon.speed, this.weapon.damage, this.id, this.weapon.color, true));
    } else if (this.weapon === WEAPON.MISSILE) {
      projectiles.push(new Projectile(originX, originY, dirX * this.weapon.speed, dirY * this.weapon.speed, this.weapon.damage, this.id, this.weapon.color, false, true));
    } else {
      // Blaster normal
      projectiles.push(new Projectile(originX, originY, dirX * this.weapon.speed, dirY * this.weapon.speed, this.weapon.damage, this.id, this.weapon.color));
    }
  }

  handleHorizontalCollision(level) {
    const leftTile = Math.floor(this.x / TILE_SIZE);
    const rightTile = Math.floor((this.x + this.width) / TILE_SIZE);
    const topTile = Math.floor(this.y / TILE_SIZE);
    const bottomTile = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    for (let r = topTile; r <= bottomTile; r++) {
      for (let c = leftTile; c <= rightTile; c++) {
        const tile = level.getTile(c, r);
        if (tile === TILE.SOLID || tile === TILE.CRATE) {
          if (this.vx > 0) {
            this.x = c * TILE_SIZE - this.width;
            this.vx = 0;
          } else if (this.vx < 0) {
            this.x = (c + 1) * TILE_SIZE;
            this.vx = 0;
          }
        }
      }
    }
  }

  handleVerticalCollision(level, pressingDown, sfx, particles) {
    this.onGround = false;
    const leftTile = Math.floor(this.x / TILE_SIZE);
    const rightTile = Math.floor((this.x + this.width - 1) / TILE_SIZE);
    const topTile = Math.floor(this.y / TILE_SIZE);
    const bottomTile = Math.floor((this.y + this.height) / TILE_SIZE);

    for (let r = topTile; r <= bottomTile; r++) {
      for (let c = leftTile; c <= rightTile; c++) {
        const tile = level.getTile(c, r);
        const tileTopY = r * TILE_SIZE;

        if (tile === TILE.SOLID || tile === TILE.CRATE) {
          if (this.vy > 0 && this.y + this.height - this.vy <= tileTopY + 8) {
            this.y = tileTopY - this.height;
            this.vy = 0;
            this.onGround = true;
          } else if (this.vy < 0) {
            this.y = (r + 1) * TILE_SIZE;
            this.vy = 0;
          }
        } else if (tile === TILE.PLATFORM) {
          // Plataforma unidireccional: solo choca si cae desde arriba y no pulsa abajo
          if (this.vy >= 0 && !pressingDown) {
            const prevFootY = (this.y + this.height) - this.vy;
            if (prevFootY <= tileTopY + 6 && this.y + this.height >= tileTopY) {
              this.y = tileTopY - this.height;
              this.vy = 0;
              this.onGround = true;
            }
          }
        } else if (tile === TILE.HAZARD) {
          this.takeDamage(1, sfx, particles);
        }
      }
    }
  }

  draw(ctx, camX, camY) {
    if (this.isDead) return;

    // Efecto de parpadeo si es invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
      return;
    }

    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY);

    ctx.save();

    // 1. Sombra bajo el personaje
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Piernas / Botas
    const legOffset = Math.sin(this.walkCycle) * 4;
    ctx.fillStyle = '#1b2234';
    if (this.facing === 'right') {
      ctx.fillRect(sx + 4 + legOffset, sy + this.height - 12, 6, 12);
      ctx.fillRect(sx + 14 - legOffset, sy + this.height - 12, 6, 12);
    } else {
      ctx.fillRect(sx + 4 - legOffset, sy + this.height - 12, 6, 12);
      ctx.fillRect(sx + 14 + legOffset, sy + this.height - 12, 6, 12);
    }

    // 3. Torso / Armadura Cibernética
    ctx.fillStyle = this.theme.primary;
    ctx.fillRect(sx + 3, sy + 10, 18, 16);

    // Detalles de armadura
    ctx.fillStyle = this.theme.secondary;
    ctx.fillRect(sx + 6, sy + 12, 12, 10);

    // 4. Casco con Visor Neón
    ctx.fillStyle = '#111726';
    ctx.fillRect(sx + 4, sy, 16, 11);
    ctx.fillStyle = this.theme.glow;
    ctx.shadowColor = this.theme.glow;
    ctx.shadowBlur = 6;
    if (this.facing === 'right') {
      ctx.fillRect(sx + 11, sy + 3, 8, 4);
    } else {
      ctx.fillRect(sx + 5, sy + 3, 8, 4);
    }
    ctx.shadowBlur = 0;

    // 5. Rifle / Cañón de plasma
    ctx.fillStyle = '#374151';
    let gunX = sx + (this.facing === 'right' ? 14 : -4);
    let gunY = sy + (this.crouching ? 20 : 13);
    let gunW = 14;
    let gunH = 6;

    if (this.aimUp) {
      gunX = sx + (this.facing === 'right' ? 12 : 6);
      gunY = sy - 4;
      gunW = 6;
      gunH = 14;
    }

    ctx.fillRect(gunX, gunY, gunW, gunH);
    ctx.fillStyle = this.weapon.color;
    ctx.fillRect(gunX + (this.facing === 'right' ? gunW - 3 : 0), gunY + 1, 3, gunH - 2);

    // Etiqueta P1 / P2 sobre la cabeza
    ctx.fillStyle = this.theme.primary;
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText(`P${this.id}`, sx + 4, sy - 6);

    ctx.restore();
  }
}

// ============================================================
// CLASES DE MONSTRUOS (ENEMIGOS)
// ============================================================
class Monster {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'crawler', 'drone', 'spitter', 'brute', 'boss'
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.hitTimer = 0;
    this.attackTimer = 0;
    this.onGround = false;

    this.initStats();
  }

  initStats() {
    switch (this.type) {
      case 'crawler':
        this.width = 24;
        this.height = 18;
        this.hp = 3;
        this.maxHp = 3;
        this.scoreVal = 100;
        this.speed = 1.6;
        this.vx = Math.random() > 0.5 ? this.speed : -this.speed;
        this.color = '#39ff14';
        break;
      case 'drone':
        this.width = 26;
        this.height = 24;
        this.hp = 4;
        this.maxHp = 4;
        this.scoreVal = 200;
        this.baseY = this.y;
        this.angle = Math.random() * Math.PI;
        this.color = '#ff3366';
        break;
      case 'spitter':
        this.width = 28;
        this.height = 32;
        this.hp = 6;
        this.maxHp = 6;
        this.scoreVal = 300;
        this.color = '#aa00ff';
        break;
      case 'brute':
        this.width = 36;
        this.height = 42;
        this.hp = 14;
        this.maxHp = 14;
        this.scoreVal = 600;
        this.speed = 1.2;
        this.vx = -this.speed;
        this.color = '#ffaa00';
        break;
      case 'boss':
        this.width = 80;
        this.height = 70;
        this.hp = 90;
        this.maxHp = 90;
        this.scoreVal = 5000;
        this.speed = 2.0;
        this.vx = -this.speed;
        this.phase = 1;
        this.color = '#ff0055';
        break;
    }
  }

  takeDamage(amount, sfx, particles, pId) {
    this.hp -= amount;
    this.hitTimer = 6;
    sfx.hit();
    particles.spawnBloodOrSparks(this.x + this.width / 2, this.y + this.height / 2, this.color, 5);

    if (this.hp <= 0) {
      this.dead = true;
      sfx.enemyDeath();
      particles.spawnExplosion(this.x + this.width / 2, this.y + this.height / 2, this.color, this.type === 'boss' ? 40 : 16);
      return true; // Asesinado
    }
    return false;
  }

  update(level, players, projectiles, particles, sfx) {
    if (this.dead) return;
    if (this.hitTimer > 0) this.hitTimer--;

    // Distancia al jugador más cercano
    const nearestPlayer = this.getNearestPlayer(players);

    switch (this.type) {
      case 'crawler':
        this.updateCrawler(level, nearestPlayer);
        break;
      case 'drone':
        this.updateDrone(nearestPlayer, projectiles, sfx);
        break;
      case 'spitter':
        this.updateSpitter(level, nearestPlayer, projectiles, sfx);
        break;
      case 'brute':
        this.updateBrute(level, nearestPlayer);
        break;
      case 'boss':
        this.updateBoss(level, nearestPlayer, projectiles, sfx, particles);
        break;
    }
  }

  getNearestPlayer(players) {
    let nearest = null;
    let minDist = 999999;
    players.forEach(p => {
      if (!p.isDead) {
        const d = Math.hypot((p.x + p.width / 2) - (this.x + this.width / 2), (p.y + p.height / 2) - (this.y + this.height / 2));
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      }
    });
    return nearest;
  }

  updateCrawler(level, nearestPlayer) {
    this.vy += GRAVITY;
    this.x += this.vx;

    // Cambiar de dirección si choca o si está al borde del precipicio
    const nextX = this.vx > 0 ? this.x + this.width + 4 : this.x - 4;
    const tileAhead = level.getTileAtPixel(nextX, this.y + this.height / 2);
    const tileBelowAhead = level.getTileAtPixel(nextX, this.y + this.height + 4);

    if (tileAhead === TILE.SOLID || tileBelowAhead === TILE.EMPTY) {
      this.vx = -this.vx;
    }

    this.y += this.vy;
    this.handleGroundCollision(level);

    // Pequeño salto si el jugador está muy cerca
    if (nearestPlayer && Math.hypot(nearestPlayer.x - this.x, nearestPlayer.y - this.y) < 100 && this.onGround) {
      if (Math.random() < 0.03) {
        this.vy = -7;
      }
    }
  }

  updateDrone(nearestPlayer, projectiles, sfx) {
    this.angle += 0.04;
    this.y = this.baseY + Math.sin(this.angle) * 35;

    if (nearestPlayer) {
      const dx = nearestPlayer.x - this.x;
      this.vx = Math.sign(dx) * 1.2;
      this.x += this.vx;

      // Disparar proyectil hacia abajo o hacia el jugador
      this.attackTimer++;
      if (this.attackTimer > 150) {
        this.attackTimer = 0;
        const angle = Math.atan2(nearestPlayer.y - this.y, nearestPlayer.x - this.x);
        projectiles.push(new Projectile(
          this.x + this.width / 2, this.y + this.height,
          Math.cos(angle) * 4.5, Math.sin(angle) * 4.5,
          1, 'enemy', '#ff0055'
        ));
        sfx.hit();
      }
    }
  }

  updateSpitter(level, nearestPlayer, projectiles, sfx) {
    this.vy += GRAVITY;
    this.y += this.vy;
    this.handleGroundCollision(level);

    this.attackTimer++;
    if (this.attackTimer > 140 && nearestPlayer) {
      this.attackTimer = 0;
      // Disparo en parábola
      const dirX = nearestPlayer.x > this.x ? 1 : -1;
      projectiles.push(new Projectile(
        this.x + this.width / 2, this.y - 2,
        dirX * (Math.random() * 2 + 3.5), -7,
        1, 'enemy', '#39ff14'
      ));
      sfx.hit();
    }
  }

  updateBrute(level, nearestPlayer) {
    this.vy += GRAVITY;
    this.y += this.vy;
    this.handleGroundCollision(level);

    let currentSpeed = this.speed;
    if (nearestPlayer && Math.abs(nearestPlayer.y - this.y) < 60) {
      currentSpeed = 3.2; // Carga furiosa si está en la misma altura
      this.vx = Math.sign(nearestPlayer.x - this.x) * currentSpeed;
    }

    this.x += this.vx;
    const tileAhead = level.getTileAtPixel(this.vx > 0 ? this.x + this.width + 2 : this.x - 2, this.y + 10);
    if (tileAhead === TILE.SOLID) {
      this.vx = -this.vx;
    }
  }

  updateBoss(level, nearestPlayer, projectiles, sfx, particles) {
    this.vy += GRAVITY;
    this.y += this.vy;
    this.handleGroundCollision(level);

    // Movimiento de lado a lado en la arena
    this.x += this.vx;
    const tileAhead = level.getTileAtPixel(this.vx > 0 ? this.x + this.width + 4 : this.x - 4, this.y + 20);
    if (tileAhead === TILE.SOLID || this.x < 100 || this.x > level.widthPixels - 150) {
      this.vx = -this.vx;
    }

    // Fases según vida
    if (this.hp < this.maxHp * 0.4) {
      this.phase = 3;
    } else if (this.hp < this.maxHp * 0.7) {
      this.phase = 2;
    }

    this.attackTimer++;

    // Ataque 1: Salva de orbes de plasma
    if (this.attackTimer % 90 === 0) {
      for (let i = -2; i <= 2; i++) {
        projectiles.push(new Projectile(
          this.x + this.width / 2, this.y + 30,
          i * 2.2, 5, 1, 'enemy', '#ff0055'
        ));
      }
      sfx.laserShoot();
    }

    // Ataque 2: Terremoto / Pisotón
    if (this.phase >= 2 && this.attackTimer % 200 === 0 && this.onGround) {
      this.vy = -8;
      sfx.bossRoar();
      particles.triggerShake(12, 20);
    }
  }

  handleGroundCollision(level) {
    this.onGround = false;
    const leftTile = Math.floor(this.x / TILE_SIZE);
    const rightTile = Math.floor((this.x + this.width) / TILE_SIZE);
    const bottomTile = Math.floor((this.y + this.height) / TILE_SIZE);

    for (let c = leftTile; c <= rightTile; c++) {
      const tile = level.getTile(c, bottomTile);
      if (tile === TILE.SOLID || tile === TILE.PLATFORM) {
        this.y = bottomTile * TILE_SIZE - this.height;
        this.vy = 0;
        this.onGround = true;
        break;
      }
    }
  }

  draw(ctx, camX, camY) {
    if (this.dead) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY);

    ctx.save();
    if (this.hitTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.restore();
      return;
    }

    if (this.type === 'crawler') {
      // Araña cibernética / bicho
      ctx.fillStyle = this.color;
      ctx.fillRect(sx + 3, sy + 3, this.width - 6, this.height - 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 6, sy + 5, 4, 4);
      ctx.fillRect(sx + 14, sy + 5, 4, 4);
      ctx.fillStyle = '#111';
      ctx.fillRect(sx, sy + this.height - 4, 5, 4);
      ctx.fillRect(sx + this.width - 5, sy + this.height - 4, 5, 4);
    } else if (this.type === 'drone') {
      // Ojo flotante
      ctx.fillStyle = '#22293a';
      ctx.beginPath();
      ctx.arc(sx + this.width / 2, sy + this.height / 2, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(sx + this.width / 2, sy + this.height / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + this.width / 2 - 2, sy + this.height / 2 - 2, 4, 4);
    } else if (this.type === 'spitter') {
      // Torpedo alienígena / planta tóxica
      ctx.fillStyle = this.color;
      ctx.fillRect(sx + 4, sy + 8, this.width - 8, this.height - 8);
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(sx + 8, sy, 12, 10);
    } else if (this.type === 'brute') {
      // Mecha-bruto armado
      ctx.fillStyle = '#2b3548';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle = this.color;
      ctx.fillRect(sx + 6, sy + 6, this.width - 12, 12);
      ctx.fillStyle = '#ff2200';
      ctx.fillRect(sx + 10, sy + 10, 6, 4);
    } else if (this.type === 'boss') {
      // Jefe Titán Cyber-Gorgon
      ctx.fillStyle = '#171c2b';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, this.width, this.height);

      // Ojos del jefe y reactor central
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(sx + 15, sy + 18, 12, 8);
      ctx.fillRect(sx + this.width - 27, sy + 18, 12, 8);
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(sx + this.width / 2, sy + 44, 14, 0, Math.PI * 2);
      ctx.fill();

      // Cuernos cibernéticos
      ctx.fillStyle = '#44516c';
      ctx.fillRect(sx - 8, sy - 14, 12, 20);
      ctx.fillRect(sx + this.width - 4, sy - 14, 12, 20);
    }

    // Mini barra de vida sobre el enemigo si ha recibido daño
    if (this.hp < this.maxHp && this.type !== 'boss') {
      const barW = this.width;
      const fillW = Math.max(0, (this.hp / this.maxHp) * barW);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx, sy - 8, barW, 4);
      ctx.fillStyle = '#ff3366';
      ctx.fillRect(sx, sy - 8, fillW, 4);
    }

    ctx.restore();
  }
}

// ============================================================
// POWER-UPS Y CAJAS DE SUMINISTROS
// ============================================================
class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'spread', 'laser', 'missile', 'health'
    this.width = 20;
    this.height = 20;
    this.dead = false;
    this.bob = 0;
  }

  update() {
    this.bob += 0.08;
  }

  draw(ctx, camX, camY) {
    if (this.dead) return;
    const sx = Math.round(this.x - camX);
    const sy = Math.round(this.y - camY + Math.sin(this.bob) * 4);

    ctx.save();
    ctx.shadowBlur = 8;

    let color = '#fff';
    let label = '?';

    switch (this.type) {
      case 'spread':
        color = '#39ff14';
        label = 'S';
        break;
      case 'laser':
        color = '#ff00ff';
        label = 'L';
        break;
      case 'missile':
        color = '#ff9100';
        label = 'M';
        break;
      case 'health':
        color = '#00ffcc';
        label = '+';
        break;
    }

    ctx.fillStyle = '#101424';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, this.width, this.height);
    ctx.strokeRect(sx, sy, this.width, this.height);

    ctx.fillStyle = color;
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(label, sx + 5, sy + 15);

    ctx.restore();
  }
}

// ============================================================
// GENERADOR Y GESTOR DE NIVELES (LEVEL)
// ============================================================
class Level {
  constructor(zoneIndex = 1, isSurvival = false) {
    this.zoneIndex = zoneIndex;
    this.isSurvival = isSurvival;
    this.cols = isSurvival ? 45 : (zoneIndex === 3 ? 40 : 80);
    this.rows = 15;
    this.widthPixels = this.cols * TILE_SIZE;
    this.heightPixels = this.rows * TILE_SIZE;

    this.grid = [];
    this.crates = [];
    this.monsters = [];
    this.pickups = [];

    this.buildMap();
  }

  buildMap() {
    // Inicializar mapa vacío
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = TILE.EMPTY;
      }
    }

    // Suelo inferior sólido
    for (let c = 0; c < this.cols; c++) {
      this.grid[this.rows - 1][c] = TILE.SOLID;
      this.grid[this.rows - 2][c] = TILE.SOLID;
    }

    // Paredes en los extremos izquierdo y derecho
    for (let r = 0; r < this.rows; r++) {
      this.grid[r][0] = TILE.SOLID;
      this.grid[r][this.cols - 1] = TILE.SOLID;
    }

    if (this.isSurvival) {
      this.buildSurvivalArena();
    } else if (this.zoneIndex === 1) {
      this.buildZone1();
    } else if (this.zoneIndex === 2) {
      this.buildZone2();
    } else if (this.zoneIndex === 3) {
      this.buildZone3Boss();
    }
  }

  buildZone1() {
    // Nivel 1: Plataformas flotantes, pozos moderados, orbes y cajas
    // Plataformas elevadas
    const platformDefs = [
      { c: 6, r: 9, len: 5, type: TILE.PLATFORM },
      { c: 14, r: 8, len: 6, type: TILE.PLATFORM },
      { c: 22, r: 10, len: 4, type: TILE.SOLID },
      { c: 29, r: 7, len: 7, type: TILE.PLATFORM },
      { c: 39, r: 9, len: 5, type: TILE.SOLID },
      { c: 46, r: 7, len: 6, type: TILE.PLATFORM },
      { c: 54, r: 10, len: 5, type: TILE.PLATFORM },
      { c: 62, r: 8, len: 8, type: TILE.SOLID }
    ];

    platformDefs.forEach(p => {
      for (let i = 0; i < p.len; i++) {
        this.grid[p.r][p.c + i] = p.type;
      }
    });

    // Cajas de suministros
    [
      { c: 8, r: 8 }, { c: 31, r: 6 }, { c: 48, r: 6 }, { c: 65, r: 7 }
    ].forEach(pos => {
      this.grid[pos.r][pos.c] = TILE.CRATE;
    });

    // Compuerta de salida al final
    this.grid[this.rows - 3][this.cols - 3] = TILE.EXIT_GATE;

    // Monstruos
    this.monsters.push(new Monster(350, 200, 'crawler'));
    this.monsters.push(new Monster(550, 150, 'drone'));
    this.monsters.push(new Monster(800, 300, 'crawler'));
    this.monsters.push(new Monster(1100, 160, 'drone'));
    this.monsters.push(new Monster(1350, 200, 'spitter'));
    this.monsters.push(new Monster(1600, 280, 'crawler'));
    this.monsters.push(new Monster(1850, 150, 'drone'));
    this.monsters.push(new Monster(2100, 280, 'brute'));
  }

  buildZone2() {
    // Nivel 2: Fosos de ácido y monstruos pesados
    // Fosos de ácido en el suelo
    for (let c = 18; c <= 23; c++) {
      this.grid[this.rows - 2][c] = TILE.HAZARD;
    }
    for (let c = 40; c <= 46; c++) {
      this.grid[this.rows - 2][c] = TILE.HAZARD;
    }

    const platformDefs = [
      { c: 6, r: 10, len: 5, type: TILE.PLATFORM },
      { c: 13, r: 8, len: 4, type: TILE.SOLID },
      { c: 18, r: 7, len: 6, type: TILE.PLATFORM }, // Puente sobre ácido
      { c: 26, r: 9, len: 5, type: TILE.PLATFORM },
      { c: 33, r: 7, len: 5, type: TILE.SOLID },
      { c: 40, r: 8, len: 7, type: TILE.PLATFORM }, // Puente sobre segundo ácido
      { c: 50, r: 10, len: 5, type: TILE.PLATFORM },
      { c: 58, r: 7, len: 8, type: TILE.SOLID },
      { c: 68, r: 9, len: 6, type: TILE.PLATFORM }
    ];

    platformDefs.forEach(p => {
      for (let i = 0; i < p.len; i++) {
        this.grid[p.r][p.c + i] = p.type;
      }
    });

    [
      { c: 14, r: 7 }, { c: 35, r: 6 }, { c: 60, r: 6 }
    ].forEach(pos => {
      this.grid[pos.r][pos.c] = TILE.CRATE;
    });

    this.grid[this.rows - 3][this.cols - 3] = TILE.EXIT_GATE;

    this.monsters.push(new Monster(320, 280, 'crawler'));
    this.monsters.push(new Monster(500, 120, 'drone'));
    this.monsters.push(new Monster(700, 280, 'spitter'));
    this.monsters.push(new Monster(1000, 140, 'drone'));
    this.monsters.push(new Monster(1200, 280, 'brute'));
    this.monsters.push(new Monster(1500, 160, 'spitter'));
    this.monsters.push(new Monster(1800, 280, 'brute'));
  }

  buildZone3Boss() {
    // Nivel 3: Gran Arena de Combate con el Jefe Titán
    const platformDefs = [
      { c: 5, r: 9, len: 6, type: TILE.PLATFORM },
      { c: 15, r: 7, len: 8, type: TILE.PLATFORM },
      { c: 27, r: 9, len: 6, type: TILE.PLATFORM }
    ];

    platformDefs.forEach(p => {
      for (let i = 0; i < p.len; i++) {
        this.grid[p.r][p.c + i] = p.type;
      }
    });

    // Cajas con armas avanzadas
    this.grid[8][6] = TILE.CRATE;
    this.grid[6][18] = TILE.CRATE;
    this.grid[8][29] = TILE.CRATE;

    // Gran Jefe al fondo de la arena
    this.monsters.push(new Monster(800, 200, 'boss'));
  }

  buildSurvivalArena() {
    // Arena de supervivencia cerrada con múltiples pisos
    const platformDefs = [
      { c: 4, r: 10, len: 8, type: TILE.PLATFORM },
      { c: 16, r: 8, len: 12, type: TILE.PLATFORM },
      { c: 32, r: 10, len: 8, type: TILE.PLATFORM },
      { c: 10, r: 5, len: 7, type: TILE.PLATFORM },
      { c: 26, r: 5, len: 7, type: TILE.PLATFORM }
    ];

    platformDefs.forEach(p => {
      for (let i = 0; i < p.len; i++) {
        this.grid[p.r][p.c + i] = p.type;
      }
    });

    this.grid[9][6] = TILE.CRATE;
    this.grid[7][21] = TILE.CRATE;
    this.grid[9][35] = TILE.CRATE;
  }

  destroyCrate(pixelX, pixelY) {
    const col = Math.floor(pixelX / TILE_SIZE);
    const row = Math.floor(pixelY / TILE_SIZE);
    if (this.grid[row] && this.grid[row][col] === TILE.CRATE) {
      this.grid[row][col] = TILE.EMPTY;

      // Soltar power-up al azar
      const rand = Math.random();
      let type = 'spread';
      if (rand < 0.3) type = 'spread';
      else if (rand < 0.55) type = 'laser';
      else if (rand < 0.75) type = 'missile';
      else type = 'health';

      this.pickups.push(new Pickup(col * TILE_SIZE + 6, row * TILE_SIZE + 6, type));
    }
  }

  getTile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return TILE.SOLID;
    }
    return this.grid[row][col];
  }

  getTileAtPixel(x, y) {
    return this.getTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  }

  draw(ctx, camX, camY) {
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((camX + CANVAS_WIDTH) / TILE_SIZE));

    for (let r = 0; r < this.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.grid[r][c];
        if (tile === TILE.EMPTY) continue;

        const sx = c * TILE_SIZE - camX;
        const sy = r * TILE_SIZE - camY;

        if (tile === TILE.SOLID) {
          // Bloque tech sólido
          ctx.fillStyle = '#1c2438';
          ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#2d3b5e';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);

          // Detalles de remaches y luces de circuito
          ctx.fillStyle = '#00d2ff';
          ctx.fillRect(sx + 3, sy + 3, 2, 2);
          ctx.fillRect(sx + TILE_SIZE - 5, sy + 3, 2, 2);
        } else if (tile === TILE.PLATFORM) {
          // Rejilla / plataforma flotante permeable
          ctx.fillStyle = '#0e1728';
          ctx.fillRect(sx, sy, TILE_SIZE, 8);
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(sx, sy, TILE_SIZE, 2);
          // Luces guía
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(sx + 6, sy + 3, 3, 3);
          ctx.fillRect(sx + 22, sy + 3, 3, 3);
        } else if (tile === TILE.HAZARD) {
          // Ácido burbujeante
          ctx.fillStyle = '#39ff14';
          ctx.fillRect(sx, sy + 4, TILE_SIZE, TILE_SIZE - 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx + 6, sy + 6, 4, 3);
          ctx.fillRect(sx + 18, sy + 8, 3, 3);
        } else if (tile === TILE.CRATE) {
          // Caja de suministros con símbolo
          ctx.fillStyle = '#3b2816';
          ctx.fillRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#ff9100';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = '#ffaa00';
          ctx.font = '10px "Press Start 2P"';
          ctx.fillText('?', sx + 10, sy + 22);
        } else if (tile === TILE.EXIT_GATE) {
          // Compuerta de fin de fase
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(sx + 4, sy - 16, TILE_SIZE - 8, TILE_SIZE + 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = '8px "Press Start 2P"';
          ctx.fillText('FIN', sx + 5, sy + 10);
        }
      }
    }

    // Dibujar power-ups
    this.pickups.forEach(p => p.draw(ctx, camX, camY));
  }
}

// ============================================================
// MOTOR PRINCIPAL DEL JUEGO (GAME ENGINE)
// ============================================================
class Game {
  constructor() {
    window.gameInstance = this;

    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.sfx = new SoundFX();
    this.input = new InputManager();
    this.particles = new ParticleSystem();

    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER', 'VICTORY'
    this.gameMode = 'campaign'; // 'campaign' o 'survival'
    this.currentZone = 1;
    this.teamScore = 0;
    this.survivalWave = 1;
    this.waveSpawnTimer = 0;

    // Jugadores
    this.p1 = new Player(1, 100, 300, 'CYBER', { primary: '#00e5ff', secondary: '#0077ff', glow: '#00ffff' });
    this.p2 = new Player(2, 140, 300, 'VULCAN', { primary: '#ffaa00', secondary: '#ff2a55', glow: '#ffcc00' });
    this.players = [this.p1, this.p2];

    this.projectiles = [];
    this.camera = { x: 0, y: 0 };

    this.initUI();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initUI() {
    // Botones de Modo
    const campaignBtn = document.getElementById('mode-campaign-btn');
    const survivalBtn = document.getElementById('mode-survival-btn');

    campaignBtn?.addEventListener('click', () => {
      this.gameMode = 'campaign';
      campaignBtn.classList.add('active');
      survivalBtn.classList.remove('active');
    });

    survivalBtn?.addEventListener('click', () => {
      this.gameMode = 'survival';
      survivalBtn.classList.add('active');
      campaignBtn.classList.remove('active');
    });

    // Iniciar Partida
    document.getElementById('start-game-btn')?.addEventListener('click', () => {
      this.sfx.init();
      this.sfx.startBGM();
      this.startGame();
    });

    // Pausa y Reanudar
    document.getElementById('pause-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('resume-btn')?.addEventListener('click', () => this.togglePause());
    document.getElementById('restart-pause-btn')?.addEventListener('click', () => this.startGame());

    // Reintentar y Jugar de nuevo
    document.getElementById('retry-btn')?.addEventListener('click', () => this.startGame());
    document.getElementById('vic-replay-btn')?.addEventListener('click', () => this.startGame());

    // Botón de Sonido
    const soundBtn = document.getElementById('sound-btn');
    soundBtn?.addEventListener('click', () => {
      const active = this.sfx.toggle();
      soundBtn.textContent = active ? '🔊' : '🔇';
    });

    // Tecla P para Pausa
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
          this.togglePause();
        }
      }
    });
  }

  startGame() {
    this.state = 'PLAYING';
    this.teamScore = 0;
    this.currentZone = 1;
    this.survivalWave = 1;
    this.waveSpawnTimer = 0;

    this.p1.reset();
    this.p2.reset();
    this.projectiles = [];

    this.loadLevel();

    document.getElementById('menu-overlay')?.classList.add('hidden');
    document.getElementById('pause-overlay')?.classList.add('hidden');
    document.getElementById('gameover-overlay')?.classList.add('hidden');
    document.getElementById('victory-overlay')?.classList.add('hidden');
  }

  loadLevel() {
    this.level = new Level(this.currentZone, this.gameMode === 'survival');
    this.projectiles = [];

    // Posición inicial de jugadores
    this.p1.x = 80;
    this.p1.y = 320;
    this.p2.x = 120;
    this.p2.y = 320;
    this.p1.vx = 0;
    this.p1.vy = 0;
    this.p2.vx = 0;
    this.p2.vy = 0;

    // Actualizar badges
    const stageEl = document.getElementById('stage-display');
    if (stageEl) {
      stageEl.textContent = this.gameMode === 'survival' ? `OLEADA ${this.survivalWave}` : `ZONA ${this.currentZone}`;
    }

    // Comprobar si hay un Boss activo para mostrar su barra
    const bossHud = document.getElementById('boss-hud');
    if (bossHud) {
      if (this.currentZone === 3 && this.gameMode === 'campaign') {
        bossHud.classList.remove('hidden');
      } else {
        bossHud.classList.add('hidden');
      }
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('pause-overlay')?.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('pause-overlay')?.classList.add('hidden');
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.sfx.gameOver();
    document.getElementById('gameover-overlay')?.classList.remove('hidden');

    document.getElementById('go-p1-kills').textContent = this.p1.kills;
    document.getElementById('go-p1-score').textContent = this.p1.score;
    document.getElementById('go-p2-kills').textContent = this.p2.kills;
    document.getElementById('go-p2-score').textContent = this.p2.score;
    document.getElementById('go-team-score').textContent = this.teamScore;
  }

  victory() {
    this.state = 'VICTORY';
    this.sfx.victory();
    document.getElementById('victory-overlay')?.classList.remove('hidden');

    document.getElementById('vic-p1-kills').textContent = this.p1.kills;
    document.getElementById('vic-p1-score').textContent = this.p1.score;
    document.getElementById('vic-p2-kills').textContent = this.p2.kills;
    document.getElementById('vic-p2-score').textContent = this.p2.score;
    document.getElementById('vic-team-score').textContent = this.teamScore;
  }

  loop(timestamp) {
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (this.state === 'PLAYING') {
      this.update(timestamp);
    }
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  update(now) {
    // 1. Actualizar Jugadores
    this.p1.update(this.input.p1, this.level, this.projectiles, this.sfx, this.particles, now);
    this.p2.update(this.input.p2, this.level, this.projectiles, this.sfx, this.particles, now);

    // Sistema de Resurrección Cooperativa:
    // Si uno muere pero el otro sigue vivo, cuando el temporizador llega a 0 reaparece cerca del compañero
    if (this.p1.isDead && !this.p2.isDead && this.p1.respawnTimer <= 0) {
      this.p1.respawnNear(this.p2);
      this.particles.spawnText(this.p1.x, this.p1.y, '¡P1 REVIVIDO!', '#00e5ff');
    }
    if (this.p2.isDead && !this.p1.isDead && this.p2.respawnTimer <= 0) {
      this.p2.respawnNear(this.p1);
      this.particles.spawnText(this.p2.x, this.p2.y, '¡P2 REVIVIDO!', '#ffaa00');
    }

    // Si ambos están muertos, es Game Over
    if (this.p1.isDead && this.p2.isDead) {
      this.gameOver();
      return;
    }

    // 2. Comprobar avance de nivel por Compuerta de Salida
    if (this.gameMode === 'campaign') {
      [this.p1, this.p2].forEach(p => {
        if (!p.isDead) {
          const tile = this.level.getTileAtPixel(p.x + p.width / 2, p.y + p.height / 2);
          if (tile === TILE.EXIT_GATE) {
            this.currentZone++;
            if (this.currentZone > 3) {
              this.victory();
            } else {
              this.sfx.powerup();
              this.loadLevel();
            }
          }
        }
      });
    }

    // 3. Generación continua de oleadas en Modo Supervivencia
    if (this.gameMode === 'survival') {
      this.waveSpawnTimer++;
      if (this.level.monsters.length === 0 || this.waveSpawnTimer > 600) {
        this.waveSpawnTimer = 0;
        this.survivalWave++;
        const stageEl = document.getElementById('stage-display');
        if (stageEl) stageEl.textContent = `OLEADA ${this.survivalWave}`;
        this.particles.spawnText(CANVAS_WIDTH / 2 + this.camera.x, 100, `¡OLEADA ${this.survivalWave}!`, '#ffd700');

        // Spawning de enemigos por ambos flancos
        const spawnCount = Math.min(12, 3 + this.survivalWave * 2);
        for (let i = 0; i < spawnCount; i++) {
          const spawnX = Math.random() > 0.5 ? 60 : this.level.widthPixels - 80;
          const types = ['crawler', 'drone', 'spitter', 'brute'];
          const type = types[Math.floor(Math.random() * types.length)];
          this.level.monsters.push(new Monster(spawnX, 100 + Math.random() * 200, type));
        }
      }
    }

    // 4. Actualizar Proyectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(this.level, this.particles, this.sfx);

      if (proj.dead) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Colisión de proyectiles con Jugadores (si es de un enemigo)
      if (proj.ownerId === 'enemy') {
        [this.p1, this.p2].forEach(p => {
          if (!p.isDead && this.checkCollision(proj, p)) {
            p.takeDamage(proj.damage, this.sfx, this.particles);
            proj.dead = true;
          }
        });
      } else {
        // Colisión de proyectiles de Jugador con Monstruos
        for (let m = this.level.monsters.length - 1; m >= 0; m--) {
          const monster = this.level.monsters[m];
          if (!monster.dead && this.checkCollision(proj, monster)) {
            const killed = monster.takeDamage(proj.damage, this.sfx, this.particles, proj.ownerId);

            if (killed) {
              const killer = proj.ownerId === 1 ? this.p1 : this.p2;
              killer.kills++;
              killer.score += monster.scoreVal;
              this.teamScore += monster.scoreVal;
              this.particles.spawnText(monster.x, monster.y, `+${monster.scoreVal}`, '#ffd700');

              // Si mató al Boss en campaña, victoria
              if (monster.type === 'boss') {
                setTimeout(() => this.victory(), 1200);
              }
            }

            if (!proj.isLaser) {
              proj.dead = true;
            }
            break;
          }
        }
      }

      if (proj.dead) {
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Actualizar Monstruos
    for (let i = this.level.monsters.length - 1; i >= 0; i--) {
      const monster = this.level.monsters[i];
      monster.update(this.level, this.players, this.projectiles, this.particles, this.sfx);

      // Colisión directa monstruo con jugadores
      [this.p1, this.p2].forEach(p => {
        if (!p.isDead && this.checkCollision(monster, p)) {
          p.takeDamage(1, this.sfx, this.particles);
        }
      });

      if (monster.dead) {
        this.level.monsters.splice(i, 1);
      }
    }

    // 6. Actualizar Power-ups y Recolección
    for (let i = this.level.pickups.length - 1; i >= 0; i--) {
      const p = this.level.pickups[i];
      p.update();

      [this.p1, this.p2].forEach(player => {
        if (!player.isDead && this.checkCollision(p, player)) {
          p.dead = true;
          this.sfx.powerup();

          if (p.type === 'health') {
            player.hp = Math.min(player.maxHp, player.hp + 2);
            this.particles.spawnText(player.x, player.y - 10, '+2 HP', '#00ffcc');
          } else if (p.type === 'spread') {
            player.setWeapon(WEAPON.SPREAD);
            this.particles.spawnText(player.x, player.y - 10, '¡TRIPLE DISPARO!', '#39ff14');
          } else if (p.type === 'laser') {
            player.setWeapon(WEAPON.LASER);
            this.particles.spawnText(player.x, player.y - 10, '¡LÁSER PENETRANTE!', '#ff00ff');
          } else if (p.type === 'missile') {
            player.setWeapon(WEAPON.MISSILE);
            this.particles.spawnText(player.x, player.y - 10, '¡MISIL PESADO!', '#ff9100');
          }
        }
      });

      if (p.dead) {
        this.level.pickups.splice(i, 1);
      }
    }

    // 7. Actualizar Partículas
    this.particles.update();

    // 8. Cámara Inteligente Cooperativa
    this.updateCamera();

    // 9. Actualizar HUD
    this.updateHUD();
  }

  updateCamera() {
    let targetX;
    // Si ambos están vivos, enfoca en el centro entre ambos
    if (!this.p1.isDead && !this.p2.isDead) {
      targetX = (this.p1.x + this.p2.x) / 2 - CANVAS_WIDTH / 2;

      // Mecánica para evitar que un jugador quede atrapado fuera de pantalla:
      // Si uno se aleja demasiado del borde, lo impulsa suavemente hacia el compañero
      const minX = Math.min(this.p1.x, this.p2.x);
      const maxX = Math.max(this.p1.x, this.p2.x);
      if (maxX - minX > CANVAS_WIDTH - 120) {
        if (this.p1.x < this.p2.x) {
          this.p1.x = this.p2.x - (CANVAS_WIDTH - 120);
        } else {
          this.p2.x = this.p1.x - (CANVAS_WIDTH - 120);
        }
      }
    } else if (!this.p1.isDead) {
      targetX = this.p1.x - CANVAS_WIDTH / 2;
    } else {
      targetX = this.p2.x - CANVAS_WIDTH / 2;
    }

    // Suavizado (lerp)
    this.camera.x += (targetX - this.camera.x) * 0.1;

    // Limitar dentro de los límites del nivel
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.level.widthPixels - CANVAS_WIDTH));
    this.camera.y = 0; // Cámara fija en vertical para plataformas de pantalla fija estilo arcade
  }

  checkCollision(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  updateHUD() {
    // P1
    const p1Hp = document.getElementById('p1-hp-fill');
    if (p1Hp) p1Hp.style.width = `${Math.max(0, (this.p1.hp / this.p1.maxHp) * 100)}%`;
    const p1Weapon = document.getElementById('p1-weapon-badge');
    if (p1Weapon) p1Weapon.textContent = this.p1.weapon.name;
    const p1Score = document.getElementById('p1-score');
    if (p1Score) p1Score.textContent = `${this.p1.score} pts`;

    // P2
    const p2Hp = document.getElementById('p2-hp-fill');
    if (p2Hp) p2Hp.style.width = `${Math.max(0, (this.p2.hp / this.p2.maxHp) * 100)}%`;
    const p2Weapon = document.getElementById('p2-weapon-badge');
    if (p2Weapon) p2Weapon.textContent = this.p2.weapon.name;
    const p2Score = document.getElementById('p2-score');
    if (p2Score) p2Score.textContent = `${this.p2.score} pts`;

    // Puntaje de Equipo
    const teamScoreEl = document.getElementById('team-score-val');
    if (teamScoreEl) {
      teamScoreEl.textContent = String(this.teamScore).padStart(6, '0');
    }

    // Barra de Jefe si está presente
    if (!this.level) return;
    const boss = this.level.monsters.find(m => m.type === 'boss');
    const bossHpBar = document.getElementById('boss-hp-fill');
    if (boss && bossHpBar) {
      bossHpBar.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    }
  }

  render() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Screen Shake Offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.particles.shakeDuration > 0) {
      shakeX = (Math.random() - 0.5) * this.particles.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.particles.shakeIntensity;
    }

    const camX = this.camera.x + shakeX;
    const camY = this.camera.y + shakeY;

    // 1. Fondo Cyberpunk Parallax
    this.renderBackground(camX);

    // Solo dibuja el juego si el nivel ya fue cargado
    if (!this.level) return;

    // 2. Mapa y Baldosas
    this.level.draw(this.ctx, camX, camY);

    // 3. Monstruos
    this.level.monsters.forEach(m => m.draw(this.ctx, camX, camY));

    // 4. Jugadores
    this.p1.draw(this.ctx, camX, camY);
    this.p2.draw(this.ctx, camX, camY);

    // 5. Proyectiles
    this.projectiles.forEach(p => p.draw(this.ctx, camX, camY));

    // 6. Partículas y Efectos
    this.particles.draw(this.ctx, camX, camY);
  }

  renderBackground(camX) {
    // Degradado de cielo nocturno espacial
    const grad = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, '#090b14');
    grad.addColorStop(0.7, '#131929');
    grad.addColorStop(1, '#06080d');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Estrellas y rejilla distante en parallax
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      const starX = ((i * 123) - camX * 0.1) % CANVAS_WIDTH;
      const starY = (i * 47) % (CANVAS_HEIGHT - 120);
      const actualX = starX < 0 ? starX + CANVAS_WIDTH : starX;
      this.ctx.fillRect(actualX, starY, 1.5, 1.5);
    }

    // Siluetas de rascacielos / fábrica cibernética lejana en parallax
    this.ctx.fillStyle = 'rgba(15, 22, 38, 0.65)';
    const buildingWidth = 70;
    const totalBuildings = Math.ceil(CANVAS_WIDTH / buildingWidth) + 3;
    const bOffset = (camX * 0.25) % buildingWidth;

    for (let b = 0; b < totalBuildings; b++) {
      const bx = b * buildingWidth - bOffset;
      const bHeight = 110 + ((b * 41) % 130);
      this.ctx.fillRect(bx, CANVAS_HEIGHT - bHeight - 64, buildingWidth - 6, bHeight);

      // Ventanas con brillo de neón
      this.ctx.fillStyle = (b % 2 === 0) ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255, 170, 0, 0.25)';
      for (let wy = CANVAS_HEIGHT - bHeight - 50; wy < CANVAS_HEIGHT - 80; wy += 20) {
        this.ctx.fillRect(bx + 12, wy, 8, 8);
        this.ctx.fillRect(bx + 34, wy, 8, 8);
      }
      this.ctx.fillStyle = 'rgba(15, 22, 38, 0.65)';
    }
  }
}

// Iniciar juego al cargar la página
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
