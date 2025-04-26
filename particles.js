class ParticleSystem {
    constructor() {
        console.log('粒子系统初始化中...');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'particle-canvas';
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrame = null;
        this.isPlaying = false;
        
        // 设置canvas样式
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '0';
        this.canvas.style.opacity = '0';
        this.canvas.style.transition = 'opacity 1s ease';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.backgroundColor = 'transparent';
        
        // 初始化粒子
        this.init();
        console.log('粒子系统初始化完成');
    }
    
    init() {
        console.log('设置canvas尺寸...');
        // 设置canvas尺寸
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // 创建粒子
        this.createParticles();
        console.log('创建了', this.particles.length, '个粒子');
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log('Canvas尺寸已更新:', this.canvas.width, 'x', this.canvas.height);
    }
    
    createParticles() {
        // 根据屏幕大小调整粒子数量
        const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 8000);
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1, // 增大粒子大小范围
                speedX: (Math.random() - 0.5) * 0.3, // 降低移动速度
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.4 + 0.3, // 提高基础透明度
                color: `rgba(138, 43, 226, ${Math.random() * 0.4 + 0.3})` // 调整透明度范围
            });
        }
    }
    
    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.particles.forEach(particle => {
            // 更新位置
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            
            // 边界检查
            if (particle.x < 0 || particle.x > this.canvas.width) {
                particle.speedX *= -1;
            }
            if (particle.y < 0 || particle.y > this.canvas.height) {
                particle.speedY *= -1;
            }
            
            // 绘制粒子
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.fill();
            
            // 添加发光效果
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = particle.color;
        });
        
        if (this.isPlaying) {
            this.animationFrame = requestAnimationFrame(() => this.update());
        }
    }
    
    start() {
        console.log('启动粒子动画...');
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.canvas.style.opacity = '1';
            this.update();
            console.log('粒子动画已启动');
        }
    }
    
    stop() {
        console.log('停止粒子动画...');
        if (this.isPlaying) {
            this.isPlaying = false;
            this.canvas.style.opacity = '0';
            cancelAnimationFrame(this.animationFrame);
            console.log('粒子动画已停止');
        }
    }
    
    appendTo(element) {
        console.log('将canvas添加到元素:', element);
        element.appendChild(this.canvas);
        console.log('Canvas已添加到页面');
    }
} 