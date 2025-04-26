/**
 * 每日冥想应用 - 主要JavaScript文件
 * 优化版 - 减少内存占用，提高性能和代码可维护性
 */

// 使用严格模式提高代码质量和性能
'use strict';

/**
 * 生成通用唯一标识符 (UUID v4)
 * @return {string} 生成的UUID字符串
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, 
              v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 获取用户ID - 如果不存在则创建新ID
 * @return {string} 用户唯一标识符
 */
function getUserId() {
    try {
        let userId = localStorage.getItem('meditationUserId');
        
        if (!userId) {
            userId = generateUUID();
            localStorage.setItem('meditationUserId', userId);
            console.log('创建新用户ID:', userId);
        }
        
        return userId;
    } catch (error) {
        console.error('获取用户ID时出错:', error);
        // 在localStorage异常时提供备用唯一标识
        return 'user-' + Date.now().toString();
    }
}

/**
 * 冥想数据管理类 - 处理所有与冥想数据相关的操作
 */
class MeditationData {
    /**
     * @param {string} userId - 用户唯一标识符
     */
    constructor(userId) {
        this.userId = userId;
        this.dataKey = `meditation_data_${userId}`;
        this.data = this.loadData();
    }
    
    /**
     * 从本地存储加载数据，如果不存在则初始化
     * @return {Object} 加载的冥想数据
     */
    loadData() {
        try {
            const savedData = localStorage.getItem(this.dataKey);
            if (savedData) {
                return JSON.parse(savedData);
            }
        } catch (error) {
            console.error('加载冥想数据失败:', error);
        }
        
        // 初始化默认数据
        return {
            totalSessions: 0,
            totalMinutes: 0,
            currentStreak: 0,
            lastSessionDate: null,
            sessions: []
        };
    }
    
    /**
     * 保存数据到本地存储
     * 添加错误恢复机制，防止数据丢失
     * @returns {boolean} 是否保存成功
     */
    saveData() {
        try {
            // 将数据转换为JSON字符串
            const dataString = JSON.stringify(this.data);
            
            // 检查数据大小，避免超出localStorage限制
            if (dataString.length > 5000000) { // 约5MB, localStorage理论上限为5-10MB
                console.warn('冥想数据过大，可能超出存储限制');
                
                // 尝试减少会话历史以节省空间
                if (this.data.sessions && this.data.sessions.length > 50) {
                    this.data.sessions = this.data.sessions.slice(-50); // 只保留最近50条记录
                    console.log('已减少会话历史记录数量以节省空间');
                    // 递归调用保存
                    return this.saveData();
                }
            }
            
            // 先创建一个临时备份，防止保存失败时丢失数据
            const backupKey = `${this.dataKey}_backup`;
            const oldData = localStorage.getItem(this.dataKey);
            if (oldData) {
                localStorage.setItem(backupKey, oldData);
            }
            
            // 保存新数据
            localStorage.setItem(this.dataKey, dataString);
            
            // 保存成功后移除备份
            localStorage.removeItem(backupKey);
            
            return true;
        } catch (error) {
            console.error('保存冥想数据失败:', error);
            
            // 如果是QUOTA_EXCEEDED_ERR，尝试清理一些不必要的数据
            if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (this.data.sessions && this.data.sessions.length > 10) {
                    console.log('存储空间不足，正在减少会话历史...');
                    this.data.sessions = this.data.sessions.slice(-10); // 紧急情况只保留最近10条
                    return this.saveData(); // 重新尝试保存
                }
            }
            
            return false;
        }
    }
    
    /**
     * 添加新的冥想会话并更新统计数据
     * @param {number} minutes - 冥想的分钟数
     */
    addSession(minutes) {
        if (!minutes || isNaN(minutes) || minutes <= 0) {
            console.warn('无效的冥想时间:', minutes);
            return;
        }
        
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD 格式
        
        // 更新总冥想次数和时间
        this.data.totalSessions++;
        this.data.totalMinutes += minutes;
        
        // 检查并更新连续冥想
        if (this.data.lastSessionDate) {
            const lastDate = new Date(this.data.lastSessionDate);
            const lastDay = lastDate.toISOString().split('T')[0];
            
            if (lastDay === today) {
                // 今天已经有冥想记录，不重复计算连续天数
                console.log('今天已有冥想记录');
            } else {
                const dayDiff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    // 连续冥想
                    this.data.currentStreak++;
                    console.log('连续冥想天数:', this.data.currentStreak);
                } else if (dayDiff > 1) {
                    // 中断了连续冥想
                    console.log('连续冥想中断, 重置为1');
                    this.data.currentStreak = 1;
                }
            }
        } else {
            // 第一次冥想
            this.data.currentStreak = 1;
        }
        
        // 更新最后冥想日期
        this.data.lastSessionDate = now.toISOString();
        
        // 添加会话记录
        this.data.sessions.push({
            date: now.toISOString(),
            minutes: minutes
        });
        
        // 限制会话历史数量，避免存储过多数据
        if (this.data.sessions.length > 100) {
            this.data.sessions = this.data.sessions.slice(-100);
        }
        
        // 保存更新后的数据
        this.saveData();
        
        // 更新UI
        this.updateStatsUI();
    }
    
    /**
     * 更新统计UI显示
     */
    updateStatsUI() {
        // 安全地更新DOM元素，避免在元素不存在时出错
        this.safelyUpdateElement('totalSessions', this.data.totalSessions);
        this.safelyUpdateElement('totalMinutes', this.data.totalMinutes);
        this.safelyUpdateElement('currentStreak', this.data.currentStreak);
    }
    
    /**
     * 安全地更新DOM元素内容
     * @param {string} id - 元素ID
     * @param {*} value - 要设置的值
     */
    safelyUpdateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// 冥想会话管理
class MeditationSession {
    constructor(dataManager) {
        console.log('初始化MeditationSession...');
        this.dataManager = dataManager;
        this.duration = 0; // 以分钟为单位
        this.remainingSeconds = 0;
        this.isPaused = true; // 默认为暂停状态
        this.isStarted = false; // 新增: 是否已开始
        this.timer = null;
        this.breathState = 'inhale'; // 吸气或呼气
        this.breathTimer = null;
        this.isFullscreen = false;
        
        // DOM元素
        this.timerElement = document.getElementById('timer');
        this.circleElement = document.getElementById('breathCircle');
        this.breathTextElement = document.getElementById('breathText');
        this.startPauseBtn = document.getElementById('startPauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.toggleMusicBtn = document.getElementById('toggleMusicBtn');
        this.sessionTimeSelect = document.getElementById('sessionTime');
        this.fullscreenToggle = document.getElementById('fullscreenToggle');
        
        // 创建粒子系统
        console.log('创建粒子系统...');
        this.particleSystem = new ParticleSystem();
        const contentElement = document.querySelector('.content');
        console.log('找到content元素:', contentElement);
        this.particleSystem.appendTo(contentElement);
        console.log('粒子系统已添加到页面');
        
        // 初始化事件监听器
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.startPauseBtn.addEventListener('click', () => this.toggleStartPause());
        this.resetBtn.addEventListener('click', () => this.reset());
        
        // 全屏模式切换
        if (this.fullscreenToggle) {
            this.fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());
        }
        
        // 更新按钮内部图标
        this.updateButtonIcons();
    }
    
    updateButtonIcons() {
        // 开始/暂停按钮添加播放图标
        this.startPauseBtn.innerHTML = '<div class="start-icon"></div>';
        
        // 重置按钮添加重置图标
        this.resetBtn.innerHTML = '<div class="reset-icon"></div>';
    }
    
    toggleStartPause() {
        if (!this.isStarted) {
            // 首次点击开始冥想
            this.start();
        } else {
            // 已开始，切换暂停/继续
            this.togglePause();
        }
    }
    
    start() {
        if (this.isPaused) {
            console.log('开始冥想会话...');
            this.isPaused = false;
            this.isStarted = true;
            
            // 更新按钮状态
            this.startPauseBtn.innerHTML = '<div class="pause-icon"></div>';
            this.startPauseBtn.setAttribute('aria-label', window.langManager ? window.langManager.getTranslation('pause') : '暂停');
            
            // 重新排列按钮顺序 - 暂停、重置、声音
            const controls = document.querySelector('.controls');
            controls.insertBefore(this.startPauseBtn, controls.firstChild); // 暂停按钮放在最前面
            
            // 显示重置按钮
            this.resetBtn.style.display = 'flex';
            this.resetBtn.disabled = false;
            
            // 初始化剩余时间
            if (!this.timer) {
                this.duration = parseInt(this.sessionTimeSelect.value);
                this.remainingSeconds = this.duration * 60;
                this.updateTimerDisplay();
            }
            
            // 启动计时器
            this.timer = setInterval(() => this.updateTimer(), 1000);
            
            // 启动呼吸动画
            this.startBreathAnimation();
            
            // 启动粒子动画
            console.log('尝试启动粒子动画...');
            this.particleSystem.start();
            
            // 禁用时长选择
            this.sessionTimeSelect.disabled = true;
            
            // 分发开始事件
            document.dispatchEvent(new Event('meditation:start'));
            console.log('冥想会话已开始');
        }
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.startPauseBtn.innerHTML = '<div class="start-icon"></div>';
            this.startPauseBtn.setAttribute('aria-label', window.langManager ? window.langManager.getTranslation('resume') : '继续');
            
            // 暂停计时器
            clearInterval(this.timer);
            this.timer = null;
            
            // 暂停呼吸动画
            this.pauseBreathAnimation();
            
            // 暂停粒子动画
            this.particleSystem.stop();
            
            // 分发暂停事件
            document.dispatchEvent(new Event('meditation:pause'));
        } else {
            // 继续状态
            this.startPauseBtn.innerHTML = '<div class="pause-icon"></div>';
            this.startPauseBtn.setAttribute('aria-label', window.langManager ? window.langManager.getTranslation('pause') : '暂停');
            
            // 重启计时器
            this.timer = setInterval(() => this.updateTimer(), 1000);
            
            // 继续呼吸动画
            this.resumeBreathAnimation();
            
            // 继续粒子动画
            this.particleSystem.start();
            
            // 恢复音乐播放（如果音乐是开启状态）
            if (window.audioManager && window.audioManager.isMusicPlaying) {
                window.audioManager.meditationMusic.play();
            }
            
            // 分发继续事件
            document.dispatchEvent(new Event('meditation:resume'));
        }
    }
    
    reset() {
        // 暂停计时器
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 停止呼吸动画
        this.stopBreathAnimation();
        
        // 停止粒子动画
        this.particleSystem.stop();
        
        // 重置状态
        this.isPaused = true;
        this.isStarted = false;
        
        // 重置UI
        this.timerElement.textContent = '00:00';
        this.breathTextElement.textContent = window.langManager ? window.langManager.getTranslation('ready') : '准备开始';
        
        // 重置圆圈样式
        this.circleElement.style.transform = 'scale(1)';
        this.circleElement.style.boxShadow = '0 10px 30px rgba(0, 123, 255, 0.15)';
        
        // 重置按钮状态
        this.startPauseBtn.innerHTML = '<div class="start-icon"></div>';
        this.startPauseBtn.setAttribute('aria-label', window.langManager ? window.langManager.getTranslation('start') : '开始冥想');
        
        // 隐藏重置按钮
        this.resetBtn.style.display = 'none';
        this.resetBtn.disabled = true;
        
        // 启用时长选择
        this.sessionTimeSelect.disabled = false;
        
        // 分发重置事件
        document.dispatchEvent(new Event('meditation:reset'));
    }
    
    updateTimer() {
        if (this.remainingSeconds > 0) {
            this.remainingSeconds--;
            this.updateTimerDisplay();
        } else {
            this.complete();
        }
    }
    
    complete() {
        console.log("[修复] 冥想完成，准备切换页面");
        
        // 清除定时器
        clearInterval(this.timer);
        this.timer = null;
        this.stopBreathAnimation();
        
        // 添加冥想记录
        this.dataManager.addSession(this.duration);
        
        // 显示完成消息
        this.breathTextElement.textContent = window.langManager ? window.langManager.getTranslation('completed') : '冥想完成';
        
        // 确保在全屏模式下退出全屏
        if (this.isFullscreen) {
            this.toggleFullscreen();
        }
        
        // 完全重置所有状态
        this.isPaused = true;
        this.isStarted = false;
        this.duration = 0;
        this.remainingSeconds = 0;
        this.breathState = 'inhale';
        
        // 重置UI状态
        this.resetUIAfterComplete();
        
        // 分发完成事件
        document.dispatchEvent(new Event('meditation:complete'));
        
        // 给页面一点时间更新，然后再切换页面
        setTimeout(() => {
            // 切换到统计页面
            try {
                console.log("[修复] 尝试切换到统计页面");
                
                // 验证页面导航器是否存在
                const navigator = window.pageNavigator;
                if (!navigator) {
                    console.error("[修复] 页面导航器不存在，尝试手动切换页面");
                    this.manuallyNavigateToStats();
                    return;
                }
                
                // 直接调用导航器切换页面
                navigator.navigateTo('stats-page');
                
                // 检查导航是否成功
                setTimeout(() => {
                    const statsPage = document.getElementById('page-stats');
                    if (statsPage && !statsPage.classList.contains('active')) {
                        console.error("[修复] 导航失败，尝试手动切换页面");
                        this.manuallyNavigateToStats();
                    }
                }, 100);
            } catch (error) {
                console.error("[修复] 导航期间出错:", error);
                this.manuallyNavigateToStats();
            }
            
            // 显示书签提示
            this.showBookmarkReminder();
        }, 300);
    }
    
    // 手动导航到统计页面的后备方法
    manuallyNavigateToStats() {
        console.log("[修复] 执行手动页面导航");
        
        try {
            // 隐藏所有页面
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => {
                page.classList.remove('active');
                console.log(`[修复] 移除页面激活状态: ${page.id}`);
            });
            
            // 显示统计页面
            const statsPage = document.getElementById('page-stats');
            if (statsPage) {
                statsPage.classList.add('active');
                console.log("[修复] 统计页面已激活");
                
                // 确保页面可见
                statsPage.style.display = 'flex';
                
                // 滚动到页面顶部
                window.scrollTo(0, 0);
            } else {
                console.error("[修复] 未找到统计页面元素 #page-stats");
                
                // 尝试通过其他方式查找
                const altStatsPage = document.querySelector('[data-page="stats-page"]');
                if (altStatsPage) {
                    console.log("[修复] 通过选择器找到统计页面");
                    altStatsPage.classList.add('active');
                    altStatsPage.style.display = 'flex';
                }
            }
            
            // 更新导航栏
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                const pageId = item.getAttribute('data-page');
                if (pageId === 'stats-page') {
                    item.classList.add('active');
                    console.log("[修复] 导航项已激活: stats-page");
                } else {
                    item.classList.remove('active');
                }
            });
        } catch (error) {
            console.error("[修复] 手动导航过程中出错:", error);
        }
    }
    
    // 将重置UI的逻辑分离出来
    resetUIAfterComplete() {
        // 重置按钮状态
        this.startPauseBtn.innerHTML = '<div class="start-icon"></div>';
        this.startPauseBtn.setAttribute('aria-label', window.langManager ? window.langManager.getTranslation('start') : '开始冥想');
        
        // 隐藏重置按钮
        this.resetBtn.style.display = 'none';
        this.resetBtn.disabled = true;
        
        // 重置UI
        this.timerElement.textContent = '00:00';
        
        // 启用时长选择
        this.sessionTimeSelect.disabled = false;
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.remainingSeconds / 60);
        const seconds = this.remainingSeconds % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        this.timerElement.textContent = display;
        
        // 如果在全屏模式下，也更新全屏模式的定时器
        if (this.isFullscreen && this.fullscreenTimer) {
            this.fullscreenTimer.textContent = display;
        }
    }
    
    startBreathAnimation() {
        // 停止现有动画
        this.stopBreathAnimation();
        
        // 设置基本类名
        this.circleElement.className = 'circle-animation';
        
        // 控制变量
        this.animationStartTime = Date.now();         // 动画开始时间
        this.animationPausedTime = 0;                 // 暂停时累计的时间
        this.lastBreathSwitchTime = Date.now();       // 上次呼吸状态切换时间
        this.totalAnimationDuration = 10000;          // 完整周期时长(ms): 吸气+呼气=10秒
        this.breathPhaseDuration = 5000;              // 单个呼吸阶段时长(ms): 5秒
        
        // 最大和最小缩放值
        const maxScale = 1.3;
        const minScale = 1.0;
        
        // 设置初始状态为呼气（放大）
        this.breathState = 'exhale';
        this.breathTextElement.textContent = window.langManager ? window.langManager.getTranslation('exhale') : '呼气';
        
        // 使用requestAnimationFrame进行流畅动画
        const animate = () => {
            if (this.isPaused) return;
            
            // 计算当前时间点
            const currentTime = Date.now();
            // 计算已经过去的时间(考虑暂停的时间)
            const elapsedTime = (currentTime - this.animationStartTime) - this.animationPausedTime;
            // 计算当前周期中的时间点(0-10000ms)
            const timeInCycle = elapsedTime % this.totalAnimationDuration;
            
            // 确定当前应该是哪个呼吸状态
            const shouldBeExhaling = timeInCycle < this.breathPhaseDuration;
            
            // 如果状态需要切换
            if ((shouldBeExhaling && this.breathState !== 'exhale') || 
                (!shouldBeExhaling && this.breathState !== 'inhale')) {
                
                // 记录状态切换时间
                this.lastBreathSwitchTime = currentTime;
                
                // 更新状态和文本
                if (shouldBeExhaling) {
                    this.breathState = 'exhale';
                    this.breathTextElement.textContent = window.langManager ? 
                        window.langManager.getTranslation('exhale') : '呼气';
                } else {
                    this.breathState = 'inhale';
                    this.breathTextElement.textContent = window.langManager ? 
                        window.langManager.getTranslation('inhale') : '吸气';
                }
            }
            
            // 计算缩放比例 - 平滑过渡
            let scale;
            if (shouldBeExhaling) {
                // 呼气阶段: 从小到大 (1.0 -> 1.3)
                const progress = timeInCycle / this.breathPhaseDuration; // 0-1
                scale = minScale + progress * (maxScale - minScale);
            } else {
                // 吸气阶段: 从大到小 (1.3 -> 1.0)
                const progress = (timeInCycle - this.breathPhaseDuration) / this.breathPhaseDuration; // 0-1
                scale = maxScale - progress * (maxScale - minScale);
            }
            
            // 应用变换
            this.circleElement.style.transform = `scale(${scale})`;
            
            // 根据比例计算阴影大小
            const shadowBlur = 10 + (scale - 1) * 40;
            const shadowOpacity = 0.15 + (scale - 1) * 0.1;
            this.circleElement.style.boxShadow = `0 ${shadowBlur}px ${shadowBlur * 3}px rgba(0, 123, 255, ${shadowOpacity})`;
            
            // 继续动画循环
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        // 开始动画循环
        this.animationFrameId = requestAnimationFrame(animate);
    }
    
    pauseBreathAnimation() {
        // 记录暂停开始时间
        this.pauseStartTime = Date.now();
        
        // 取消动画帧请求
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // 暂停圆圈动画
        this.circleElement.style.animationPlayState = 'paused';
    }
    
    resumeBreathAnimation() {
        // 如果之前有暂停
        if (this.pauseStartTime) {
            // 计算暂停的持续时间
            const pauseDuration = Date.now() - this.pauseStartTime;
            // 累加到总暂停时间
            this.animationPausedTime += pauseDuration;
            // 重置暂停开始时间
            this.pauseStartTime = 0;
        }
        
        // 重新开始动画
        const animate = () => {
            if (this.isPaused) return;
            
            // 计算当前时间点
            const currentTime = Date.now();
            // 计算已经过去的时间(考虑暂停的时间)
            const elapsedTime = (currentTime - this.animationStartTime) - this.animationPausedTime;
            // 计算当前周期中的时间点(0-10000ms)
            const timeInCycle = elapsedTime % this.totalAnimationDuration;
            
            // 确定当前应该是哪个呼吸状态
            const shouldBeExhaling = timeInCycle < this.breathPhaseDuration;
            
            // 如果状态需要切换
            if ((shouldBeExhaling && this.breathState !== 'exhale') || 
                (!shouldBeExhaling && this.breathState !== 'inhale')) {
                
                // 记录状态切换时间
                this.lastBreathSwitchTime = currentTime;
                
                // 更新状态和文本
                if (shouldBeExhaling) {
                    this.breathState = 'exhale';
                    this.breathTextElement.textContent = window.langManager ? 
                        window.langManager.getTranslation('exhale') : '呼气';
                } else {
                    this.breathState = 'inhale';
                    this.breathTextElement.textContent = window.langManager ? 
                        window.langManager.getTranslation('inhale') : '吸气';
                }
            }
            
            // 计算缩放比例 - 平滑过渡
            let scale;
            if (shouldBeExhaling) {
                // 呼气阶段: 从小到大 (1.0 -> 1.3)
                const progress = timeInCycle / this.breathPhaseDuration; // 0-1
                scale = 1.0 + progress * 0.3;
            } else {
                // 吸气阶段: 从大到小 (1.3 -> 1.0)
                const progress = (timeInCycle - this.breathPhaseDuration) / this.breathPhaseDuration; // 0-1
                scale = 1.3 - progress * 0.3;
            }
            
            // 应用变换
            this.circleElement.style.transform = `scale(${scale})`;
            
            // 根据比例计算阴影大小
            const shadowBlur = 10 + (scale - 1) * 40;
            const shadowOpacity = 0.15 + (scale - 1) * 0.1;
            this.circleElement.style.boxShadow = `0 ${shadowBlur}px ${shadowBlur * 3}px rgba(0, 123, 255, ${shadowOpacity})`;
            
            // 继续动画循环
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        // 重新开始动画
        this.animationFrameId = requestAnimationFrame(animate);
        
        // 恢复圆圈动画
        this.circleElement.style.animationPlayState = 'running';
    }
    
    stopBreathAnimation() {
        // 取消动画帧请求
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // 重置动画控制变量
        this.animationStartTime = 0;
        this.animationPausedTime = 0;
        this.lastBreathSwitchTime = 0;
        this.pauseStartTime = 0;
        
        // 重置圆圈类名和样式
        this.circleElement.className = 'circle-animation';
        this.circleElement.style.transform = 'scale(1)';
        this.circleElement.style.boxShadow = '0 10px 30px rgba(0, 123, 255, 0.15)';
        this.circleElement.style.animationPlayState = 'paused';
    }
    
    showBookmarkReminder() {
        const reminderElement = document.getElementById('bookmarkReminder');
        if (reminderElement) {
            reminderElement.classList.remove('hidden');
            
            const closeBtn = document.getElementById('closeReminderBtn');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    reminderElement.classList.add('hidden');
                    localStorage.setItem('bookmarkReminderClosed', 'true');
                };
            }
        }
    }
    
    toggleFullscreen() {
        if (!this.isFullscreen) {
            // 创建全屏模式元素
            const fullscreenEl = document.createElement('div');
            fullscreenEl.className = 'fullscreen-mode';
            fullscreenEl.id = 'fullscreenMode';
            
            // 添加定时器
            const timerEl = document.createElement('div');
            timerEl.className = 'timer';
            timerEl.textContent = this.timerElement.textContent;
            fullscreenEl.appendChild(timerEl);
            
            // 添加控制按钮
            const controlsOverlay = document.createElement('div');
            controlsOverlay.className = 'controls-overlay';
            
            // 返回按钮
            const backBtn = document.createElement('button');
            backBtn.className = 'control-btn back-btn';
            backBtn.innerHTML = '⬅️';
            backBtn.addEventListener('click', () => this.toggleFullscreen());
            
            // 播放/暂停按钮
            const playBtn = document.createElement('button');
            playBtn.className = 'control-btn play-btn';
            playBtn.innerHTML = this.isPaused ? '▶️' : '⏸️';
            playBtn.addEventListener('click', () => this.toggleStartPause());
            
            // 重置按钮
            const resetBtn = document.createElement('button');
            resetBtn.className = 'control-btn reset-btn';
            resetBtn.innerHTML = '🔄';
            resetBtn.addEventListener('click', () => this.reset());
            
            controlsOverlay.appendChild(backBtn);
            controlsOverlay.appendChild(playBtn);
            controlsOverlay.appendChild(resetBtn);
            fullscreenEl.appendChild(controlsOverlay);
            
            // 专注提示文字
            const focusText = document.createElement('div');
            focusText.className = 'focus-text';
            focusText.textContent = '专注';
            fullscreenEl.appendChild(focusText);
            
            // 添加到页面
            document.body.appendChild(fullscreenEl);
            
            // 更新全屏模式状态
            this.isFullscreen = true;
            this.fullscreenTimer = timerEl;
            this.fullscreenPlayBtn = playBtn;
            
            // 隐藏导航栏
            document.querySelector('.nav-bar').style.display = 'none';
        } else {
            // 移除全屏模式元素
            const fullscreenEl = document.getElementById('fullscreenMode');
            if (fullscreenEl) {
                document.body.removeChild(fullscreenEl);
            }
            
            // 更新全屏模式状态
            this.isFullscreen = false;
            this.fullscreenTimer = null;
            this.fullscreenPlayBtn = null;
            
            // 显示导航栏
            document.querySelector('.nav-bar').style.display = 'flex';
        }
    }
}

// 语言设置
class LanguageManager {
    constructor() {
        // 检测浏览器语言
        const userLang = this.getBrowserLanguage();
        console.log("检测到浏览器语言:", userLang);
        
        // 检查是否是首次访问（检查localStorage中是否已有语言设置）
        const savedLang = localStorage.getItem('preferredLanguage');
        console.log("localStorage中保存的语言:", savedLang || "无");
        
        // 只有当localStorage中有语言设置时才使用它，否则使用浏览器语言
        if (savedLang) {
            // 验证保存的语言是否在支持列表中
            const supportedLangs = ['zh', 'en', 'ja', 'ko'];
            if (supportedLangs.includes(savedLang)) {
                this.currentLanguage = savedLang;
                console.log("使用已保存的语言设置:", this.currentLanguage);
            } else {
                this.currentLanguage = userLang;
                console.log("已保存的语言不受支持，使用浏览器语言:", this.currentLanguage);
            }
        } else {
            this.currentLanguage = userLang;
            console.log("首次访问，使用浏览器语言:", this.currentLanguage);
            // 将初始语言保存到localStorage
            localStorage.setItem('preferredLanguage', this.currentLanguage);
        }
        
        this.languageSelect = document.getElementById('languageSelect');
        
        // 翻译文本
        this.translations = {
            zh: {
                title: '每日冥想 - 释放压力，提升健康',
                headerTitle: '每日冥想',
                headerSubtitle: '简单、轻量、有效的冥想工具',
                ready: '准备开始',
                start: '开始冥想',
                pause: '暂停',
                resume: '继续',
                reset: '重置',
                duration: '冥想时长',
                minutes: '分钟',
                stats: '您的冥想记录',
                totalSessions: '总冥想次数',
                totalMinutes: '总冥想分钟',
                streak: '连续天数',
                inhale: '吸气',
                exhale: '呼气',
                completed: '冥想完成',
                focus: '专注',
                benefits: '冥想的好处',
                benefit1Title: '减轻压力',
                benefit1Text: '研究表明，每天冥想10分钟可以显著降低焦虑和压力水平',
                benefit2Title: '改善睡眠',
                benefit2Text: '定期冥想有助于改善睡眠质量，缓解失眠问题',
                benefit3Title: '提高专注力',
                benefit3Text: '冥想训练可以增强注意力和集中力，提高工作效率',
                benefit4Title: '情绪管理',
                benefit4Text: '帮助您更好地理解和管理自己的情绪反应',
                whyUse: '为什么选择我们的网页冥想工具？',
                feature1Title: '超轻量',
                feature1Text: '仅需1KB书签空间，比动辄几十兆的App节省99.9%的设备空间',
                feature2Title: '无需安装',
                feature2Text: '直接在浏览器中使用，无需下载应用，无需注册账号',
                feature3Title: '跨平台',
                feature3Text: '在任何设备上都能使用 - 手机、平板、电脑均可访问',
                feature4Title: '数据隐私',
                feature4Text: '您的冥想数据仅保存在您的设备上，不会上传到服务器',
                bookmarkReminder: '💡 小提示: 将本页添加到书签，下次可直接访问您的个人冥想空间',
                understood: '明白了',
                footer: '© 2024 每日冥想 - 轻松开始冥想之旅',
                addToDeviceReminder: '添加冥想到您的设备，随时使用：',
                addToBookmark: '添加到收藏夹',
                addToHomeScreen: '添加到主屏幕',
                bookmarkShortcutInstructions: '请按 $KEY 将此页面添加到收藏夹',
                iosStep1: '点击浏览器底部的分享按钮 (箭头图标)',
                iosStep2: '滚动并点击"添加到主屏幕"选项',
                androidStep1: '点击浏览器右上角的菜单按钮 (⋮)',
                androidStep2: '点击"添加到主屏幕"或"安装应用"选项',
                pcStep1: '按 Ctrl+D (Windows) 或 ⌘+D (Mac) 添加到收藏夹',
                meditationTab: '冥想',
                statsTab: '统计',
                benefitsTab: '好处'
            },
            en: {
                title: 'Daily Meditation - Release Stress, Improve Health',
                headerTitle: 'Daily Meditation',
                headerSubtitle: 'Simple, lightweight, effective meditation tool',
                ready: 'Ready to start',
                start: 'Start Meditation',
                pause: 'Pause',
                resume: 'Resume',
                reset: 'Reset',
                duration: 'Meditation duration',
                minutes: 'minutes',
                stats: 'Your Meditation Records',
                totalSessions: 'Total Sessions',
                totalMinutes: 'Total Minutes',
                streak: 'Current Streak',
                inhale: 'Inhale',
                exhale: 'Exhale',
                completed: 'Meditation Completed',
                focus: 'Focus',
                benefits: 'Benefits of Meditation',
                benefit1Title: 'Reduce Stress',
                benefit1Text: 'Studies show that 10 minutes of daily meditation can significantly reduce anxiety and stress levels',
                benefit2Title: 'Improve Sleep',
                benefit2Text: 'Regular meditation helps improve sleep quality and relieve insomnia',
                benefit3Title: 'Increase Focus',
                benefit3Text: 'Meditation training enhances attention and concentration, improving work efficiency',
                benefit4Title: 'Emotional Management',
                benefit4Text: 'Helps you better understand and manage your emotional responses',
                whyUse: 'Why Choose Our Web Meditation Tool?',
                feature1Title: 'Ultra-lightweight',
                feature1Text: 'Only needs 1KB bookmark space, saving 99.9% device space compared to apps that take tens of MB',
                feature2Title: 'No Installation',
                feature2Text: 'Use directly in your browser, no app download or account registration needed',
                feature3Title: 'Cross-platform',
                feature3Text: 'Can be used on any device - phone, tablet, computer',
                feature4Title: 'Data Privacy',
                feature4Text: 'Your meditation data is saved only on your device, not uploaded to any server',
                bookmarkReminder: '💡 Tip: Add this page to your bookmarks for easy access to your personal meditation space',
                understood: 'Got it',
                footer: '© 2024 Daily Meditation - Start your meditation journey easily',
                addToDeviceReminder: 'Add this meditation tool to your device for quick access:',
                addToBookmark: 'Add to Bookmarks',
                addToHomeScreen: 'Add to Home Screen',
                bookmarkShortcutInstructions: 'Press $KEY to add this page to your bookmarks',
                iosStep1: 'Tap the share button (arrow icon) at the bottom of the browser',
                iosStep2: 'Scroll and tap "Add to Home Screen" option',
                androidStep1: 'Tap the menu button (⋮) in the top-right corner of your browser',
                androidStep2: 'Tap "Add to Home Screen" or "Install App" option',
                pcStep1: 'Press Ctrl+D (Windows) or ⌘+D (Mac) to add to bookmarks',
                meditationTab: 'Meditation',
                statsTab: 'Stats',
                benefitsTab: 'Benefits'
            },
            ja: {
                title: '毎日瞑想 - ストレス解放、健康増進',
                headerTitle: '毎日瞑想',
                headerSubtitle: 'シンプル、軽量、効果的な瞑想ツール',
                ready: '開始準備完了',
                start: '瞑想を始める',
                pause: '一時停止',
                resume: '再開',
                reset: 'リセット',
                duration: '瞑想時間',
                minutes: '分',
                stats: 'あなたの瞑想記録',
                totalSessions: '合計セッション',
                totalMinutes: '合計時間（分）',
                streak: '連続日数',
                inhale: '吸う',
                exhale: '吐く',
                completed: '瞑想完了',
                focus: '集中',
                benefits: '瞑想の効果',
                benefit1Title: 'ストレス軽減',
                benefit1Text: '研究によると、毎日10分間の瞑想が不安やストレスレベルを大幅に低下させることが示されています',
                benefit2Title: '睡眠改善',
                benefit2Text: '定期的な瞑想は睡眠の質を向上させ、不眠症を緩和します',
                benefit3Title: '集中力向上',
                benefit3Text: '瞑想トレーニングは注意力と集中力を高め、仕事の効率を向上させます',
                benefit4Title: '感情管理',
                benefit4Text: '感情的な反応をより良く理解し管理するのに役立ちます',
                whyUse: 'なぜウェブ瞑想ツールを選ぶのか？',
                feature1Title: '超軽量',
                feature1Text: 'わずか1KBのブックマークスペースで、数十MBを要するアプリと比較して99.9%のデバイススペースを節約',
                feature2Title: 'インストール不要',
                feature2Text: 'ブラウザで直接使用、アプリのダウンロードやアカウント登録が不要',
                feature3Title: 'クロスプラットフォーム',
                feature3Text: 'あらゆるデバイスで使用可能 - スマートフォン、タブレット、パソコン',
                feature4Title: 'データプライバシー',
                feature4Text: '瞑想データはお使いのデバイスにのみ保存され、サーバーにアップロードされません',
                bookmarkReminder: '💡 ヒント：このページをブックマークに追加すると、個人の瞑想スペースに簡単にアクセスできます',
                understood: '了解',
                footer: '© 2024 毎日瞑想 - 簡単に瞑想の旅を始めましょう',
                addToDeviceReminder: 'いつでも使えるようにデバイスに瞑想ツールを追加：',
                addToBookmark: 'ブックマークに追加',
                addToHomeScreen: 'ホーム画面に追加',
                bookmarkShortcutInstructions: '$KEY を押してこのページをブックマークに追加してください',
                iosStep1: 'ブラウザ下部の共有ボタン（矢印アイコン）をタップ',
                iosStep2: 'スクロールして「ホーム画面に追加」を選択',
                androidStep1: 'ブラウザの右上のメニューボタン (⋮) をタップ',
                androidStep2: '「ホーム画面に追加」または「アプリをインストール」を選択',
                pcStep1: 'Ctrl+D (Windows) または ⌘+D (Mac) を押してブックマークに追加',
                meditationTab: '瞑想',
                statsTab: '統計',
                benefitsTab: '効果'
            },
            ko: {
                title: '매일 명상 - 스트레스 해소, 건강 증진',
                headerTitle: '매일 명상',
                headerSubtitle: '간단하고 가벼우며 효과적인 명상 도구',
                ready: '시작 준비',
                start: '명상 시작',
                pause: '일시 중지',
                resume: '재개',
                reset: '재설정',
                duration: '명상 시간',
                minutes: '분',
                stats: '귀하의 명상 기록',
                totalSessions: '총 세션 수',
                totalMinutes: '총 시간(분)',
                streak: '연속 일수',
                inhale: '들이쉬기',
                exhale: '내쉬기',
                completed: '명상 완료',
                focus: '집중',
                benefits: '명상의 이점',
                benefit1Title: '스트레스 감소',
                benefit1Text: '연구에 따르면 매일 10분의 명상이 불안과 스트레스 수준을 크게 낮출 수 있습니다',
                benefit2Title: '수면 개선',
                benefit2Text: '규칙적인 명상은 수면의 질을 향상시키고 불면증을 완화합니다',
                benefit3Title: '집중력 향상',
                benefit3Text: '명상 훈련은 주의력과 집중력을 강화하여 업무 효율성을 높입니다',
                benefit4Title: '감정 관리',
                benefit4Text: '감정적 반응을 더 잘 이해하고 관리하는 데 도움이 됩니다',
                whyUse: '왜 웹 명상 도구를 선택해야 할까요?',
                feature1Title: '초경량',
                feature1Text: '1KB 북마크 공간만 필요하며, 수십 MB를 차지하는 앱에 비해 99.9%의 장치 공간을 절약합니다',
                feature2Title: '설치 불필요',
                feature2Text: '브라우저에서 직접 사용, 앱 다운로드나 계정 등록이 필요 없습니다',
                feature3Title: '크로스 플랫폼',
                feature3Text: '모든 장치에서 사용 가능 - 휴대폰, 태블릿, 컴퓨터',
                feature4Title: '데이터 개인 정보 보호',
                feature4Text: '명상 데이터는 사용자의 장치에만 저장되며 서버에 업로드되지 않습니다',
                bookmarkReminder: '💡 팁: 이 페이지를 북마크에 추가하여 개인 명상 공간에 쉽게 접근하세요',
                understood: '알겠습니다',
                footer: '© 2024 매일 명상 - 쉽게 명상 여정을 시작하세요',
                addToDeviceReminder: '명상 도구를 기기에 추가하여 언제든지 사용하세요:',
                addToBookmark: '북마크에 추가',
                addToHomeScreen: '홈 화면에 추가',
                bookmarkShortcutInstructions: '$KEY 키를 눌러 이 페이지를 북마크에 추가하세요',
                iosStep1: '브라우저 하단의 공유 버튼(화살표 아이콘)을 탭하세요',
                iosStep2: '스크롤하여 "홈 화면에 추가" 옵션을 탭하세요',
                androidStep1: '브라우저의 오른쪽 상단 모서리에 있는 메뉴 버튼(⋮)을 탭하세요',
                androidStep2: '"홈 화면에 추가" 또는 "앱 설치" 옵션을 탭하세요',
                pcStep1: 'Ctrl+D(Windows) 또는 ⌘+D(Mac)를 눌러 북마크에 추가하세요',
                meditationTab: '명상',
                statsTab: '통계',
                benefitsTab: '효과'
            }
        };
        
        // 设置语言选择器的值
        if (this.languageSelect) {
            this.languageSelect.value = this.currentLanguage;
            console.log("设置语言选择器为:", this.currentLanguage);
        } else {
            console.error("语言选择器元素未找到!");
        }
        
        // 事件监听
        if (this.languageSelect) {
            this.languageSelect.addEventListener('change', () => {
                this.setLanguage(this.languageSelect.value);
            });
        }
        
        // 初始化应用语言
        this.applyLanguage();
    }
    
    getBrowserLanguage() {
        // 获取浏览器语言，处理形如 'zh-CN', 'en-US' 等格式
        let browserLang = navigator.language || navigator.userLanguage || 'en';
        console.log("原始浏览器语言设置:", browserLang);
        
        // 如果语言代码包含短横线，只取前面部分
        if (browserLang.indexOf('-') !== -1) {
            browserLang = browserLang.split('-')[0];
        }
        
        // 检查是否在我们支持的语言列表中
        const supportedLangs = ['zh', 'en', 'ja', 'ko'];
        if (!supportedLangs.includes(browserLang)) {
            console.log("不支持的语言，使用默认语言(英文)");
            return 'en'; // 默认使用英文
        }
        
        return browserLang;
    }
    
    getTranslation(key) {
        // 确保当前语言存在于translations中
        if (!this.translations[this.currentLanguage]) {
            console.log("当前语言不支持，回退到中文");
            this.currentLanguage = 'zh';
        }
        return this.translations[this.currentLanguage][key] || key;
    }
    
    setLanguage(lang) {
        // 确保切换的语言存在
        if (!this.translations[lang]) {
            console.error(`不支持的语言: ${lang}`);
            return;
        }
        
        console.log(`切换语言从 ${this.currentLanguage} 到 ${lang}`);
        this.currentLanguage = lang;
        localStorage.setItem('preferredLanguage', lang);
        this.applyLanguage();
        
        // 使用新的全局方法更新书签管理器文本
        if (window.updateBookmarkTexts && typeof window.updateBookmarkTexts === 'function') {
            window.updateBookmarkTexts();
            console.log('已通过全局方法更新书签管理器文本');
        }
    }
    
    applyLanguage() {
        try {
            // 修改页面标题
            document.title = this.getTranslation('title');
            
            // 更新导航栏文本
            const navItems = document.querySelectorAll('.nav-item');
            if (navItems.length >= 3) {
                navItems[0].textContent = this.getTranslation('meditationTab');
                navItems[1].textContent = this.getTranslation('statsTab');
                navItems[2].textContent = this.getTranslation('benefitsTab');
            }
            
            // 更新页脚文本
            const footerText = document.getElementById('footerText');
            if (footerText) {
                footerText.textContent = this.getTranslation('footer');
            }
            
            // 更新所有页面的header标题和副标题
            const pages = document.querySelectorAll('.page');
            pages.forEach(page => {
                const header = page.querySelector('header');
                if (header) {
                    const h1 = header.querySelector('h1');
                    const p = header.querySelector('p');
                    if (h1) h1.textContent = this.getTranslation('headerTitle');
                    if (p) p.textContent = this.getTranslation('headerSubtitle');
                }
            });
            
            // 冥想页面标题和副标题
            const meditationHeader = document.querySelector('#meditation-page header');
            if (meditationHeader) {
                const h1 = meditationHeader.querySelector('h1');
                const p = meditationHeader.querySelector('p');
                if (h1) h1.textContent = this.getTranslation('headerTitle');
                if (p) p.textContent = this.getTranslation('headerSubtitle');
            }
            
            // 统计页面标题
            const statsHeader = document.querySelector('#stats-page header');
            if (statsHeader) {
                const h1 = statsHeader.querySelector('h1');
                if (h1) h1.textContent = this.getTranslation('stats');
            }
            
            // 好处页面标题
            const benefitsHeader = document.querySelector('#benefits-page header');
            if (benefitsHeader) {
                const h1 = benefitsHeader.querySelector('h1');
                if (h1) h1.textContent = this.getTranslation('benefits');
            }
            
            // 冥想控制
            const breathText = document.getElementById('breathText');
            if (breathText) {
                // 保持当前的呼吸状态文本
                if (breathText.textContent.includes('准备') || breathText.textContent.includes('Ready') || 
                    breathText.textContent.includes('開始') || breathText.textContent.includes('시작')) {
                    breathText.textContent = this.getTranslation('ready');
                } else if (breathText.textContent.includes('吸') || breathText.textContent.includes('Inhale') || 
                          breathText.textContent.includes('吸う') || breathText.textContent.includes('들이쉬기')) {
                    breathText.textContent = this.getTranslation('inhale');
                } else if (breathText.textContent.includes('呼') || breathText.textContent.includes('Exhale') || 
                          breathText.textContent.includes('吐く') || breathText.textContent.includes('내쉬기')) {
                    breathText.textContent = this.getTranslation('exhale');
                } else if (breathText.textContent.includes('完成') || breathText.textContent.includes('Completed') || 
                          breathText.textContent.includes('完了') || breathText.textContent.includes('완료')) {
                    breathText.textContent = this.getTranslation('completed');
                }
            }
            
            // 开始/暂停按钮文本更新
            const startPauseBtn = document.getElementById('startPauseBtn');
            if (startPauseBtn) {
                // 检查当前按钮状态，根据具体状态设置文本
                const session = window.meditationSession;
                if (session && session.isStarted) {
                    if (session.isPaused) {
                        startPauseBtn.setAttribute('aria-label', this.getTranslation('resume'));
                    } else {
                        startPauseBtn.setAttribute('aria-label', this.getTranslation('pause'));
                    }
                } else {
                    // 默认为开始状态
                    startPauseBtn.setAttribute('aria-label', this.getTranslation('start'));
                }
            }
            
            // 暂停和播放按钮状态保持不变，只更新全屏模式下的专注文本
            const focusText = document.querySelector('.focus-text');
            if (focusText) {
                focusText.textContent = this.getTranslation('focus') || '专注';
            }
            
            // 设置"分钟"文本
            const minutesText = document.getElementById('minutesText');
            if (minutesText) {
                minutesText.textContent = this.getTranslation('minutes');
            }
            
            const sessionLabel = document.querySelector('.session-settings label');
            if (sessionLabel) {
                sessionLabel.textContent = this.getTranslation('duration') + ' (' + this.getTranslation('minutes') + '):';
            }
            
            // 统计数据
            const statLabels = document.querySelectorAll('.stat-label');
            if (statLabels.length >= 3) {
                statLabels[0].textContent = this.getTranslation('totalSessions');
                statLabels[1].textContent = this.getTranslation('totalMinutes');
                statLabels[2].textContent = this.getTranslation('streak');
            }
            
            // 书签提示
            const bookmarkReminderP = document.querySelector('.bookmark-reminder p');
            if (bookmarkReminderP) {
                bookmarkReminderP.textContent = this.getTranslation('bookmarkReminder');
            }
            
            const closeReminderBtn = document.getElementById('closeReminderBtn');
            if (closeReminderBtn) {
                closeReminderBtn.textContent = this.getTranslation('understood');
            }
            
            // "添加冥想到您的设备"提示 - 修正为获取正确的元素和翻译键
            const addToDeviceReminderP = document.querySelector('#bookmarkAddHomeReminder .reminder-content p');
            if (addToDeviceReminderP) {
                addToDeviceReminderP.textContent = this.getTranslation('addToDeviceReminder');
            }
            
            // 修正：使用正确的ID来找到添加到收藏夹和主屏幕按钮
            const addToBookmarkBtn = document.getElementById('add-to-bookmark');
            if (addToBookmarkBtn) {
                const textElement = addToBookmarkBtn.querySelector('.action-text');
                if (textElement) {
                    textElement.textContent = this.getTranslation('addToBookmark');
                }
            }
            
            const addToHomeBtn = document.getElementById('add-to-home');
            if (addToHomeBtn) {
                const textElement = addToHomeBtn.querySelector('.action-text');
                if (textElement) {
                    textElement.textContent = this.getTranslation('addToHomeScreen');
                }
            }
            
            // 移除不再需要的代码
            // 保留兼容性代码，以防旧版ID仍在使用
            const addBookmarkBtn = document.getElementById('addBookmarkBtn');
            if (addBookmarkBtn) {
                addBookmarkBtn.textContent = this.getTranslation('addToBookmark');
            }
            
            const addHomeScreenBtn = document.getElementById('addHomeScreenBtn');
            if (addHomeScreenBtn) {
                addHomeScreenBtn.textContent = this.getTranslation('addToHomeScreen');
            }
            
            // 冥想好处
            const benefitItems = document.querySelectorAll('.benefit-item');
            if (benefitItems.length >= 4) {
                benefitItems[0].querySelector('h3').textContent = this.getTranslation('benefit1Title');
                benefitItems[0].querySelector('p').textContent = this.getTranslation('benefit1Text');
                benefitItems[1].querySelector('h3').textContent = this.getTranslation('benefit2Title');
                benefitItems[1].querySelector('p').textContent = this.getTranslation('benefit2Text');
                benefitItems[2].querySelector('h3').textContent = this.getTranslation('benefit3Title');
                benefitItems[2].querySelector('p').textContent = this.getTranslation('benefit3Text');
                benefitItems[3].querySelector('h3').textContent = this.getTranslation('benefit4Title');
                benefitItems[3].querySelector('p').textContent = this.getTranslation('benefit4Text');
            }
            
            // 为什么使用我们的工具
            const whyUseH2 = document.querySelector('.why-use h2');
            if (whyUseH2) {
                whyUseH2.textContent = this.getTranslation('whyUse');
            }
            
            const features = document.querySelectorAll('.feature');
            if (features.length >= 4) {
                features[0].querySelector('h3').textContent = this.getTranslation('feature1Title');
                features[0].querySelector('p').textContent = this.getTranslation('feature1Text');
                features[1].querySelector('h3').textContent = this.getTranslation('feature2Title');
                features[1].querySelector('p').textContent = this.getTranslation('feature2Text');
                features[2].querySelector('h3').textContent = this.getTranslation('feature3Title');
                features[2].querySelector('p').textContent = this.getTranslation('feature3Text');
                features[3].querySelector('h3').textContent = this.getTranslation('feature4Title');
                features[3].querySelector('p').textContent = this.getTranslation('feature4Text');
            }
            
            // 页脚
            const footerP = document.querySelector('footer p');
            if (footerP) {
                footerP.textContent = this.getTranslation('footer');
            }
            
            // 全局暴露语言管理器，以便在动态创建的指令中使用
            window.langManager = this;
        } catch (e) {
            console.error('应用语言时出错:', e);
        }
    }
}

// 修复版页面导航管理
class FixedPageNavigator {
    constructor() {
        // 延迟初始化，确保DOM完全加载
        setTimeout(() => this.initialize(), 0);
    }
    
    initialize() {
        console.log("[修复版] 开始初始化页面导航器");
        
        // 查找页面和导航项元素
        this.pages = document.querySelectorAll('.page');
        this.navItems = document.querySelectorAll('.nav-item');
        
        console.log("[修复版] 查找到页面数量:", this.pages.length);
        console.log("[修复版] 查找到导航项数量:", this.navItems.length);
        
        // 获取当前活跃页面ID
        const activePage = document.querySelector('.page.active');
        this.currentPage = activePage ? activePage.id : null;
        
        console.log("[修复版] 当前活跃页面:", this.currentPage);
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 为每个导航项添加点击事件
        this.navItems.forEach(item => {
            const pageId = item.getAttribute('data-page');
            console.log("[修复版] 设置导航项:", pageId);
            
            // 移除旧的事件监听器（如果有的话）
            if (item._navigationHandler) {
                item.removeEventListener('click', item._navigationHandler);
            }
            
            // 创建新的事件处理函数并保存引用
            item._navigationHandler = () => {
                console.log("[修复版] 导航项被点击:", pageId);
                this.navigateTo(pageId);
            };
            
            // 添加新的事件监听器
            item.addEventListener('click', item._navigationHandler);
            
            // 添加键盘事件支持
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.navigateTo(pageId);
                }
            });
        });
    }
    
    navigateTo(pageId) {
        console.log("[修复版] 开始导航到:", pageId);
        
        if (!pageId) {
            console.error("[修复版] 无效的页面ID");
            return;
        }
        
        // 将data-page值转换为实际页面ID
        const targetPageId = pageId.startsWith('page-') ? pageId : `page-${pageId.replace('-page', '')}`;
        
        console.log("[修复版] 目标页面ID:", targetPageId);
        
        // 不要重复切换到当前页面
        if (targetPageId === this.currentPage) {
            console.log("[修复版] 已经在当前页面，不需要切换");
            return;
        }
        
        // 查找目标页面元素
        const targetPage = document.getElementById(targetPageId);
        if (!targetPage) {
            console.error(`[修复版] 未找到目标页面元素: ${targetPageId}`);
            return;
        }
        
        // 更新当前页面标记
        this.currentPage = targetPageId;
        
        // 更新导航栏激活状态
        this.navItems.forEach(item => {
            const itemPageId = item.getAttribute('data-page');
            if (itemPageId === pageId || `page-${itemPageId}` === targetPageId) {
                item.classList.add('active');
                item.setAttribute('aria-current', 'page');
            } else {
                item.classList.remove('active');
                item.removeAttribute('aria-current');
            }
        });
        
        // 使用 requestAnimationFrame 优化页面切换动画
        requestAnimationFrame(() => {
            // 先将所有页面设置为非活动状态
            this.pages.forEach(page => {
                if (page.id === targetPageId) {
                    page.classList.add('active');
                    page.setAttribute('aria-hidden', 'false');
                    page.style.display = 'flex';
                    console.log(`[修复版] 页面 ${page.id} 已激活`);
                } else {
                    page.classList.remove('active');
                    page.setAttribute('aria-hidden', 'true');
                    page.style.display = 'none';
                }
            });
        });
        
        // 触发自定义事件，通知其他组件页面已切换
        const event = new CustomEvent('pageChanged', {
            detail: {
                previousPage: this.currentPage,
                currentPage: targetPageId
            }
        });
        document.dispatchEvent(event);
    }
}

// 书签和添加到主屏幕管理
class BookmarkAndHomeScreenManager {
    constructor() {
        this.hasShownBookmarkReminder = localStorage.getItem('hasShownBookmarkReminder') === 'true';
        this.hasShownAddToHomeReminder = localStorage.getItem('hasShownAddToHomeReminder') === 'true';
        this.isAndroid = navigator.userAgent.match(/Android/i);
        this.isiOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);
        this.isMobile = this.isAndroid || this.isiOS;
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        
        // 更新为新的收藏模块元素
        this.reminderContainer = document.getElementById('bookmarkAddHomeReminder');
        this.bookmarkBtn = document.getElementById('add-to-bookmark');
        this.homeScreenBtn = document.getElementById('add-to-home');
        this.closeReminderBtn = document.getElementById('closeAddHomeReminderBtn');
        
        this.setupEventListeners();
        this.checkAndShowReminder();
        
        // 为语言管理器提供更新文本的方法
        window.updateBookmarkTexts = this.updateTexts.bind(this);
    }
    
    setupEventListeners() {
        if (this.closeReminderBtn) {
            this.closeReminderBtn.addEventListener('click', () => {
                this.hideReminder();
                localStorage.setItem('hasShownBookmarkReminder', 'true');
                localStorage.setItem('hasShownAddToHomeReminder', 'true');
                // 设置关闭时间戳，用于延迟显示
                localStorage.setItem('reminderDismissedTime', Date.now().toString());
            });
        }
        
        if (this.bookmarkBtn) {
            this.bookmarkBtn.addEventListener('click', () => {
                this.showBookmarkInstructions();
            });
        }
        
        if (this.homeScreenBtn) {
            this.homeScreenBtn.addEventListener('click', () => {
                this.showAddToHomeInstructions();
            });
        }
    }
    
    hideReminder() {
        if (this.reminderContainer) {
            this.reminderContainer.classList.add('hidden');
        }
    }
    
    checkAndShowReminder() {
        // 如果在独立模式下运行或已永久关闭提示，则不显示
        if (this.isStandalone) {
            return;
        }
        
        const hasAddedToHomeScreen = localStorage.getItem('addedToHomeScreen') === 'true';
        const hasBookmarked = localStorage.getItem('hasBookmarked') === 'true';
        const reminderDismissedTime = localStorage.getItem('reminderDismissedTime');
        const now = Date.now();
        
        // 如果提示被关闭的时间不到3天，则不显示
        if (reminderDismissedTime && now - parseInt(reminderDismissedTime) < 3 * 24 * 60 * 60 * 1000) {
            return;
        }
        
        // 如果已经添加到主屏幕和收藏夹，则不显示
        if (hasAddedToHomeScreen && hasBookmarked) {
            return;
        }
        
        // 显示提示
        setTimeout(() => {
            if (this.reminderContainer && !this.reminderContainer.classList.contains('hidden')) {
                // 应用动画效果
                this.reminderContainer.style.opacity = '0';
                this.reminderContainer.style.display = 'flex';
                
                setTimeout(() => {
                    this.reminderContainer.style.opacity = '1';
                }, 50);
            }
        }, 2000); // 页面加载2秒后显示
    }
    
    showBookmarkInstructions() {
        let instructions = '';
        let title = '';
        
        // 检查是否有语言管理器并获取当前语言
        const langManager = window.langManager;
        const currentLang = langManager ? langManager.currentLanguage : 'zh';
        
        if (currentLang === 'en') {
            title = 'How to Add Bookmarks';
        } else if (currentLang === 'ja') {
            title = 'ブックマークの追加方法';
        } else if (currentLang === 'ko') {
            title = '북마크 추가 방법';
        } else {
            title = '如何添加书签';
        }
        
        if (this.isiOS && navigator.userAgent.match(/CriOS/i)) {
            // Chrome on iOS
            if (currentLang === 'en') {
                instructions = 'Tap the menu button (⋮) in the top right corner of your browser, then select "Add to Bookmarks". You can quickly access this meditation tool from your bookmarks next time you open Chrome.';
            } else if (currentLang === 'ja') {
                instructions = 'ブラウザの右上にある⋮メニューボタンをタップし、「ブックマークに追加」を選択してください。次回Chromeを開く際に、ブックマークからこの瞑想ツールにすぐにアクセスできます。';
            } else if (currentLang === 'ko') {
                instructions = '브라우저 오른쪽 상단의 ⋮ 메뉴 버튼을 탭한 다음 "북마크에 추가"를 선택하세요. 다음에 Chrome을 열 때 북마크에서 이 명상 도구에 빠르게 접근할 수 있습니다.';
            } else {
                instructions = '点击浏览器右上角的⋮菜单按钮，然后选择"添加到书签"选项。下次打开Chrome时，您可以在书签中快速访问此冥想工具。';
            }
        } else if (this.isiOS && navigator.userAgent.match(/Safari/i)) {
            // Safari on iOS
            if (currentLang === 'en') {
                instructions = 'Tap the share button (□↑) at the bottom, then scroll and select "Add to Bookmarks". You can quickly access this meditation tool from your bookmarks next time you open Safari.';
            } else if (currentLang === 'ja') {
                instructions = '下部の共有ボタン（□↑）をタップし、スクロールして「ブックマークに追加」を選択してください。次回Safariを開く際に、ブックマークからこの瞑想ツールにすぐにアクセスできます。';
            } else if (currentLang === 'ko') {
                instructions = '하단의 공유 버튼(□↑)을 탭한 다음 스크롤하여 "북마크에 추가"를 선택하세요. 다음에 Safari를 열 때 북마크에서 이 명상 도구에 빠르게 접근할 수 있습니다.';
            } else {
                instructions = '点击底部的分享按钮 □↑，然后滚动并选择"添加到书签"选项。下次打开Safari时，您可以在书签中快速访问此冥想工具。';
            }
        } else if (this.isAndroid) {
            // Android
            if (currentLang === 'en') {
                instructions = 'Tap the menu button (⋮) in the top right corner of your browser, then select "Add to Bookmarks" (★). You can access this meditation tool anytime from your browser\'s bookmarks menu.';
            } else if (currentLang === 'ja') {
                instructions = 'ブラウザの右上にある⋮メニューボタンをタップし、★「ブックマークに追加」を選択してください。ブラウザのブックマークメニューからいつでもこの瞑想ツールにアクセスできます。';
            } else if (currentLang === 'ko') {
                instructions = '브라우저 오른쪽 상단의 ⋮ 메뉴 버튼을 탭한 다음 ★"북마크에 추가"를 선택하세요. 브라우저의 북마크 메뉴에서 언제든지 이 명상 도구에 액세스할 수 있습니다.';
            } else {
                instructions = '点击浏览器右上角的⋮菜单按钮，然后选择★"添加到书签"选项。您可以在浏览器的书签菜单中随时访问此冥想工具。';
            }
        } else {
            // Desktop
            if (currentLang === 'en') {
                instructions = 'Press Ctrl+D (Windows) or Cmd+D (Mac) to add this page to your bookmarks. You can also click the star (★) icon in your browser\'s address bar.';
            } else if (currentLang === 'ja') {
                instructions = 'このページをブックマークに追加するには、Ctrl+D（Windows）またはCmd+D（Mac）を押してください。またはブラウザのアドレスバーの右側にある★アイコンをクリックすることもできます。';
            } else if (currentLang === 'ko') {
                instructions = '이 페이지를 북마크에 추가하려면 Ctrl+D(Windows) 또는 Cmd+D(Mac)를 누르세요. 브라우저 주소 표시줄의 오른쪽에 있는 ★ 아이콘을 클릭할 수도 있습니다.';
            } else {
                instructions = '按下键盘上的 Ctrl+D (Windows) 或 Cmd+D (Mac) 将此页面添加到书签。您也可以点击浏览器地址栏右侧的★图标添加书签。';
            }
        }
        
        this.showAlert(title, instructions);
        localStorage.setItem('hasShownBookmarkReminder', 'true');
    }
    
    showAddToHomeInstructions() {
        let instructions = '';
        let title = '';
        
        // 检查是否有语言管理器并获取当前语言
        const langManager = window.langManager;
        const currentLang = langManager ? langManager.currentLanguage : 'zh';
        
        if (currentLang === 'en') {
            title = 'Add to Home Screen';
        } else if (currentLang === 'ja') {
            title = 'ホーム画面に追加';
        } else if (currentLang === 'ko') {
            title = '홈 화면에 추가';
        } else {
            title = '添加到主屏幕';
        }
        
        if (this.isiOS && navigator.userAgent.match(/Safari/i)) {
            // Safari on iOS
            if (currentLang === 'en') {
                instructions = 'Tap the share button (□↑) at the bottom, then select "Add to Home Screen". The meditation tool will appear on your home screen like a native app, supporting offline use.';
            } else if (currentLang === 'ja') {
                instructions = '下部の共有ボタン（□↑）をタップし、「ホーム画面に追加」を選択してください。この瞑想ツールはネイティブアプリのようにホーム画面に表示され、オフラインでも使用できます。';
            } else if (currentLang === 'ko') {
                instructions = '하단의 공유 버튼(□↑)을 탭한 다음 "홈 화면에 추가"를 선택하세요. 명상 도구가 네이티브 앱처럼 홈 화면에 나타나며 오프라인 사용을 지원합니다.';
            } else {
                instructions = '点击底部的分享按钮 □↑，然后选择"添加到主屏幕"选项。这样冥想工具就会像原生应用一样出现在您的主屏幕上，支持离线使用。';
            }
        } else if (this.isAndroid) {
            // Android
            if (currentLang === 'en') {
                instructions = 'Tap the menu button (⋮) in the top right corner of your browser, then select "Add to Home Screen". The meditation tool will appear on your home screen like an app, supporting offline use.';
            } else if (currentLang === 'ja') {
                instructions = 'ブラウザの右上にある⋮メニューボタンをタップし、「ホーム画面に追加」を選択してください。この瞑想ツールはアプリのようにホーム画面に表示され、オフラインでも使用できます。';
            } else if (currentLang === 'ko') {
                instructions = '브라우저 오른쪽 상단의 ⋮ 메뉴 버튼을 탭한 다음 "홈 화면에 추가"를 선택하세요. 명상 도구가 앱처럼 홈 화면에 나타나며 오프라인 사용을 지원합니다.';
            } else {
                instructions = '点击浏览器右上角的⋮菜单按钮，然后选择"添加到主屏幕"选项。这样冥想工具就会像应用一样出现在您的主屏幕上，支持离线使用。';
            }
        } else {
            // 不支持的浏览器
            if (currentLang === 'en') {
                instructions = 'Your current browser does not support adding to home screen. Please visit this page using Safari (iOS) or Chrome (Android) on a mobile device to use this feature.';
            } else if (currentLang === 'ja') {
                instructions = '現在のブラウザはホーム画面への追加をサポートしていません。この機能を使用するには、モバイルデバイスのSafari（iOS）またはChrome（Android）でこのページにアクセスしてください。';
            } else if (currentLang === 'ko') {
                instructions = '현재 브라우저는 홈 화면에 추가하기 기능을 지원하지 않습니다. 이 기능을 사용하려면 모바일 기기에서 Safari(iOS) 또는 Chrome(Android)을 사용하여 이 페이지를 방문하세요.';
            } else {
                instructions = '您当前的浏览器不支持添加到主屏幕功能。请使用移动设备上的Safari (iOS)或Chrome (Android)访问此页面以使用此功能。';
            }
        }
        
        this.showAlert(title, instructions);
        localStorage.setItem('hasShownAddToHomeReminder', 'true');
    }
    
    // 优化提示显示
    showAlert(title, message) {
        if ('alert' in window) {
            alert(`${title}\n\n${message}`);
        } else {
            console.log(`${title}: ${message}`);
        }
    }
    
    // 添加一个更新文本的方法，供语言管理器调用
    updateTexts() {
        if (!window.langManager) return;
        
        // 获取翻译
        const reminderText = window.langManager.getTranslation('addToDeviceReminder');
        const bookmarkText = window.langManager.getTranslation('addToBookmark');
        const homeScreenText = window.langManager.getTranslation('addToHomeScreen');
        
        // 更新提示文本
        if (this.reminderContainer) {
            const textElement = this.reminderContainer.querySelector('.reminder-content p');
            if (textElement) {
                textElement.textContent = reminderText;
            }
        }
        
        // 更新按钮文本
        if (this.bookmarkBtn) {
            const textElement = this.bookmarkBtn.querySelector('.action-text');
            if (textElement) {
                textElement.textContent = bookmarkText;
            }
        }
        
        if (this.homeScreenBtn) {
            const textElement = this.homeScreenBtn.querySelector('.action-text');
            if (textElement) {
                textElement.textContent = homeScreenText;
            }
        }
    }
}

/**
 * 音频管理类
 */
class AudioManager {
    constructor() {
        this.toggleMusicBtn = document.getElementById('toggleMusicBtn');
        this.musicIcon = this.toggleMusicBtn.querySelector('.music-icon');
        this.meditationMusic = document.getElementById('meditationMusic');
        this.isMusicPlaying = false;

        this.init();
    }

    init() {
        // 初始隐藏音乐按钮（在开始冥想前）
        this.toggleMusicBtn.style.display = 'none';
        
        // 绑定事件
        this.toggleMusicBtn.addEventListener('click', () => this.toggleMusic());
        
        // 监听冥想会话状态
        document.addEventListener('meditation:start', () => this.onMeditationStart());
        document.addEventListener('meditation:pause', () => this.onMeditationPause());
        document.addEventListener('meditation:reset', () => this.onMeditationReset());
        document.addEventListener('meditation:complete', () => this.onMeditationComplete());
    }
    
    toggleMusic() {
        if (this.isMusicPlaying) {
            // 关闭音乐
            this.isMusicPlaying = false;
            this.meditationMusic.pause();
            this.toggleMusicBtn.classList.remove('active');
            this.toggleMusicBtn.classList.add('inactive');
            this.musicIcon.textContent = '🔇';
        } else {
            // 开启音乐
            this.isMusicPlaying = true;
            // 如果冥想正在进行，就播放音乐
            const meditationSession = window.meditationSession;
            if (meditationSession && meditationSession.isStarted && !meditationSession.isPaused) {
                this.meditationMusic.play();
            }
            this.toggleMusicBtn.classList.add('active');
            this.toggleMusicBtn.classList.remove('inactive');
            this.musicIcon.textContent = '🎵';
        }
    }
    
    onMeditationStart() {
        // 显示音乐控制按钮
        this.toggleMusicBtn.style.display = 'flex';
        
        // 默认开启音乐
        if (!this.isMusicPlaying) {
            this.toggleMusic(); // 切换为开启状态
        } else {
            // 如果已经是开启状态，直接播放
            this.meditationMusic.play();
        }
    }
    
    onMeditationPause() {
        // 暂停音乐
        if (this.isMusicPlaying) {
            this.meditationMusic.pause();
        }
    }
    
    onMeditationReset() {
        // 隐藏音乐控制按钮
        this.toggleMusicBtn.style.display = 'none';
        
        // 停止音乐
        this.meditationMusic.pause();
        this.meditationMusic.currentTime = 0;
        
        // 保持音乐按钮状态，但不播放
        if (!this.isMusicPlaying) {
            this.toggleMusicBtn.classList.remove('active');
            this.toggleMusicBtn.classList.add('inactive');
            this.musicIcon.textContent = '🔇';
        } else {
            this.toggleMusicBtn.classList.add('active');
            this.toggleMusicBtn.classList.remove('inactive');
            this.musicIcon.textContent = '🎵';
        }
    }
    
    onMeditationComplete() {
        // 隐藏音乐控制按钮
        this.toggleMusicBtn.style.display = 'none';
        
        // 停止音乐
        this.meditationMusic.pause();
        this.meditationMusic.currentTime = 0;
    }
}

/**
 * 性能监控类 - 用于监控和记录应用性能
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.enabled = true;
        this.startTimes = {};
        this.initPerformanceAPI();
    }
    
    /**
     * 初始化性能API
     */
    initPerformanceAPI() {
        if (!window.performance) {
            console.warn('性能API不可用，性能监控已禁用');
            this.enabled = false;
            return;
        }
        
        // 记录页面加载性能指标
        if (window.performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    this.recordPageLoadMetrics();
                }, 0);
            });
        }
    }
    
    /**
     * 开始测量特定操作的性能
     * @param {string} name - 操作名称
     */
    startMeasure(name) {
        if (!this.enabled) return;
        
        this.startTimes[name] = performance.now();
    }
    
    /**
     * 结束测量特定操作的性能并记录
     * @param {string} name - 操作名称
     */
    endMeasure(name) {
        if (!this.enabled || !this.startTimes[name]) return;
        
        const duration = performance.now() - this.startTimes[name];
        this.recordMetric(name, duration);
        delete this.startTimes[name];
        
        return duration;
    }
    
    /**
     * 记录性能指标
     * @param {string} name - 指标名称
     * @param {number} value - 指标值
     */
    recordMetric(name, value) {
        if (!this.enabled) return;
        
        if (!this.metrics[name]) {
            this.metrics[name] = {
                values: [],
                min: Number.MAX_VALUE,
                max: 0,
                avg: 0,
                count: 0
            };
        }
        
        const metric = this.metrics[name];
        metric.values.push(value);
        metric.min = Math.min(metric.min, value);
        metric.max = Math.max(metric.max, value);
        metric.count++;
        
        // 计算平均值
        let sum = 0;
        for (let i = 0; i < metric.values.length; i++) {
            sum += metric.values[i];
        }
        metric.avg = sum / metric.count;
        
        // 限制存储的值数量
        if (metric.values.length > 100) {
            metric.values = metric.values.slice(-100);
        }
    }
    
    /**
     * 记录页面加载性能指标
     */
    recordPageLoadMetrics() {
        if (!this.enabled || !window.performance.timing) return;
        
        const timing = window.performance.timing;
        
        // 计算关键指标
        const metrics = {
            'DNS查询': timing.domainLookupEnd - timing.domainLookupStart,
            '连接时间': timing.connectEnd - timing.connectStart,
            '首字节时间(TTFB)': timing.responseStart - timing.requestStart,
            '响应时间': timing.responseEnd - timing.responseStart,
            'DOM解析': timing.domInteractive - timing.responseEnd,
            'DOM完成': timing.domComplete - timing.domInteractive,
            '页面加载完成': timing.loadEventEnd - timing.navigationStart
        };
        
        // 记录指标
        for (const name in metrics) {
            this.recordMetric(name, metrics[name]);
        }
    }
    
    /**
     * 获取收集的性能指标
     * @returns {Object} 性能指标对象
     */
    getMetrics() {
        return this.metrics;
    }
    
    /**
     * 打印性能报告到控制台
     */
    logReport() {
        if (!this.enabled) {
            console.warn('性能监控已禁用');
            return;
        }
        
        console.group('性能报告');
        
        for (const name in this.metrics) {
            const metric = this.metrics[name];
            console.log(`${name}: 平均 ${metric.avg.toFixed(2)}ms, 最小 ${metric.min.toFixed(2)}ms, 最大 ${metric.max.toFixed(2)}ms, 样本数 ${metric.count}`);
        }
        
        console.groupEnd();
    }
}

// 书签提示管理
class BookmarkReminderManager {
    constructor() {
        this.reminderElement = document.getElementById('bookmarkAddHomeReminder');
        this.closeButton = document.getElementById('closeAddHomeReminderBtn');
        this.storageKey = 'bookmarkReminderHidden';
        
        this.init();
    }
    
    init() {
        // 检查是否已经隐藏过提示
        const isHidden = localStorage.getItem(this.storageKey) === 'true';
        if (isHidden) {
            this.reminderElement.style.display = 'none';
        }
        
        // 添加关闭按钮事件监听
        this.closeButton.addEventListener('click', () => this.hideReminder());
    }
    
    hideReminder() {
        this.reminderElement.style.display = 'none';
        localStorage.setItem(this.storageKey, 'true');
    }
}

/**
 * 当DOM内容加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', function() {
    try {
        // 注册Service Worker - 仅在支持的环境下尝试注册
        if ('serviceWorker' in navigator) {
            // 检查当前环境是否支持Service Worker (HTTPS或localhost)
            const isLocalhost = window.location.hostname === 'localhost' || 
                                window.location.hostname === '127.0.0.1';
            const isHttps = window.location.protocol === 'https:';
            
            if (isHttps || isLocalhost) {
                navigator.serviceWorker.register('sw.js')
                    .then(registration => {
                        console.log('Service Worker 注册成功，范围：', registration.scope);
                    })
                    .catch(error => {
                        console.log('Service Worker 注册失败：', error);
                    });
            } else {
                console.log('当前环境不支持Service Worker，需要HTTPS或localhost环境');
            }
        }
        
        // 获取或创建用户ID
        const userId = getUserId();
        
        // 初始化冥想数据管理器
        const dataManager = new MeditationData(userId);
        
        // 更新统计UI
        dataManager.updateStatsUI();
        
        // 初始化语言管理器
        const langManager = new LanguageManager();
        window.langManager = langManager; // 将语言管理器暴露给全局，方便其他组件使用
        
        // 初始化修复版页面导航
        const pageNav = new FixedPageNavigator();
        window.pageNavigator = pageNav; // 将页面导航器暴露给全局
        
        // 初始化冥想会话
        const session = new MeditationSession(dataManager);
        window.meditationSession = session; // 将冥想会话暴露给全局
        
        // 初始化书签和添加到主屏幕管理器
        const bookmarkManager = new BookmarkAndHomeScreenManager();
        window.bookmarkManager = bookmarkManager; // 将书签管理器暴露给全局
        
        // 清理旧数据
        cleanupOldData();
        
        // 如果是通过书签或分享链接访问，则显示书签提示
        if (window.location.search.includes('id=')) {
            const bookmarkReminder = document.getElementById('bookmarkReminder');
            if (bookmarkReminder && !localStorage.getItem('bookmarkReminderClosed')) {
                bookmarkReminder.classList.remove('hidden');
            }
        }
        
        // 关闭书签提示
        const closeReminderBtn = document.getElementById('closeReminderBtn');
        if (closeReminderBtn) {
            closeReminderBtn.addEventListener('click', function() {
                document.getElementById('bookmarkReminder').classList.add('hidden');
                localStorage.setItem('bookmarkReminderClosed', 'true');
            });
        }

        // 初始化音频管理器
        window.audioManager = new AudioManager();
        
        // 创建音频文件目录（如果需要）
        createAudioDirectoryIfNeeded();

        // 初始化性能监控
        window.performanceMonitor = new PerformanceMonitor();
        
        // 通过性能API记录初始化时间
        if (window.performance) {
            const perfNow = performance.now();
            console.log(`应用初始化完成，用时 ${Math.round(perfNow)}ms`);
            window.performanceMonitor.recordMetric('应用初始化', perfNow);
        }

        new BookmarkReminderManager();
    } catch (error) {
        console.error('应用初始化失败:', error);
        // 显示友好的错误消息给用户
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.textContent = '应用加载时出现问题，请刷新页面重试。';
        document.body.prepend(errorContainer);
    }
});

/**
 * 浏览器窗口大小改变时调整UI
 */
window.addEventListener('resize', debounce(function() {
    // 重新调整UI布局
    adjustUIForScreenSize();
}, 250));

/**
 * 防抖函数 - 限制函数在一段时间内的调用频率
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间(毫秒)
 * @return {Function} 防抖处理后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * 根据屏幕大小调整UI
 */
function adjustUIForScreenSize() {
    // 使用媒体查询API检测屏幕大小
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isSmallScreen = window.matchMedia('(max-width: 480px)').matches;
    
    // 根据屏幕调整冥想圆圈大小
    const breathCircle = document.getElementById('breathCircle');
    if (breathCircle) {
        const baseSize = isMobile ? 150 : 200;
        const adjustedSize = isSmallScreen ? Math.min(130, window.innerWidth * 0.4) : baseSize;
        breathCircle.style.width = `${adjustedSize}px`;
        breathCircle.style.height = `${adjustedSize}px`;
    }
}

/**
 * 清理旧数据 - 优化版本
 */
function cleanupOldData() {
    try {
        const keys = Object.keys(localStorage);
        const now = new Date();
        let cleanedItems = 0;
        
        // 使用过滤器先筛选出冥想数据键
        const meditationDataKeys = keys.filter(key => key.startsWith('meditation_data_'));
        
        if (meditationDataKeys.length === 0) {
            return; // 没有冥想数据，直接返回
        }
        
        // 设置一个常量作为过期天数阈值
        const EXPIRATION_DAYS = 60;
        const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
        
        meditationDataKeys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                
                if (data && data.lastSessionDate) {
                    const lastDate = new Date(data.lastSessionDate);
                    const daysDiff = Math.floor((now - lastDate) / MILLISECONDS_PER_DAY);
                    
                    // 如果超过过期天数没有更新，删除数据
                    if (daysDiff > EXPIRATION_DAYS) {
                        localStorage.removeItem(key);
                        cleanedItems++;
                    }
                } else {
                    // 数据结构不完整或无上次会话日期
                    localStorage.removeItem(key);
                    cleanedItems++;
                }
            } catch (e) {
                // 如果某个项解析失败，移除它
                localStorage.removeItem(key);
                cleanedItems++;
                console.warn(`移除无效的数据项: ${key}`, e);
            }
        });
        
        if (cleanedItems > 0) {
            console.log(`已清理 ${cleanedItems} 个过期数据项`);
        }
    } catch (error) {
        console.error('清理旧数据时出错:', error);
        // 失败时不影响应用正常使用
    }
}

// 注册PWA安装事件
window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默认的安装提示
    e.preventDefault();
    // 保存事件用于稍后触发
    window.deferredPrompt = e;
});

/**
 * 确保音频文件存在
 */
function createAudioDirectoryIfNeeded() {
    // 这里可以添加检查音频文件是否存在，如果不存在则创建的逻辑
    console.log('检查音频文件...');
} 