// Chart Global Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.06)';
Chart.defaults.scale.ticks.color = 'rgba(255, 255, 255, 0.5)';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 10, 26, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;

// Global State
let token = null;
let userRole = null;
let currentUsername = null;

let globalData = {
    admissions: [],
    beds: [],
    labs: [],
    forecast: {},
    anomalies: {},
    conflicts: [],
    summary: {}
};

// Colors
const colors = {
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6'
};

const API_BASE = 'https://changing-utilities-slot-rapid.trycloudflare.com/api';

async function init() {
    updateTime();
    setInterval(updateTime, 60000);
    setupTabs();
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('update-beds-form').addEventListener('submit', handleUpdateBeds);
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
    
    document.getElementById('toggle-register-btn').addEventListener('click', (e) => {
        e.preventDefault();
        const loginForm = document.getElementById('login-form');
        const regForm = document.getElementById('register-form');
        const title = document.getElementById('login-title');
        const btn = document.getElementById('toggle-register-btn');
        if (loginForm.style.display !== 'none') {
            loginForm.style.display = 'none';
            regForm.style.display = 'block';
            title.textContent = 'Register as Patient';
            btn.textContent = 'Already have an account? Login';
        } else {
            loginForm.style.display = 'block';
            regForm.style.display = 'none';
            title.textContent = 'Unified Hospital Login';
            btn.textContent = "Don't have an account? Register";
        }
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-success').style.display = 'none';
    });
    
    // Check local storage for token
    const savedToken = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    const savedUsername = localStorage.getItem('username');
    
    if (savedToken && savedRole) {
        token = savedToken;
        userRole = savedRole;
        currentUsername = savedUsername;
        showApp();
    }
}

function updateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const el = document.getElementById('current-time');
    if (el) el.textContent = now.toLocaleDateString('en-US', options);
}

function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) throw new Error('Login failed');
        
        const data = await res.json();
        token = data.token;
        userRole = data.role;
        currentUsername = username;
        
        localStorage.setItem('token', token);
        localStorage.setItem('role', userRole);
        localStorage.setItem('username', username);
        
        showApp();
    } catch (err) {
        errorEl.textContent = 'Login failed. Please check your username and password.';
        errorEl.style.display = 'block';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('login-error');
    const successEl = document.getElementById('login-success');
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) throw new Error('Registration failed');
        
        successEl.textContent = 'Registration successful! You can now login.';
        successEl.style.display = 'block';
        document.getElementById('toggle-register-btn').click(); // toggle back to login
        document.getElementById('username').value = username;
        document.getElementById('password').value = '';
    } catch(err) {
        errorEl.textContent = 'Registration failed. Username may already exist.';
        errorEl.style.display = 'block';
    }
}

function handleLogout() {
    token = null;
    userRole = null;
    currentUsername = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    
    document.getElementById('login-overlay').classList.add('active');
    document.getElementById('app-content').style.display = 'none';
}

async function showApp() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('user-role').textContent = userRole.toUpperCase();
    
    configureRoleUI();
    
    document.getElementById('loading-overlay').classList.remove('hidden');
    try {
        await loadData();
        renderDashboard();
    } catch (e) {
        console.error("Failed to load dashboard data", e);
    } finally {
        setTimeout(() => {
            document.getElementById('loading-overlay').classList.add('hidden');
        }, 500);
    }
}

function configureRoleUI() {
    // Hide all tabs first
    const tabs = ['nav-capacity', 'nav-bottleneck', 'nav-data', 'nav-brief', 'nav-patient-list', 'nav-my-portal', 'nav-user-management'];
    tabs.forEach(t => document.getElementById(t).style.display = 'none');
    document.getElementById('admin-controls').style.display = 'none';
    
    const role = userRole.toLowerCase();
    
    let defaultTab = '';
    
    if (role === 'admin') {
        ['nav-capacity', 'nav-bottleneck', 'nav-data', 'nav-brief', 'nav-user-management'].forEach(t => document.getElementById(t).style.display = '');
        document.getElementById('admin-controls').style.display = 'flex';
        defaultTab = 'nav-capacity';
    } 
    else if (role === 'doctor') {
        ['nav-bottleneck', 'nav-patient-list'].forEach(t => document.getElementById(t).style.display = '');
        defaultTab = 'nav-bottleneck';
    }
    else if (role === 'employee') {
        ['nav-capacity', 'nav-brief'].forEach(t => document.getElementById(t).style.display = '');
        defaultTab = 'nav-capacity';
    }
    else if (role === 'patient') {
        ['nav-my-portal'].forEach(t => document.getElementById(t).style.display = '');
        defaultTab = 'nav-my-portal';
    }
    
    if (defaultTab) {
        document.getElementById(defaultTab).click();
    }
}

async function fetchAPI(endpoint) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to load ${endpoint}`);
    return await res.json();
}

async function loadData() {
    const role = userRole.toLowerCase();
    
    // Patient has limited data needs, might not load everything if not needed, but for simplicity we load all available or let it fail gracefully
    const promises = [
        fetchAPI('data/reconciled_admissions.json').catch(() => []),
        fetchAPI('data/reconciled_beds.json').catch(() => []),
        fetchAPI('data/reconciled_labs.json').catch(() => []),
        fetchAPI('data/bed_forecast.json').catch(() => ({})),
        fetchAPI('data/lab_anomalies.json').catch(() => ({})),
        fetchAPI('data/conflicts_log.json').catch(() => []),
        fetchAPI('data/daily_summary.json').catch(() => ({}))
    ];
    
    const [admissions, beds, labs, forecast, anomalies, conflicts, summary] = await Promise.all(promises);
    globalData = { admissions, beds, labs, forecast, anomalies, conflicts, summary };
}

async function handleUpdateBeds(e) {
    e.preventDefault();
    const date = document.getElementById('admin-date').value;
    const ward = document.getElementById('admin-ward').value;
    const count = parseInt(document.getElementById('admin-count').value, 10);
    
    document.getElementById('loading-overlay').classList.remove('hidden');
    try {
        await fetch(`${API_BASE}/update/beds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ date, ward, newOccupiedCount: count })
        });
        await loadData();
        renderDashboard();
    } catch (err) {
        console.error(err);
        alert('Update failed');
    } finally {
        document.getElementById('loading-overlay').classList.add('hidden');
    }
}

function renderDashboard() {
    const role = userRole.toLowerCase();
    renderStatusBar();
    
    if (['admin', 'employee'].includes(role)) {
        renderCapacityCommand();
        renderDailyBrief();
    }
    if (['admin', 'doctor'].includes(role)) {
        renderBottleneckRadar();
    }
    if (role === 'admin') {
        renderDataTrust();
        renderUserManagement();
    }
    if (role === 'doctor') {
        renderPatientList();
    }
    if (role === 'patient') {
        renderMyPortal();
    }
}

async function renderUserManagement() {
    try {
        const users = await fetchAPI('admin/users');
        const tbody = document.querySelector('#table-users tbody');
        tbody.innerHTML = '';
        users.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td>${u.username}</td>
                    <td><span class="badge badge-blue">${u.role}</span></td>
                    <td>${u.patient_id || '-'}</td>
                    <td>${new Date(u.created_at).toLocaleString()}</td>
                </tr>
            `;
        });
    } catch (err) {
        console.error("Failed to load users", err);
    }
}

async function handleCreateUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;
    const patient_id = document.getElementById('new-patient-id').value;
    
    const msgEl = document.getElementById('create-user-msg');
    msgEl.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ username, password, role, patient_id })
        });
        if (!res.ok) throw new Error('Failed to create user');
        msgEl.textContent = 'User created successfully!';
        msgEl.className = 'text-green mt-4';
        msgEl.style.display = 'block';
        document.getElementById('create-user-form').reset();
        renderUserManagement();
    } catch (err) {
        msgEl.textContent = 'Error creating user.';
        msgEl.className = 'text-red mt-4';
        msgEl.style.display = 'block';
    }
}

// ---------------------------------------------------------
// UI Rendering Functions
// ---------------------------------------------------------

function getSeverityColor(pct) {
    if (pct < 70) return colors.green;
    if (pct <= 85) return colors.amber;
    return colors.red;
}

function getBadgeClass(severity) {
    const s = String(severity).toLowerCase();
    if (s.includes('critical') || s.includes('high')) return 'badge-critical';
    if (s.includes('medium')) return 'badge-amber';
    return 'badge-blue';
}

function renderStatusBar() {
    const { summary } = globalData;
    if (!summary.total_patients_in_period) return;

    document.getElementById('status-total').textContent = summary.total_patients_in_period.toLocaleString();
    document.getElementById('status-admitted').textContent = summary.currently_admitted.toLocaleString();
    document.getElementById('status-pending').textContent = summary.pending_lab_results.toLocaleString();
    
    // Data Quality
    const dq = summary.data_quality || {};
    const total = summary.total_patients_in_period;
    const errors = (dq.orphan_lab_orders || 0) + (dq.duplicate_records_removed || 0);
    const dqScore = total > 0 ? ((total - errors) / total) * 100 : 0;
    
    const dqEl = document.getElementById('status-dq');
    dqEl.textContent = `${dqScore.toFixed(1)}%`;
    dqEl.className = `status-value ${dqScore > 95 ? 'text-green' : (dqScore > 90 ? 'text-amber' : 'text-red')}`;
}

let admissionsChart = null;
let losChart = null;
function renderCapacityCommand() {
    const { summary, forecast } = globalData;
    
    // 1. Gauges
    const gaugesContainer = document.getElementById('ward-gauges');
    if(gaugesContainer) gaugesContainer.innerHTML = '';
    
    if (summary.wards && gaugesContainer) {
        Object.entries(summary.wards).forEach(([ward, data]) => {
            const pct = data.occupancy_pct || 0;
            const color = getSeverityColor(pct);
            
            let fText = 'No forecast';
            if (forecast.forecasts) {
                const wardForecast = forecast.forecasts.find(f => f.ward === ward);
                if (wardForecast) {
                    fText = `Tom: ${Math.round(wardForecast.predicted_occupied)} beds`;
                }
            }
            
            const gaugeHTML = `
                <div class="gauge-wrapper">
                    <div class="gauge" style="--pct: ${pct}%; --fill-color: ${color}">
                        <div class="gauge-content">
                            <div class="gauge-val">${Math.round(pct)}%</div>
                            <div class="gauge-label">${Math.round(data.current_occupied)}/${data.total_beds}</div>
                        </div>
                    </div>
                    <div class="gauge-title">${ward}</div>
                    <div class="gauge-forecast">${fText}</div>
                </div>
            `;
            gaugesContainer.innerHTML += gaugeHTML;
        });
    }

    // 2. Admissions vs Discharges Line Chart
    if (summary.daily_stats && summary.daily_stats.length > 0) {
        const stats = summary.daily_stats;
        const ctx = document.getElementById('chart-admissions')?.getContext('2d');
        if (ctx) {
            if (admissionsChart) admissionsChart.destroy();
            admissionsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: stats.map(s => s.date),
                    datasets: [
                        {
                            label: 'Admissions',
                            data: stats.map(s => s.admissions),
                            borderColor: colors.blue,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Discharges',
                            data: stats.map(s => s.discharges),
                            borderColor: colors.purple,
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { position: 'top' } }
                }
            });
        }
    }

    // 3. LOS Bar Chart
    if (summary.department_stats && summary.department_stats.length > 0) {
        const depts = summary.department_stats.sort((a,b) => b.avg_los_days - a.avg_los_days);
        const ctx = document.getElementById('chart-los')?.getContext('2d');
        if (ctx) {
            if (losChart) losChart.destroy();
            losChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: depts.map(d => d.department),
                    datasets: [{
                        label: 'Avg LOS (Days)',
                        data: depts.map(d => d.avg_los_days.toFixed(1)),
                        backgroundColor: colors.blue,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
}

let turnaroundChart = null;
function renderBottleneckRadar() {
    const { anomalies, admissions } = globalData;
    
    if (anomalies.summary) {
        const elTat = document.getElementById('metric-tat');
        const elAnom = document.getElementById('metric-anomalies');
        const elCrit = document.getElementById('metric-critical-pending');
        if (elTat) elTat.textContent = anomalies.summary.most_delayed_test ? "Delayed" : "Normal";
        if (elAnom) elAnom.textContent = anomalies.summary.total_anomalies || 0;
        if (elCrit) elCrit.textContent = anomalies.summary.total_pending || 0;
    }

    if (anomalies.baselines && anomalies.baselines.length > 0) {
        const tests = [...new Set(anomalies.baselines.map(b => b.test_name))].slice(0, 5);
        const p95Data = tests.map(t => {
            const b = anomalies.baselines.find(x => x.test_name === t);
            return b ? b.p95_hrs : 0;
        });
        const medData = tests.map(t => {
            const b = anomalies.baselines.find(x => x.test_name === t);
            return b ? b.median_hrs : 0;
        });

        const ctx = document.getElementById('chart-turnaround')?.getContext('2d');
        if (ctx) {
            if (turnaroundChart) turnaroundChart.destroy();
            turnaroundChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: tests,
                    datasets: [
                        { label: 'Median Hrs', data: medData, backgroundColor: colors.blue },
                        { label: 'P95 Hrs', data: p95Data, backgroundColor: colors.amber }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    }

    const tbAnomalies = document.querySelector('#table-anomalies tbody');
    if (tbAnomalies) {
        if (anomalies.anomalies && anomalies.anomalies.length > 0) {
            tbAnomalies.innerHTML = anomalies.anomalies.slice(0, 10).map(a => `
                <tr>
                    <td>${a.order_id}</td>
                    <td>${a.test_name}</td>
                    <td class="text-red">${a.actual_turnaround_hrs?.toFixed(1)}</td>
                    <td>${a.expected_p95_hrs?.toFixed(1)}</td>
                    <td><span class="badge ${getBadgeClass(a.severity)}">${a.severity}</span></td>
                </tr>
            `).join('');
        } else {
            tbAnomalies.innerHTML = '<tr><td colspan="5" style="text-align:center;">No anomalies detected.</td></tr>';
        }
    }

    const tbPending = document.querySelector('#table-pending tbody');
    if (tbPending) {
        if (anomalies.pending_results && anomalies.pending_results.length > 0) {
            tbPending.innerHTML = anomalies.pending_results.slice(0, 10).map(p => `
                <tr>
                    <td>${p.patient_id}</td>
                    <td>${p.test_name}</td>
                    <td>${p.priority}</td>
                    <td class="text-amber">${p.hours_since_collection?.toFixed(1)}</td>
                    <td><span class="badge ${getBadgeClass(p.severity)}">${p.severity}</span></td>
                </tr>
            `).join('');
        } else {
            tbPending.innerHTML = '<tr><td colspan="5" style="text-align:center;">No pending results.</td></tr>';
        }
    }

    const tbLongStay = document.querySelector('#table-long-stay tbody');
    if (tbLongStay) {
        if (admissions && admissions.length > 0) {
            const longStays = admissions
                .filter(a => a.currently_admitted && a.length_of_stay_days > 7)
                .sort((a,b) => b.length_of_stay_days - a.length_of_stay_days)
                .slice(0, 10);
                
            if (longStays.length > 0) {
                tbLongStay.innerHTML = longStays.map(a => `
                    <tr>
                        <td>${a.patient_id_display || a.patient_id}</td>
                        <td>${a.ward}</td>
                        <td>${a.admitting_department}</td>
                        <td class="text-red">${a.length_of_stay_days.toFixed(1)}</td>
                    </tr>
                `).join('');
            } else {
                tbLongStay.innerHTML = '<tr><td colspan="4" style="text-align:center;">No long-stay patients found.</td></tr>';
            }
        }
    }
}

let occupancyChart = null;
function renderDataTrust() {
    const { beds, conflicts } = globalData;
    
    if (beds && beds.length > 0) {
        const latestDate = beds[beds.length - 1].date;
        const latestBeds = beds.filter(b => b.date === latestDate);
        
        const confGrid = document.getElementById('confidence-cards');
        if (confGrid) {
            confGrid.innerHTML = latestBeds.map(b => {
                const conf = b.confidence || 0;
                const color = conf > 0.9 ? 'text-green' : (conf > 0.8 ? 'text-amber' : 'text-red');
                return `
                    <div class="conf-card">
                        <div>${b.ward}</div>
                        <div class="conf-score ${color}">${(conf*100).toFixed(0)}%</div>
                    </div>
                `;
            }).join('');
        }

        const select = document.getElementById('ward-filter-select');
        if (select) {
            const wards = [...new Set(beds.map(b => b.ward))];
            select.innerHTML = '<option value="all">All Wards</option>' + wards.map(w => `<option value="${w}">${w}</option>`).join('');

            const ctx = document.getElementById('chart-occupancy')?.getContext('2d');
            if (ctx) {
                if (occupancyChart) occupancyChart.destroy();
                occupancyChart = createOccupancyChart(ctx, beds, 'all');

                select.onchange = (e) => {
                    if(occupancyChart) occupancyChart.destroy();
                    occupancyChart = createOccupancyChart(ctx, beds, e.target.value);
                };
            }
        }
        
        const missingSummary = document.getElementById('missing-data-summary');
        if (missingSummary) {
            const grouped = beds.reduce((acc, b) => {
                if (b.his_derived) acc[b.ward] = (acc[b.ward] || 0) + 1;
                return acc;
            }, {});
            
            missingSummary.innerHTML = Object.entries(grouped).map(([w, count]) => `
                <div class="summary-row">
                    <span>${w}</span>
                    <span class="text-amber">${count} imputed records</span>
                </div>
            `).join('') || '<div class="summary-row">No missing records found.</div>';
        }
    }

    const tbConflicts = document.querySelector('#table-conflicts tbody');
    const searchInput = document.getElementById('conflict-search');
    
    function renderConflicts(filter = '') {
        if (!tbConflicts) return;
        const f = filter.toLowerCase();
        const filtered = (conflicts || []).filter(c => 
            (c.rule && c.rule.toLowerCase().includes(f)) || 
            (c.description && c.description.toLowerCase().includes(f))
        ).slice(0, 50);

        if (filtered.length > 0) {
            tbConflicts.innerHTML = filtered.map(c => `
                <tr>
                    <td>${c.id || '-'}</td>
                    <td><span class="badge badge-blue">${c.category || 'General'}</span><br>${c.rule}</td>
                    <td>${c.description}</td>
                    <td>${c.field}: <span class="text-red">${c.value_a}</span> vs <span class="text-amber">${c.value_b}</span></td>
                    <td class="text-green">${c.resolution}</td>
                </tr>
            `).join('');
        } else {
            tbConflicts.innerHTML = '<tr><td colspan="5" style="text-align:center;">No conflicts found.</td></tr>';
        }
    }
    
    if (conflicts && tbConflicts) {
        renderConflicts();
        if (searchInput) {
            searchInput.oninput = (e) => renderConflicts(e.target.value);
        }
    }
}

function createOccupancyChart(ctx, beds, ward) {
    let data = beds;
    if (ward !== 'all') data = data.filter(b => b.ward === ward);
    
    const dates = [...new Set(data.map(b => b.date))].sort();
    
    const hisData = dates.map(d => {
        const dayData = data.filter(b => b.date === d);
        return dayData.reduce((sum, b) => sum + (b.his_occupied || 0), 0);
    });
    const manualData = dates.map(d => {
        const dayData = data.filter(b => b.date === d);
        return dayData.reduce((sum, b) => sum + (b.manual_occupied || 0), 0);
    });

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                { label: 'HIS Occupied', data: hisData, borderColor: colors.blue, tension: 0.3 },
                { label: 'Manual Occupied', data: manualData, borderColor: colors.amber, borderDash: [5, 5], tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false }
        }
    });
}

function renderDailyBrief() {
    const { summary } = globalData;
    if (!summary.report_date) return;

    const totalPatients = summary.total_patients_in_period || 0;
    const conflicts = summary.data_quality?.total_conflicts || 0;
    const dqScore = totalPatients > 0 ? ((totalPatients - conflicts) / totalPatients * 100).toFixed(1) : 100;
    
    const narrativeEl = document.getElementById('daily-narrative');
    if (narrativeEl) {
        narrativeEl.innerHTML = `
            <p><strong>Executive Summary:</strong> For the period ending ${summary.report_date}, Unified Hospital admitted <strong>${summary.currently_admitted || 0}</strong> patients out of <strong>${totalPatients}</strong> total encounters. The current data quality confidence stands at <strong>${dqScore}%</strong>.</p>
            <p><strong>Lab Performance:</strong> The laboratory processed <strong>${summary.total_lab_orders || 0}</strong> orders. There are currently <strong>${summary.pending_lab_results || 0}</strong> pending results, with an overall median turnaround time of <strong>${summary.lab_turnaround?.overall_median_hrs || 0} hours</strong>.</p>
            <p><strong>Data Trust Notes:</strong> The system resolved <strong>${conflicts}</strong> conflicts and removed <strong>${summary.data_quality?.duplicate_records_removed || 0}</strong> duplicate records automatically.</p>
        `;
    }

    const alertsContainer = document.getElementById('alerts-container');
    if (alertsContainer) {
        if (summary.alerts && summary.alerts.length > 0) {
            alertsContainer.innerHTML = summary.alerts.map(a => {
                const levelClass = (a.severity || '').toLowerCase().includes('critical') ? 'critical' : ((a.severity || '').toLowerCase().includes('high') ? 'high' : '');
                return `
                <div class="alert-item ${levelClass}">
                    <div>
                        <strong><span class="badge ${getBadgeClass(a.severity || 'low')}">${a.type || 'Alert'}</span></strong>
                        <div style="margin-top:0.5rem; font-size:0.9rem;">${a.message || ''}</div>
                    </div>
                </div>
            `}).join('');
        } else {
            alertsContainer.innerHTML = '<div class="alert-item">No active alerts.</div>';
        }
    }

    const tbDept = document.querySelector('#table-department-brief tbody');
    if (tbDept) {
        if (summary.department_stats && summary.department_stats.length > 0) {
            tbDept.innerHTML = summary.department_stats.map(d => `
                <tr>
                    <td>${d.department}</td>
                    <td>${d.total_admissions}</td>
                    <td>${d.avg_los_days.toFixed(1)}</td>
                </tr>
            `).join('');
        } else {
            tbDept.innerHTML = '<tr><td colspan="3" style="text-align:center;">No department data available.</td></tr>';
        }
    }
}

function renderPatientList() {
    const { admissions } = globalData;
    const tbPatients = document.querySelector('#table-patients tbody');
    if (!tbPatients) return;
    
    if (admissions && admissions.length > 0) {
        tbPatients.innerHTML = admissions.map(a => `
            <tr>
                <td>${a.patient_id}</td>
                <td>${a.patient_id_display || 'Unknown'}</td>
                <td>${a.currently_admitted ? '<span class="text-amber">Admitted</span>' : '<span class="text-green">Discharged</span>'}</td>
                <td>${a.ward || '-'}</td>
            </tr>
        `).join('');
    } else {
        tbPatients.innerHTML = '<tr><td colspan="4" style="text-align:center;">No patients found.</td></tr>';
    }
}

function renderMyPortal() {
    const { admissions, labs } = globalData;
    
    const myAdmissions = (admissions || []).filter(a => a.patient_id === currentUsername);
    const myAdmission = myAdmissions.length > 0 ? myAdmissions[myAdmissions.length - 1] : null;
    
    const statusEl = document.getElementById('portal-status');
    const wardEl = document.getElementById('portal-ward');
    if (statusEl && wardEl) {
        if (myAdmission) {
            statusEl.textContent = myAdmission.currently_admitted ? 'Admitted' : 'Discharged';
            wardEl.textContent = `Ward: ${myAdmission.ward || '-'}`;
        } else {
            statusEl.textContent = 'No admission record found';
            wardEl.textContent = '';
        }
    }
    
    const tbMyLabs = document.querySelector('#table-my-labs tbody');
    if (tbMyLabs) {
        const myLabs = (labs || []).filter(l => l.patient_id === currentUsername);
        if (myLabs.length > 0) {
            tbMyLabs.innerHTML = myLabs.map(l => `
                <tr>
                    <td>${l.order_id}</td>
                    <td>${l.test_name}</td>
                    <td><span class="badge ${l.result_value ? 'badge-green' : 'badge-amber'}">${l.result_value ? 'Completed' : 'Pending'}</span></td>
                    <td>${l.result_value || '-'}</td>
                </tr>
            `).join('');
        } else {
            tbMyLabs.innerHTML = '<tr><td colspan="4" style="text-align:center;">No lab orders found.</td></tr>';
        }
    }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
