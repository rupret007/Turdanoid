class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.lives = 3;
        this.gameRunning = true;

        this.keys = {
            left: false,
            right: false
        };
        
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
            color: '#ff6b6b'
        };
        
        this.blocks = [];
        this.particles = [];
        this.powerUps = [];
        
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
        document.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            this.paddle.x = mouseX - this.paddle.width / 2;
            this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.gameRunning) {
                this.restart();
            }
            if (e.code === 'ArrowLeft') {
                this.keys.left = true;
            }
            if (e.code === 'ArrowRight') {
                this.keys.right = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft') {
                this.keys.left = false;
            }
            if (e.code === 'ArrowRight') {
                this.keys.right = false;
            }
        });
    }
    
    update() {
        if (!this.gameRunning) return;

        if (this.keys.left) {
            this.paddle.x -= this.paddle.speed;
        }
        if (this.keys.right) {
            this.paddle.x += this.paddle.speed;
        }
        this.paddle.x = Math.max(0, Math.min(this.canvas.width - this.paddle.width, this.paddle.x));

        // Update ball position
        this.ball.x += this.ball.dx;
        this.ball.y += this.ball.dy;
        
        // Ball collision with walls
        if (this.ball.x <= this.ball.radius || this.ball.x >= this.canvas.width - this.ball.radius) {
            this.ball.dx = -this.ball.dx;
        }
        if (this.ball.y <= this.ball.radius) {
            this.ball.dy = -this.ball.dy;
        }
        
        // Ball collision with paddle
        if (this.ball.y + this.ball.radius >= this.paddle.y &&
            this.ball.x >= this.paddle.x &&
            this.ball.x <= this.paddle.x + this.paddle.width) {
            this.ball.dy = -this.ball.dy;
            this.ball.dx += (this.ball.x - (this.paddle.x + this.paddle.width / 2)) * 0.1;
        }
        
        // Ball out of bounds
        if (this.ball.y > this.canvas.height) {
            this.lives--;
            if (this.lives <= 0) {
                this.gameOver();
            } else {
                this.resetBall();
            }
        }
        
        // Update particles
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            
            if (particle.life <= 0) {
                particle.life = particle.maxLife;
                particle.x = Math.random() * this.canvas.width;
                particle.y = Math.random() * this.canvas.height;
            }
        });
        
        // Check block collisions
        this.blocks.forEach((block, index) => {
            if (this.checkCollision(this.ball, block)) {
                block.health--;
                if (block.health <= 0) {
                    this.blocks.splice(index, 1);
                    this.score += 10;
                    this.createBlockParticles(block);
                }
                this.ball.dy = -this.ball.dy;
            }
        });
        
        // Check win condition
        if (this.blocks.length === 0) {
            this.nextLevel();
        }
        
        this.updateUI();
    }
    
    checkCollision(ball, block) {
        return ball.x + ball.radius > block.x &&
               ball.x - ball.radius < block.x + block.width &&
               ball.y + ball.radius > block.y &&
               ball.y - ball.radius < block.y + block.height;
    }
    
    createBlockParticles(block) {
        for (let i = 0; i < 8; i++) {
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
        this.ball.x = this.canvas.width / 2;
        this.ball.y = this.canvas.height - 50;
        this.ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
        this.ball.dy = -4;
    }
    
    nextLevel() {
        this.score += 100;
        this.ball.dx *= 1.1;
        this.ball.dy *= 1.1;
        this.createBlocks();
    }
    
    gameOver() {
        this.gameRunning = false;
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('finalScore').textContent = this.score;
    }
    
    restart() {
        this.score = 0;
        this.lives = 3;
        this.gameRunning = true;
        this.blocks = [];
        this.particles = [];
        this.createBlocks();
        this.createParticles();
        this.resetBall();
        document.getElementById('gameOver').style.display = 'none';
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
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
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new Game();
});

// Global restart function
function restartGame() {
    location.reload();
}