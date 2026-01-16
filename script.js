
// --- 1. 配置区域 ---
const filtersConfig = [
    { id: 'school', label: '学院' },
    { id: 'length', label: '对戏长度' },
    { id: 'tendency', label: '倾向' }
];

// 全局变量定义
let database = {};
let wishData = [];
let siteConfig = {};

const searchInput = document.getElementById('searchInput');
const filtersContainer = document.getElementById('filtersContainer');
const display = document.getElementById('result');
const clearBtn = document.getElementById('clearBtn');
const selectElements = {};

// --- 2. 数据加载 ---
async function loadData() {
    try {
        const [charRes, wishRes, configRes] = await Promise.all([
            fetch('characters.json'),
            fetch('wishes.json'),
            fetch('config.json')
        ]);

        if (!charRes.ok || !wishRes.ok || !configRes.ok) {
            throw new Error("数据加载失败");
        }

        database = await charRes.json();
        wishData = await wishRes.json();
        siteConfig = await configRes.json();

        // 数据加载完成后，初始化界面
        initFilters();
        renderRules();
        renderLinks();
        renderWishWall();

        // 初始搜索显示默认消息
        performSearch();
        showToast("✅ 数据加载成功！");
    } catch (err) {
        console.error("加载数据失败:", err);
        showToast("❌ 数据加载失败，请检查配置文件");
        document.getElementById('result').innerHTML = "<div class='empty-tip'>无法加载数据，请联系管理员。</div>";
    }
}

// --- 3. 初始化 ---
function initFilters() {
    // 给状态筛选器添加监听
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', performSearch);
    }

    filtersConfig.forEach(config => {
        const select = document.createElement('select');
        select.className = 'dynamic-select';
        select.dataset.key = config.id;

        const defaultOption = document.createElement('option');
        defaultOption.value = 'all';
        defaultOption.innerText = '全部' + config.label;
        select.appendChild(defaultOption);

        if (config.id === 'length') {
            const fixedOptions = ["句", "段", "长段", "屏"];
            fixedOptions.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                select.appendChild(opt);
            });
        } else {
            const uniqueValues = new Set();
            for (let key in database) {
                const val = database[key].tags[config.id];
                if (val) uniqueValues.add(val);
            }
            uniqueValues.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;
                select.appendChild(opt);
            });
        }

        select.addEventListener('change', performSearch);
        filtersContainer.appendChild(select);
        selectElements[config.id] = select;
    });
}

function renderRules() {
    const container = document.getElementById('rulesContainer');
    if (!container || !siteConfig.rules) return;

    let html = '';
    siteConfig.rules.forEach(rule => {
        if (rule.type === 'tip') {
            html += `
                <div class="tip-card">
                    <span class="tip-icon">${rule.icon}</span>
                    <div class="tip-text">
                        <strong>${rule.title}</strong> ${rule.content}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="rules-box">
                    <h3>${rule.title}</h3>
                    ${rule.content ? `<p>${rule.content}</p>` : ''}
                    ${rule.items ? `
                        <ul class="rules-list">
                            ${rule.items.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        }
    });
    container.innerHTML = html;
}

function renderLinks() {
    const container = document.getElementById('linkGrid');
    if (!container || !siteConfig.links) return;

    let html = '';
    siteConfig.links.forEach(link => {
        html += `
            <a href="${link.url}" target="_blank" class="link-card">
                <div class="link-icon">${link.icon}</div>
                <div class="link-title">${link.title}</div>
            </a>
        `;
    });
    container.innerHTML = html;
}

function renderWishWall() {
    const container = document.getElementById('wishWallContainer');
    if (!container) return;

    let html = '';
    wishData.forEach(item => {
        html += `
            <div class="wish-card">
                <div class="wish-content">${item.text}</div>
                <div class="wish-footer">—— ${item.author}</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function clearAllFilters() {
    searchInput.value = '';
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.value = 'all';

    for (let key in selectElements) selectElements[key].value = 'all';
    performSearch();
    showToast("筛选已清空");
}

// --- 4. 搜索逻辑 ---
function performSearch() {
    const rawSearch = searchInput.value.trim();
    const searchText = rawSearch.toLowerCase();

    const statusFilter = document.getElementById('statusFilter');
    const statusVal = statusFilter ? statusFilter.value : 'all';

    checkSearchEasterEggs(searchText);

    const activeFilters = {};
    filtersConfig.forEach(config => {
        if (selectElements[config.id]) {
            const val = selectElements[config.id].value;
            if (val !== 'all') activeFilters[config.id] = val;
        }
    });

    display.innerHTML = "";
    let foundCount = 0;

    if (Object.keys(database).length === 0) {
        display.innerHTML = "<div class='empty-tip'>正在加载数据...</div>";
        return;
    }

    if (!searchText && Object.keys(activeFilters).length === 0 && statusVal === 'all') {
        display.innerHTML = "<div class='empty-tip'>请搜索或选择筛选条件...</div>";
        return;
    }

    for (let key in database) {
        const item = database[key];
        const isTextMatch = !searchText || key.toLowerCase().includes(searchText) || item.desc.toLowerCase().includes(searchText);

        const isUnoccupied = item.desc.includes("状态: 未被占用");
        let isStatusMatch = true;
        if (statusVal === 'occupied' && isUnoccupied) isStatusMatch = false;
        if (statusVal === 'unoccupied' && !isUnoccupied) isStatusMatch = false;

        let isFilterMatch = true;
        for (let filterKey in activeFilters) {
            const requiredValue = activeFilters[filterKey];
            const itemValue = item.tags[filterKey] || "";

            if (filterKey === 'length') {
                const valuesArray = itemValue.split('/');
                if (!valuesArray.includes(requiredValue)) {
                    isFilterMatch = false;
                    break;
                }
            } else {
                if (itemValue !== requiredValue) {
                    isFilterMatch = false;
                    break;
                }
            }
        }

        if (isTextMatch && isFilterMatch && isStatusMatch) {
            foundCount++;
            renderItem(key, item, activeFilters);
        }
    }

    if (foundCount === 0) {
        display.innerHTML = "<div class='empty-tip' style='color:#ff8a80'>❌ 未找到匹配项</div>";
    }
}

function renderItem(key, data, activeFilters) {
    const itemDiv = document.createElement("div");
    itemDiv.className = "result-item";
    let tagsHtml = '';

    filtersConfig.forEach(config => {
        const tagValue = data.tags[config.id];
        if (tagValue) {
            let isMatched = false;
            if (config.id === 'length' && activeFilters[config.id]) {
                isMatched = tagValue.split('/').includes(activeFilters[config.id]);
            } else {
                isMatched = activeFilters[config.id] === tagValue;
            }
            const highlightClass = isMatched ? 'matched' : '';
            tagsHtml += `<span class="tag-badge ${highlightClass}">${tagValue}</span>`;
        }
    });
    itemDiv.innerHTML = `
        <div class="result-header"><span class="result-key">${key}</span></div>
        <div class="tags-display">${tagsHtml}</div>
        <div class="result-desc">${data.desc}</div>
    `;
    display.appendChild(itemDiv);
}

// --- 5. 季节特效 ---
function initSeasonalEffects() {
    const now = new Date();
    const month = now.getMonth() + 1;
    let seasonType = '';
    let particleChar = '';
    if (month >= 3 && month <= 5) { seasonType = 'spring'; particleChar = '🌸'; }
    else if (month >= 6 && month <= 8) { seasonType = 'summer'; particleChar = '🍃'; }
    else if (month >= 9 && month <= 11) { seasonType = 'autumn'; particleChar = '🍁'; }
    else { seasonType = 'winter'; particleChar = '❄️'; }

    setInterval(() => { createParticle(particleChar, seasonType); }, 300);
}

function createParticle(char, type, isEasterEgg = false) {
    const particle = document.createElement('div');
    particle.classList.add(isEasterEgg ? 'easter-egg-particle' : 'seasonal-particle');
    particle.innerText = char;
    particle.style.left = Math.random() * 100 + 'vw';
    particle.style.fontSize = (Math.random() * 10 + 10) + 'px';
    const duration = Math.random() * 7 + 5;
    particle.style.animationName = 'fall';
    particle.style.animationDuration = (isEasterEgg ? 3 : duration) + 's';

    if (type === 'winter') {
        particle.style.opacity = Math.random() * 0.5 + 0.5;
        particle.style.filter = 'drop-shadow(0 0 2px white)';
    }

    document.body.appendChild(particle);
    setTimeout(() => { particle.remove(); }, (isEasterEgg ? 3000 : duration * 1000));
}

// --- 6. 彩蛋逻辑 ---
function checkSearchEasterEggs(text) {
    if (text === 'peroro' || text === '佩洛洛' || text === 'hifumi') {
        triggerPeroroRain();
    }
    if (text === 'order' || text === '点菜' || text === '吃吃') {
        showToast("今天想吃点什么？");
    }
}

function triggerPeroroRain() {
    if (document.body.dataset.raining === 'true') return;
    document.body.dataset.raining = 'true';
    showToast("检测到佩洛洛大人！");

    let count = 0;
    const rain = setInterval(() => {
        createParticle('🐥', 'none', true);
        count++;
        if (count > 50) {
            clearInterval(rain);
            document.body.dataset.raining = 'false';
        }
    }, 100);
}

let titleClickCount = 0;
const mainTitle = document.getElementById('mainTitle');
if (mainTitle) {
    mainTitle.addEventListener('click', () => {
        titleClickCount++;
        if (titleClickCount === 5) {
            mainTitle.classList.add('shake');
            showToast("⚡ Arona：不要玩弄菜单！");
            setTimeout(() => mainTitle.classList.remove('shake'), 500);
            titleClickCount = 0;
        }
    });
}

const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;
document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            toggleRainbowMode();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function toggleRainbowMode() {
    if (document.body.classList.contains('rainbow-mode')) {
        document.body.classList.remove('rainbow-mode');
        showToast("已退出彩光模式");
    } else {
        document.body.classList.add('rainbow-mode');
        showToast("🌈 彩光模式启动！");
    }
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(function () { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- 7. 页面切换逻辑 ---
function switchPage(pageId, btnElement) {
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'flex';
        setTimeout(() => targetPage.classList.add('active'), 10);
    }
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }
}

// --- 8. 自动保存与回填逻辑 ---
const formFields = ['q1', 'q2', 'q3', 'q5', 'q6', 'q7'];
function initAutoSave() {
    formFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const savedVal = localStorage.getItem('peroro_audit_' + id);
            if (savedVal) el.value = savedVal;

            el.addEventListener('input', () => {
                localStorage.setItem('peroro_audit_' + id, el.value);
                el.classList.remove('error');
                document.getElementById('group-' + id)?.classList.remove('error');
            });
        }
    });
    const savedQ4 = localStorage.getItem('peroro_audit_q4');
    if (savedQ4) {
        const checkedValues = JSON.parse(savedQ4);
        document.querySelectorAll('input[name="q4"]').forEach(cb => {
            if (checkedValues.includes(cb.value)) cb.checked = true;
        });
    }

    document.querySelectorAll('input[name="q4"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = [];
            document.querySelectorAll('input[name="q4"]:checked').forEach(c => checked.push(c.value));
            localStorage.setItem('peroro_audit_q4', JSON.stringify(checked));
            document.getElementById('group-q4').classList.remove('error');
        });
    });
}

// --- 9. 审核表单复制逻辑 ---
function copyAuditForm() {
    const requiredFields = [
        { id: 'q1', name: '1. 偏主动还是被动' },
        { id: 'q2', name: '2. XP' },
        { id: 'q3', name: '3. 雷区' },
        { id: 'q5', name: '5. 语c生涯' },
        { id: 'q6', name: '6. 角色介绍' },
        { id: 'q7', name: '7. 自戏' }
    ];

    let hasError = false;
    let firstErrorId = null;

    requiredFields.forEach(field => {
        const el = document.getElementById(field.id);
        if (!el || !el.value.trim()) {
            hasError = true;
            el?.classList.add('error');
            document.getElementById('group-' + field.id)?.classList.add('error');
            if (!firstErrorId) firstErrorId = field.id;
        }
    });
    const q4Checked = document.querySelectorAll('input[name="q4"]:checked');
    if (q4Checked.length === 0) {
        hasError = true;
        document.getElementById('group-q4')?.classList.add('error');
        if (!firstErrorId) firstErrorId = 'group-q4';
    }

    if (hasError) {
        if (navigator.vibrate) navigator.vibrate(200);
        showToast("❌ 请填写所有带 * 的必填项！");
        const errorEl = document.getElementById(firstErrorId);
        if (errorEl) errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const q1 = document.getElementById('q1').value;
    const q2 = document.getElementById('q2').value;
    const q3 = document.getElementById('q3').value;
    let q4 = [];
    q4Checked.forEach(el => q4.push(el.value));
    const q4Str = q4.join(' / ');
    const q5 = document.getElementById('q5').value;
    const q6 = document.getElementById('q6').value;
    const q7 = document.getElementById('q7').value;

    const finalText = `【入群审核卡】
--------------------------------
1. 偏主动还是被动？
答：${q1}

2. XP是？
答：${q2}

3. 雷区是？
答：${q3}

4. 对戏长度？
答：${q4Str}

5. 语c文爱生涯大概多久/是否有经验？
答：${q5}

6. 角色介绍（原因/个性/互动）
答：${q6}

7. 自戏
答：${q7}
--------------------------------`;

    navigator.clipboard.writeText(finalText).then(() => {
        showToast("✅ 审核单已复制！请发送给管理员");
    }).catch(err => {
        console.error('复制失败: ', err);
        showToast("❌ 复制失败，请手动截图或复制");
    });
}

// --- 启动 ---
loadData();
initSeasonalEffects();
initAutoSave();

if (searchInput) {
    searchInput.addEventListener('input', performSearch);
}
if (clearBtn) {
    clearBtn.addEventListener('click', clearAllFilters);
}
