class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Could not get 2D context');
            return;
        }
        
        // Initialize game state
        this.score = 0;
        this.lives = 3;
        this.gameRunning = true;
        this.paused = false;
        this.level = 1;
        this.animationFrameId = null;
        this.ballStuck = true;
        this.inputState = { left: false, right: false };
        this.pointerState = { active: false, x: null };
        this.lastPowerUpSummary = null;
        this.powerUpTypes = null;

        this.ui = {
            score: document.getElementById('score'),
            lives: document.getElementById('lives'),
            level: document.getElementById('level'),
            ballStatus: document.getElementById('ballStatus'),
            powerUpList: document.getElementById('powerUpList'),
            pauseButton: document.getElementById('pauseBtn'),
            gameOver: document.getElementById('gameOver'),
            finalScore: document.getElementById('finalScore'),
            pauseOverlay: document.getElementById('pauseOverlay')
        };
        
        // Game objects
        const canvasWidth = Math.max(100, this.canvas.width);
        const canvasHeight = Math.max(100, this.canvas.height);
        this.paddle = {
            x: Math.max(0, Math.min(canvasWidth - 100, canvasWidth / 2 - 50)),
            y: Math.max(0, Math.min(canvasHeight - 15, canvasHeight - 30)),
            width: 100,
            height: 15,
            speed: 8,
            color: '#00ff88'
        };
        
        this.ball = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 50,
            radius: 8,
            dx: 4,
            dy: -4,
            color: '#ff6b6b',
            speed: 4
        };
        
        this.blocks = [];
        this.particles = [];
        this.powerUps = [];
        this.activePowerUps = {}; // Track active power-ups and their timers
        this.toiletPaperShots = []; // Toilet paper projectiles
        this.laserShots = []; // Laser projectiles
        this.balls = []; // Multiple balls for multi-ball power-up
        this.maxParticles = 200; // Limit particle count to prevent memory issues
        this.originalPaddleWidth = 100;
        this.lastToiletPaperShot = 0; // Track last shot frame to prevent multiple shots
        this.lastLaserShot = 0; // Track last shot frame to prevent multiple shots
        
        // Store event handlers for cleanup
        this.boundPointerMove = (e) => this.handlePointerMove(e);
        this.boundPointerDown = (e) => this.handlePointerDown(e);
        this.boundPointerUp = (e) => this.handlePointerUp(e);
        this.boundKeyDown = (e) => this.handleKeyDown(e);
        this.boundKeyUp = (e) => this.handleKeyUp(e);
        
        this.init();
        this.createParticles();
        this.gameLoop();
    }
    
    init() {
        this.createBlocks();
        this.bindEvents();
        // Initialize with single ball
        this.resetBall(true);
        this.balls = [this.ball];
    }
    
    createBlocks() {
        // Clear existing blocks first
        this.blocks = [];
        
        const rows = 6;
        const cols = 12;
        const blockWidth = 60;
        const blockHeight = 25;
        const padding = 5;
        const startX = 50;
        const startY = 50;
        
        // Ensure blocks fit within canvas
        const maxX = this.canvas.width - blockWidth;
        const maxY = this.canvas.height - blockHeight - 100; // Leave space for paddle
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * (blockWidth + padding) + startX;
                const y = row * (blockHeight + padding) + startY;
                
                // Only create block if it fits within canvas bounds
                if (x >= 0 && x <= maxX && y >= 0 && y <= maxY) {
                    const block = {
                        x: x,
                        y: y,
                        width: blockWidth,
                        height: blockHeight,
                        color: this.getBlockColor(row),
                        health: row < 2 ? 2 : 1,
                        maxHealth: row < 2 ? 2 : 1
                    };
                    this.blocks.push(block);
                }
            }
        }
    }
    
    getBlockColor(row) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        return colors[row % colors.length];
    }
    
    createParticles() {
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: Math.random() * 100 + 50,
                maxLife: Math.random() * 100 + 50,
                size: Math.random() * 3 + 1
            });
        }
    }
    
    bindEvents() {
        if (!this.canvas) return;
        this.canvas.addEventListener('pointermove', this.boundPointerMove);
        this.canvas.addEventListener('pointerdown', this.boundPointerDown);
        this.canvas.addEventListener('pointerup', this.boundPointerUp);
        this.canvas.addEventListener('pointerleave', this.boundPointerUp);
        document.addEventListener('keydown', this.boundKeyDown);
        document.addEventListener('keyup', this.boundKeyUp);
    }
    
    handlePointerMove(e) {
        if (!this.gameRunning || this.paused || !this.canvas) return;
        const position = this.getPointerPosition(e);
        if (!position) return;
        this.pointerState.active = true;
        this.pointerState.x = position.x;
        this.setPaddleX(position.x - this.paddle.width / 2);
    }

    handlePointerDown(e) {
        if (!this.gameRunning || !this.canvas) return;
        const position = this.getPointerPosition(e);
        if (!position) return;
        this.pointerState.active = true;
        this.pointerState.x = position.x;
        this.setPaddleX(position.x - this.paddle.width / 2);
        if (!this.paused && this.ballStuck) {
            this.launchBall();
        }
    }

    handlePointerUp() {
        this.pointerState.active = false;
    }
    
    handleKeyDown(e) {
        if (e.repeat) return;
        switch (e.code) {
            case 'Space':
                if (!this.gameRunning) {
                    this.restart();
                } else if (this.paused) {
                    this.togglePause();
                } else if (this.ballStuck) {
                    this.launchBall();
                } else {
                    this.togglePause();
                }
                e.preventDefault();
                break;
            case 'KeyP':
            case 'Escape':
                if (this.gameRunning) {
                    this.togglePause();
                    e.preventDefault();
                }
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.inputState.left = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.inputState.right = true;
                e.preventDefault();
                break;
            case 'KeyR':
                this.restart();
                e.preventDefault();
                break;
        }
    }

    handleKeyUp(e) {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.inputState.left = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.inputState.right = false;
                break;
        }
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    getPointerPosition(e) {
        if (!this.canvas) return null;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x, y };
    }

    setPaddleX(x) {
        if (!this.canvas) return;
        const paddleWidth = this.clamp(this.paddle.width, 10, this.canvas.width);
        this.paddle.width = paddleWidth;
        const maxX = Math.max(0, this.canvas.width - paddleWidth);
        this.paddle.x = this.clamp(x, 0, maxX);
    }

    updatePaddleFromKeyboard() {
        if (!this.gameRunning || this.paused) return;
        if (this.inputState.left === this.inputState.right) return;
        const direction = this.inputState.left ? -1 : 1;
        const nextX = this.paddle.x + direction * this.paddle.speed;
        this.setPaddleX(nextX);
    }

    alignBallToPaddle() {
        if (!this.canvas) return;
        const paddleCenter = this.paddle.x + this.paddle.width / 2;
        this.ball.x = this.clamp(paddleCenter, this.ball.radius, this.canvas.width - this.ball.radius);
        this.ball.y = this.paddle.y - this.ball.radius;
    }

    getBaseBallSpeed() {
        return Math.max(2, Math.min(15, 4 + (this.level - 1) * 0.5));
    }

    launchBall() {
        if (!this.gameRunning || this.paused) return;
        this.alignBallToPaddle();
        const baseSpeed = this.getBaseBallSpeed();
        const direction = Math.random() > 0.5 ? 1 : -1;
        const horizontalSpeed = baseSpeed * direction;
        this.ball.speed = baseSpeed;
        this.ball.dx = Math.abs(horizontalSpeed) < 0.5 ? 0.5 * direction : horizontalSpeed;
        this.ball.dy = -baseSpeed;
        if (!isFinite(this.ball.dx)) this.ball.dx = 0.5 * direction;
        if (!isFinite(this.ball.dy)) this.ball.dy = -baseSpeed;
        this.ballStuck = false;
    }

    addScore(points) {
        const safePoints = isFinite(points) ? points : 0;
        this.score = Math.min(Number.MAX_SAFE_INTEGER, this.score + safePoints);
    }

    applyBlockHit(blockIndex) {
        const block = this.blocks[blockIndex];
        if (!block) return null;
        if (!block.health || block.health <= 0) {
            this.blocks.splice(blockIndex, 1);
            return { removed: true, block };
        }
        block.health--;
        if (block.health <= 0) {
            this.blocks.splice(blockIndex, 1);
            this.addScore(10);
            this.createBlockParticles(block);
            if (Math.random() < 0.3) {
                this.createPowerUp(block.x + block.width / 2, block.y + block.height / 2);
            }
            return { removed: true, block };
        }
        return { removed: false, block };
    }

    updatePauseUI() {
        if (this.ui.pauseOverlay) {
            this.ui.pauseOverlay.style.display = this.paused ? 'block' : 'none';
        }
        if (this.ui.pauseButton) {
            this.ui.pauseButton.textContent = this.paused ? 'Resume' : 'Pause';
        }
        if (this.ui.ballStatus && this.gameRunning) {
            this.ui.ballStatus.textContent = this.paused
                ? 'Paused'
                : (this.ballStuck ? 'Ready' : 'In play');
        }
    }

    updatePowerUpList() {
        if (!this.ui.powerUpList) return;
        const activeTypes = Object.keys(this.activePowerUps).sort();
        const types = this.getPowerUpTypes();
        const items = activeTypes.map(type => {
            const entry = types.find(powerUp => powerUp.type === type);
            const timeLeft = Math.ceil(this.activePowerUps[type] / 60);
            if (entry) {
                return `${entry.emoji} ${entry.name} (${timeLeft}s)`;
            }
            return `${type} (${timeLeft}s)`;
        });
        const summary = items.join('|');
        if (summary === this.lastPowerUpSummary) return;
        this.lastPowerUpSummary = summary;
        this.ui.powerUpList.innerHTML = '';
        if (items.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'None';
            this.ui.powerUpList.appendChild(li);
            return;
        }
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            this.ui.powerUpList.appendChild(li);
        });
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        this.paused = !this.paused;
        this.updatePauseUI();
    }
    
    update() {
        if (!this.gameRunning || this.paused) return;

        this.updatePaddleFromKeyboard();
        
        // Update ball position (with slow motion effect)
        if (this.ballStuck) {
            this.alignBallToPaddle();
        } else {
            const slowMotionFactor = this.activePowerUps.slowMotion ? 0.5 : 1.0;
            // Ensure ball velocity is finite before updating
            if (isFinite(this.ball.dx) && isFinite(this.ball.dy)) {
                this.ball.x += this.ball.dx * slowMotionFactor;
                this.ball.y += this.ball.dy * slowMotionFactor;
            } else {
                // Reset ball if velocity becomes invalid
                this.resetBall();
            }
            
            // Magnet effect - attract ball to paddle
            if (this.activePowerUps.magnet && this.ball.y > this.canvas.height / 2) {
                const paddleCenterX = this.paddle.x + this.paddle.width / 2;
                const attraction = (paddleCenterX - this.ball.x) * 0.05;
                this.ball.dx += attraction;
            }
            
            // Ball collision with walls - correct position to prevent sticking
            if (this.ball.x <= this.ball.radius) {
                this.ball.x = this.ball.radius;
                this.ball.dx = -this.ball.dx;
            } else if (this.ball.x >= this.canvas.width - this.ball.radius) {
                this.ball.x = this.canvas.width - this.ball.radius;
                this.ball.dx = -this.ball.dx;
            }
            if (this.ball.y <= this.ball.radius) {
                this.ball.y = this.ball.radius;
                this.ball.dy = -this.ball.dy;
            }
            
            // Ball collision with paddle - improved detection
            const ballBottom = this.ball.y + this.ball.radius;
            const ballTop = this.ball.y - this.ball.radius;
            const paddleTop = this.paddle.y;
            const paddleBottom = this.paddle.y + this.paddle.height;
            const paddleLeft = this.paddle.x;
            const paddleRight = this.paddle.x + this.paddle.width;
            
            if (ballBottom >= paddleTop && ballTop <= paddleBottom &&
                this.ball.x + this.ball.radius >= paddleLeft &&
                this.ball.x - this.ball.radius <= paddleRight &&
                this.ball.dy > 0) {
                // Calculate hit position on paddle (0 = left edge, 1 = right edge)
                // Prevent division by zero
                const paddleWidth = Math.max(1, this.paddle.width);
                const hitPos = Math.max(0, Math.min(1, (this.ball.x - paddleLeft) / paddleWidth));
                // Angle based on hit position (-0.5 to 0.5 range)
                const angle = (hitPos - 0.5) * 0.8; // Max 40 degree angle
                
                // Calculate new velocity direction
                const currentSpeed = Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy);
                const speed = Math.max(this.ball.speed, isFinite(currentSpeed) ? currentSpeed : this.ball.speed);
                this.ball.dx = Math.sin(angle) * speed;
                this.ball.dy = -Math.abs(Math.cos(angle) * speed);
                
                // Ensure values are finite
                if (!isFinite(this.ball.dx)) this.ball.dx = speed * 0.5;
                if (!isFinite(this.ball.dy)) this.ball.dy = -speed;
                
                // Ensure minimum upward velocity and prevent horizontal-only movement
                if (this.ball.dy > -2) {
                    this.ball.dy = -2;
                }
                if (Math.abs(this.ball.dx) < 0.5) {
                    this.ball.dx = this.ball.dx >= 0 ? 0.5 : -0.5;
                }
                
                // Correct ball position to prevent sticking
                this.ball.y = paddleTop - this.ball.radius;
            }
            
            // Ball out of bounds
            if (this.ball.y >= this.canvas.height) {
                this.lives--;
                if (this.lives <= 0) {
                    this.gameOver();
                    return;
                } else {
                    // Clear extra balls when losing a life
                    this.balls = [];
                    this.resetBall();
                    this.balls = [this.ball];
                }
            }
        }
        
        // Update and clean up particles
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            // Remove dead particles
            if (particle.life <= 0) {
                return false;
            }
            
            // Reset background particles that go off screen
            if (particle.maxLife > 50 && (particle.x < 0 || particle.x > this.canvas.width || 
                particle.y < 0 || particle.y > this.canvas.height)) {
                particle.life = particle.maxLife;
                particle.x = Math.random() * this.canvas.width;
                particle.y = Math.random() * this.canvas.height;
            }
            
            return true;
        });
        
        if (!this.ballStuck) {
            // Check block collisions for main ball - iterate backwards to safely remove items
            for (let i = this.blocks.length - 1; i >= 0; i--) {
                const block = this.blocks[i];
                if (this.checkCollision(this.ball, block)) {
                    // Determine collision side for better bounce
                    const ballCenterX = this.ball.x;
                    const ballCenterY = this.ball.y;
                    const blockCenterX = block.x + block.width / 2;
                    const blockCenterY = block.y + block.height / 2;
                    
                    const dx = ballCenterX - blockCenterX;
                    const dy = ballCenterY - blockCenterY;
                    const absDx = Math.abs(dx);
                    const absDy = Math.abs(dy);
                    
                    this.applyBlockHit(i);
                    
                    // Bounce based on which side was hit
                    if (absDx > absDy) {
                        // Hit from left or right
                        this.ball.dx = -this.ball.dx;
                    } else {
                        // Hit from top or bottom
                        this.ball.dy = -this.ball.dy;
                    }
                    
                    // Only process one collision per frame
                    break;
                }
            }
        }
        
        // Update power-ups
        this.updatePowerUps();
        
        // Update toilet paper shots
        this.updateToiletPaper();
        
        // Update laser shots
        this.updateLasers();
        
        // Update multiple balls
        this.updateMultipleBalls();
        
        // Check win condition
        if (this.blocks.length === 0) {
            this.nextLevel();
        }
        
        this.updateUI();
    }
    
    checkCollision(ball, block) {
        if (!ball || !block) return false;
        // Ensure all values are finite and valid
        if (!isFinite(ball.x) || !isFinite(ball.y) || !isFinite(ball.radius)) return false;
        if (!isFinite(block.x) || !isFinite(block.y) || !isFinite(block.width) || !isFinite(block.height)) return false;
        if (ball.radius <= 0 || block.width <= 0 || block.height <= 0) return false;
        
        return ball.x + ball.radius > block.x &&
               ball.x - ball.radius < block.x + block.width &&
               ball.y + ball.radius > block.y &&
               ball.y - ball.radius < block.y + block.height;
    }
    
    createBlockParticles(block) {
        // Limit particle creation to prevent memory issues
        const availableSlots = Math.max(0, this.maxParticles - this.particles.length);
        const particleCount = Math.min(8, availableSlots);
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: block.x + block.width / 2,
                y: block.y + block.height / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 60,
                maxLife: 60,
                size: Math.random() * 4 + 2,
                color: block.color
            });
        }
    }
    
    // Power-up types
    getPowerUpTypes() {
        if (this.powerUpTypes) return this.powerUpTypes;
        this.powerUpTypes = [
            { type: 'toiletPaper', emoji: '🧻', color: '#ffffff', name: 'Toilet Paper' },
            { type: 'multiBall', emoji: '⚽', color: '#ff6b6b', name: 'Multi-Ball' },
            { type: 'bigPaddle', emoji: '📏', color: '#4ecdc4', name: 'Big Paddle' },
            { type: 'smallPaddle', emoji: '📐', color: '#feca57', name: 'Small Paddle' },
            { type: 'slowMotion', emoji: '🐌', color: '#45b7d1', name: 'Slow Motion' },
            { type: 'extraLife', emoji: '❤️', color: '#ff6b6b', name: 'Extra Life' },
            { type: 'laser', emoji: '🔫', color: '#ff9ff3', name: 'Laser Paddle' },
            { type: 'magnet', emoji: '🧲', color: '#96ceb4', name: 'Magnet' }
        ];
        return this.powerUpTypes;
    }
    
    createPowerUp(x, y) {
        // Limit power-ups to prevent memory issues
        if (this.powerUps.length >= 10) return;
        
        // Ensure coordinates are valid and within canvas bounds
        if (!isFinite(x) || !isFinite(y)) return;
        const validX = Math.max(15, Math.min(this.canvas.width - 15, x));
        const validY = Math.max(15, Math.min(this.canvas.height - 15, y));
        
        const types = this.getPowerUpTypes();
        if (!types || types.length === 0) return;
        const powerUp = types[Math.floor(Math.random() * types.length)];
        if (!powerUp) return;
        
        this.powerUps.push({
            x: validX,
            y: validY,
            width: 30,
            height: 30,
            vy: 2,
            type: powerUp.type,
            emoji: powerUp.emoji,
            color: powerUp.color,
            name: powerUp.name,
            rotation: 0
        });
    }
    
    updatePowerUps() {
        // Update power-up positions and check paddle collision
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.y += powerUp.vy;
            powerUp.rotation += 0.1;
            
            // Check collision with paddle
            if (powerUp.y + powerUp.height >= this.paddle.y &&
                powerUp.y <= this.paddle.y + this.paddle.height &&
                powerUp.x + powerUp.width >= this.paddle.x &&
                powerUp.x <= this.paddle.x + this.paddle.width) {
                this.activatePowerUp(powerUp.type);
                this.powerUps.splice(i, 1);
            }
            // Remove if off screen
            else if (powerUp.y > this.canvas.height) {
                this.powerUps.splice(i, 1);
            }
        }
        
        // Update active power-up timers
        for (const type in this.activePowerUps) {
            this.activePowerUps[type]--;
            if (this.activePowerUps[type] <= 0) {
                this.deactivatePowerUp(type);
                delete this.activePowerUps[type];
            }
        }
    }
    
    activatePowerUp(type) {
        const duration = 600; // 10 seconds at 60fps
        
        switch(type) {
            case 'toiletPaper':
                this.activePowerUps.toiletPaper = duration;
                break;
            case 'multiBall':
                this.createMultiBall();
                break;
            case 'bigPaddle':
                // Deactivate small paddle if active
                if (this.activePowerUps.smallPaddle) {
                    delete this.activePowerUps.smallPaddle;
                }
                this.activePowerUps.bigPaddle = duration;
                this.paddle.width = Math.max(10, this.originalPaddleWidth * 1.5);
                this.setPaddleX(this.paddle.x);
                break;
            case 'smallPaddle':
                // Deactivate big paddle if active
                if (this.activePowerUps.bigPaddle) {
                    delete this.activePowerUps.bigPaddle;
                }
                this.activePowerUps.smallPaddle = duration;
                this.paddle.width = Math.max(10, this.originalPaddleWidth * 0.6);
                this.setPaddleX(this.paddle.x);
                break;
            case 'slowMotion':
                this.activePowerUps.slowMotion = duration;
                // Slow motion effect handled in update
                break;
            case 'extraLife':
                this.lives++;
                break;
            case 'laser':
                this.activePowerUps.laser = duration;
                break;
            case 'magnet':
                this.activePowerUps.magnet = duration * 2; // Longer duration
                break;
        }
    }
    
    deactivatePowerUp(type) {
        switch(type) {
            case 'bigPaddle':
            case 'smallPaddle':
                this.paddle.width = this.originalPaddleWidth;
                this.setPaddleX(this.paddle.x);
                break;
        }
    }
    
    createMultiBall() {
        // Limit total balls to prevent performance issues (max 5 balls total)
        const maxBalls = 5;
        const ballsToCreate = Math.min(2, maxBalls - this.balls.length);
        
        // Create additional balls
        for (let i = 0; i < ballsToCreate; i++) {
            let dx = (Math.random() - 0.5) * 8;
            let dy = -Math.abs((Math.random() - 0.5) * 8) - 2;
            
            // Ensure minimum horizontal movement to prevent vertical-only bouncing
            if (Math.abs(dx) < 0.5) {
                dx = dx >= 0 ? 0.5 : -0.5;
            }
            // Ensure minimum upward velocity
            if (dy > -2) {
                dy = -2;
            }
            
            // Ensure values are finite
            if (!isFinite(dx)) dx = 0.5;
            if (!isFinite(dy)) dy = -2;
            
            const newBall = {
                x: this.ball.x,
                y: this.ball.y,
                radius: this.ball.radius,
                dx: dx,
                dy: dy,
                color: this.ball.color,
                speed: this.ball.speed
            };
            this.balls.push(newBall);
        }
    }
    
    updateMultipleBalls() {
        // Update all balls (not just the main one)
        const slowMotionFactor = this.activePowerUps.slowMotion ? 0.5 : 1.0;
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            
            // Skip main ball (already updated)
            if (ball === this.ball) continue;
            
            // Ensure ball velocity is finite before updating
            if (isFinite(ball.dx) && isFinite(ball.dy)) {
                ball.x += ball.dx * slowMotionFactor;
                ball.y += ball.dy * slowMotionFactor;
            } else {
                // Remove invalid ball
                this.balls.splice(i, 1);
                continue;
            }
            
            // Magnet effect
            if (this.activePowerUps.magnet && ball.y > this.canvas.height / 2) {
                const paddleCenterX = this.paddle.x + this.paddle.width / 2;
                const attraction = (paddleCenterX - ball.x) * 0.05;
                if (isFinite(attraction)) {
                    ball.dx += attraction;
                }
            }
            
            // Wall collisions - correct position to prevent sticking
            if (ball.x <= ball.radius) {
                ball.x = ball.radius;
                ball.dx = -ball.dx;
            } else if (ball.x >= this.canvas.width - ball.radius) {
                ball.x = this.canvas.width - ball.radius;
                ball.dx = -ball.dx;
            }
            if (ball.y <= ball.radius) {
                ball.y = ball.radius;
                ball.dy = -ball.dy;
            }
            
            // Paddle collision
            const ballBottom = ball.y + ball.radius;
            const ballTop = ball.y - ball.radius;
            if (ballBottom >= this.paddle.y && ballTop <= this.paddle.y + this.paddle.height &&
                ball.x + ball.radius >= this.paddle.x && ball.x - ball.radius <= this.paddle.x + this.paddle.width &&
                ball.dy > 0) {
                // Prevent division by zero
                const paddleWidth = Math.max(1, this.paddle.width);
                const hitPos = Math.max(0, Math.min(1, (ball.x - this.paddle.x) / paddleWidth));
                const angle = (hitPos - 0.5) * 0.8;
                const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                const speed = Math.max(ball.speed, isFinite(currentSpeed) ? currentSpeed : ball.speed);
                ball.dx = Math.sin(angle) * speed;
                ball.dy = -Math.abs(Math.cos(angle) * speed);
                
                // Ensure values are finite
                if (!isFinite(ball.dx)) ball.dx = speed * 0.5;
                if (!isFinite(ball.dy)) ball.dy = -speed;
                
                // Ensure minimum upward velocity and prevent horizontal-only movement
                if (ball.dy > -2) {
                    ball.dy = -2;
                }
                if (Math.abs(ball.dx) < 0.5) {
                    ball.dx = ball.dx >= 0 ? 0.5 : -0.5;
                }
                
                ball.y = this.paddle.y - ball.radius;
            }
            
            // Block collisions
            for (let j = this.blocks.length - 1; j >= 0; j--) {
                const block = this.blocks[j];
                if (this.checkCollision(ball, block)) {
                    this.applyBlockHit(j);
                    const dx = ball.x - (block.x + block.width / 2);
                    const dy = ball.y - (block.y + block.height / 2);
                    if (Math.abs(dx) > Math.abs(dy)) {
                        ball.dx = -ball.dx;
                    } else {
                        ball.dy = -ball.dy;
                    }
                    break;
                }
            }
            
            // Remove if out of bounds (only extra balls, not main ball)
            if (ball.y > this.canvas.height && ball !== this.ball) {
                this.balls.splice(i, 1);
            }
        }
    }
    
    updateToiletPaper() {
        if (!this.activePowerUps.toiletPaper) return;
        
        // Auto-shoot toilet paper every 30 frames (prevent multiple shots in same frame)
        const currentFrame = 600 - this.activePowerUps.toiletPaper;
        if (this.activePowerUps.toiletPaper > 0 && currentFrame % 30 === 0 && currentFrame !== this.lastToiletPaperShot) {
            this.lastToiletPaperShot = currentFrame;
            // Limit shots to prevent memory issues
            if (this.toiletPaperShots.length < 20) {
                this.toiletPaperShots.push({
                    x: this.paddle.x + this.paddle.width / 2,
                    y: this.paddle.y,
                    width: 20,
                    height: 20,
                    vy: -8,
                    rotation: 0
                });
            }
        }
        
        // Update existing shots
        for (let i = this.toiletPaperShots.length - 1; i >= 0; i--) {
            const shot = this.toiletPaperShots[i];
            shot.y += shot.vy;
            shot.rotation += 0.2;
            
            // Check block collisions
            for (let j = this.blocks.length - 1; j >= 0; j--) {
                const block = this.blocks[j];
                if (shot.x + shot.width > block.x && shot.x < block.x + block.width &&
                    shot.y + shot.height > block.y && shot.y < block.y + block.height) {
                    this.applyBlockHit(j);
                    this.toiletPaperShots.splice(i, 1);
                    break;
                }
            }
            
            // Remove if off screen
            if (shot.y < -shot.height) {
                this.toiletPaperShots.splice(i, 1);
            }
        }
    }
    
    updateLasers() {
        if (!this.activePowerUps.laser) return;
        
        // Auto-shoot lasers every 20 frames (prevent multiple shots in same frame)
        const currentFrame = 600 - this.activePowerUps.laser;
        if (this.activePowerUps.laser > 0 && currentFrame % 20 === 0 && currentFrame !== this.lastLaserShot) {
            this.lastLaserShot = currentFrame;
            // Limit shots to prevent memory issues
            if (this.laserShots.length < 30) {
                this.laserShots.push({
                    x: this.paddle.x + this.paddle.width / 2,
                    y: this.paddle.y,
                    width: 4,
                    height: 15,
                    vy: -10
                });
            }
        }
        
        // Update existing lasers
        for (let i = this.laserShots.length - 1; i >= 0; i--) {
            const laser = this.laserShots[i];
            laser.y += laser.vy;
            
            // Check block collisions
            for (let j = this.blocks.length - 1; j >= 0; j--) {
                const block = this.blocks[j];
                if (laser.x + laser.width > block.x && laser.x < block.x + block.width &&
                    laser.y + laser.height > block.y && laser.y < block.y + block.height) {
                    this.applyBlockHit(j);
                    this.laserShots.splice(i, 1);
                    break;
                }
            }
            
            // Remove if off screen
            if (laser.y < -laser.height) {
                this.laserShots.splice(i, 1);
            }
        }
    }
    
    resetBall(stickToPaddle = true) {
        // Reset to base speed for current level (cap at reasonable maximum)
        const baseSpeed = this.getBaseBallSpeed();
        this.ball.speed = baseSpeed;
        this.alignBallToPaddle();
        if (stickToPaddle) {
            this.ball.dx = 0;
            this.ball.dy = 0;
            this.ballStuck = true;
        } else {
            // Ensure ball has horizontal movement to prevent vertical-only bouncing
            const horizontalSpeed = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
            this.ball.dx = Math.abs(horizontalSpeed) < 0.5 ? (Math.random() > 0.5 ? 0.5 : -0.5) : horizontalSpeed;
            this.ball.dy = -baseSpeed;
            this.ballStuck = false;
        }
        
        // Ensure values are finite
        if (!isFinite(this.ball.dx)) this.ball.dx = 0.5;
        if (!isFinite(this.ball.dy)) this.ball.dy = -baseSpeed;
        if (!isFinite(this.ball.speed)) this.ball.speed = baseSpeed;
    }
    
    nextLevel() {
        this.level++;
        // Prevent level overflow
        this.level = Math.min(999, this.level);
        this.addScore(100 * this.level);
        // Increase base speed for the level (cap at reasonable maximum)
        const baseSpeed = this.getBaseBallSpeed();
        this.ball.speed = baseSpeed;
        this.createBlocks();
        // Reset all balls and power-ups for new level
        this.balls = [];
        this.toiletPaperShots = [];
        this.laserShots = [];
        this.powerUps = [];
        this.activePowerUps = {};
        this.lastPowerUpSummary = null;
        this.lastToiletPaperShot = 0;
        this.lastLaserShot = 0;
        this.paddle.width = this.originalPaddleWidth;
        this.setPaddleX(this.paddle.x);
        this.resetBall(true);
        
        this.balls = [this.ball];
    }
    
    gameOver() {
        this.gameRunning = false;
        this.paused = false;
        if (this.ui.gameOver) this.ui.gameOver.style.display = 'block';
        if (this.ui.finalScore) this.ui.finalScore.textContent = this.score;
        if (this.ui.ballStatus) this.ui.ballStatus.textContent = 'Game Over';
        this.updatePauseUI();
    }
    
    restart() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameRunning = true;
        this.paused = false;
        this.ballStuck = true;
        this.blocks = [];
        this.particles = [];
        this.powerUps = [];
        this.activePowerUps = {};
        this.lastPowerUpSummary = null;
        this.toiletPaperShots = [];
        this.laserShots = [];
        this.balls = [];
        this.lastToiletPaperShot = 0;
        this.lastLaserShot = 0;
        this.paddle.width = this.originalPaddleWidth;
        this.setPaddleX(this.paddle.x);
        this.createBlocks();
        this.createParticles();
        this.resetBall(true);
        this.balls = [this.ball];
        if (this.ui.gameOver) this.ui.gameOver.style.display = 'none';
        if (this.ui.pauseOverlay) this.ui.pauseOverlay.style.display = 'none';
        this.updatePauseUI();
        this.updatePowerUpList();
    }
    
    updateUI() {
        if (this.ui.score) this.ui.score.textContent = this.score;
        if (this.ui.lives) this.ui.lives.textContent = this.lives;
        if (this.ui.level) this.ui.level.textContent = this.level;
        if (this.ui.ballStatus) {
            this.ui.ballStatus.textContent = this.ballStuck ? 'Ready' : 'In play';
        }
        if (this.ui.pauseButton) {
            this.ui.pauseButton.textContent = this.paused ? 'Resume' : 'Pause';
        }
        this.updatePowerUpList();
    }
    
    render() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.ctx.fillStyle = 'rgba(26, 26, 46, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life / particle.maxLife;
            this.ctx.fillStyle = particle.color || '#00ff88';
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
        
        // Draw blocks
        this.blocks.forEach(block => {
            this.ctx.save();
            this.ctx.fillStyle = block.color;
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillRect(block.x, block.y, block.width, block.height);
            
            // Block glow effect
            this.ctx.shadowColor = block.color;
            this.ctx.shadowBlur = 10;
            this.ctx.strokeStyle = block.color;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(block.x, block.y, block.width, block.height);
            
            // Health indicator
            if (block.health < block.maxHealth) {
                this.ctx.fillStyle = '#ff6b6b';
                this.ctx.fillRect(block.x, block.y + block.height - 3, 
                                (block.width * block.health) / block.maxHealth, 3);
            }
            this.ctx.restore();
        });
        
        // Draw paddle
        this.ctx.save();
        this.ctx.fillStyle = this.paddle.color;
        this.ctx.shadowColor = this.paddle.color;
        this.ctx.shadowBlur = 15;
        this.ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        this.ctx.restore();
        
        // Draw all balls
        this.balls.forEach(ball => {
            this.ctx.save();
            this.ctx.fillStyle = ball.color;
            this.ctx.shadowColor = ball.color;
            this.ctx.shadowBlur = 20;
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            this.ctx.save();
            this.ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
            this.ctx.rotate(powerUp.rotation);
            this.ctx.fillStyle = powerUp.color;
            this.ctx.shadowColor = powerUp.color;
            this.ctx.shadowBlur = 10;
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(powerUp.emoji, 0, 0);
            this.ctx.restore();
        });
        
        // Draw toilet paper shots
        this.toiletPaperShots.forEach(shot => {
            this.ctx.save();
            this.ctx.translate(shot.x + shot.width / 2, shot.y + shot.height / 2);
            this.ctx.rotate(shot.rotation);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowColor = '#ffffff';
            this.ctx.shadowBlur = 5;
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🧻', 0, 0);
            this.ctx.restore();
        });
        
        // Draw laser shots
        this.laserShots.forEach(laser => {
            this.ctx.save();
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.shadowColor = '#ff00ff';
            this.ctx.shadowBlur = 10;
            this.ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
            this.ctx.restore();
        });

        if (this.ballStuck && this.gameRunning && !this.paused) {
            this.ctx.save();
            this.ctx.fillStyle = '#00ff88';
            this.ctx.font = '18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('Press Space or Tap to launch', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.restore();
        }
        
        // Draw active power-up indicators (limit to prevent overflow)
        let indicatorY = 100;
        let indicatorCount = 0;
        const maxIndicators = 5; // Prevent UI overflow
        for (const type in this.activePowerUps) {
            if (indicatorCount >= maxIndicators) break;
            const types = this.getPowerUpTypes();
            const powerUp = types.find(p => p.type === type);
            if (powerUp) {
                this.ctx.save();
                this.ctx.fillStyle = powerUp.color;
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(`${powerUp.emoji} ${powerUp.name}`, 10, indicatorY);
                const timeLeft = Math.ceil(this.activePowerUps[type] / 60);
                this.ctx.fillText(`(${timeLeft}s)`, 150, indicatorY);
                this.ctx.restore();
                indicatorY += 25;
                indicatorCount++;
            }
        }
    }
    
    gameLoop() {
        if (!this.ctx || !this.canvas) {
            console.error('Canvas or context lost');
            return;
        }
        try {
            this.update();
            this.render();
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
        } catch (error) {
            console.error('Error in game loop:', error);
            // Try to continue, but log the error
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
        }
    }
    
    destroy() {
        // Clean up event listeners
        if (this.canvas) {
            this.canvas.removeEventListener('pointermove', this.boundPointerMove);
            this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
            this.canvas.removeEventListener('pointerup', this.boundPointerUp);
            this.canvas.removeEventListener('pointerleave', this.boundPointerUp);
        }
        document.removeEventListener('keydown', this.boundKeyDown);
        document.removeEventListener('keyup', this.boundKeyUp);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// Initialize game when page loads
let gameInstance = null;

window.addEventListener('load', () => {
    gameInstance = new Game();
});

// Global restart function
function restartGame() {
    if (gameInstance) {
        gameInstance.restart();
    } else {
        location.reload();
    }
}

// Global pause toggle for UI button
function togglePauseGame() {
    if (gameInstance) {
        gameInstance.togglePause();
    }
}