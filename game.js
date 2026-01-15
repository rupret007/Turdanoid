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
        
        // Game objects
        this.paddle = {
            x: this.canvas.width / 2 - 50,
            y: this.canvas.height - 30,
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
        this.maxParticles = 200; // Limit particle count to prevent memory issues
        
        // Store event handlers for cleanup
        this.boundMouseMove = (e) => this.handleMouseMove(e);
        this.boundKeyDown = (e) => this.handleKeyDown(e);
        
        this.init();
        this.createParticles();
        this.gameLoop();
    }
    
    init() {
        this.createBlocks();
        this.bindEvents();
    }
    
    createBlocks() {
        const rows = 6;
        const cols = 12;
        const blockWidth = 60;
        const blockHeight = 25;
        const padding = 5;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const block = {
                    x: col * (blockWidth + padding) + 50,
                    y: row * (blockHeight + padding) + 50,
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
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('keydown', this.boundKeyDown);
    }
    
    handleMouseMove(e) {
        if (!this.gameRunning || this.paused) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.paddle.x = mouseX - this.paddle.width / 2;
        this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));
    }
    
    handleKeyDown(e) {
        if (e.code === 'Space') {
            if (!this.gameRunning) {
                this.restart();
            } else {
                this.togglePause();
            }
            e.preventDefault();
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
            this.togglePause();
            e.preventDefault();
        }
    }
    
    togglePause() {
        this.paused = !this.paused;
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (pauseOverlay) {
            pauseOverlay.style.display = this.paused ? 'block' : 'none';
        }
    }
    
    update() {
        if (!this.gameRunning || this.paused) return;
        
        // Update ball position
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
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
            const hitPos = (this.ball.x - paddleLeft) / this.paddle.width;
            // Angle based on hit position (-0.5 to 0.5 range)
            const angle = (hitPos - 0.5) * 0.8; // Max 40 degree angle
            
            // Calculate new velocity direction
            const speed = Math.max(this.ball.speed, Math.sqrt(this.ball.dx * this.ball.dx + this.ball.dy * this.ball.dy));
            this.ball.dx = Math.sin(angle) * speed;
            this.ball.dy = -Math.abs(Math.cos(angle) * speed);
            
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
            } else {
                this.resetBall();
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
        
        // Check block collisions - iterate backwards to safely remove items
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
                
                block.health--;
                if (block.health <= 0) {
                    this.blocks.splice(i, 1);
                    this.score += 10;
                    this.createBlockParticles(block);
                }
                
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
        
        // Check win condition
        if (this.blocks.length === 0) {
            this.nextLevel();
        }
        
        this.updateUI();
    }
    
    checkCollision(ball, block) {
        if (!ball || !block) return false;
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
    
    resetBall() {
        // Reset to base speed for current level
        const baseSpeed = 4 + (this.level - 1) * 0.5;
        this.ball.speed = baseSpeed;
        this.ball.x = this.canvas.width / 2;
        this.ball.y = this.canvas.height - 50;
        // Ensure ball has horizontal movement to prevent vertical-only bouncing
        const horizontalSpeed = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
        this.ball.dx = Math.abs(horizontalSpeed) < 0.5 ? (Math.random() > 0.5 ? 0.5 : -0.5) : horizontalSpeed;
        this.ball.dy = -baseSpeed;
    }
    
    nextLevel() {
        this.level++;
        this.score += 100 * this.level;
        // Increase base speed for the level
        const baseSpeed = 4 + (this.level - 1) * 0.5;
        this.ball.speed = baseSpeed;
        this.createBlocks();
        // Reset ball position but maintain level-appropriate speed
        this.ball.x = this.canvas.width / 2;
        this.ball.y = this.canvas.height - 50;
        this.ball.dx = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
        this.ball.dy = -baseSpeed;
    }
    
    gameOver() {
        this.gameRunning = false;
        const gameOverEl = document.getElementById('gameOver');
        const finalScoreEl = document.getElementById('finalScore');
        if (gameOverEl) gameOverEl.style.display = 'block';
        if (finalScoreEl) finalScoreEl.textContent = this.score;
    }
    
    restart() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameRunning = true;
        this.paused = false;
        this.blocks = [];
        this.particles = [];
        this.createBlocks();
        this.createParticles();
        this.resetBall();
        const gameOverEl = document.getElementById('gameOver');
        const pauseOverlay = document.getElementById('pauseOverlay');
        if (gameOverEl) gameOverEl.style.display = 'none';
        if (pauseOverlay) pauseOverlay.style.display = 'none';
    }
    
    updateUI() {
        const scoreEl = document.getElementById('score');
        const livesEl = document.getElementById('lives');
        if (scoreEl) scoreEl.textContent = this.score;
        if (livesEl) livesEl.textContent = this.lives;
    }
    
    render() {
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
        
        // Draw ball
        this.ctx.save();
        this.ctx.fillStyle = this.ball.color;
        this.ctx.shadowColor = this.ball.color;
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    gameLoop() {
        this.update();
        this.render();
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }
    
    destroy() {
        // Clean up event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('keydown', this.boundKeyDown);
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