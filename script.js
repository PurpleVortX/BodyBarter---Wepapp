// ===== State =====
let jobs = [];
let accounts = [];
let messageBoxCallback = null;

// ===== Utilities =====
function $(id) { return document.getElementById(id); }

function saveJobs() { localStorage.setItem('jobs', JSON.stringify(jobs)); }
function loadJobs() {
    try { jobs = JSON.parse(localStorage.getItem('jobs') || '[]'); } catch { jobs = []; }
}

function saveAccounts() { localStorage.setItem('accounts', JSON.stringify(accounts)); }
function loadAccounts() {
    try { accounts = JSON.parse(localStorage.getItem('accounts') || '[]'); } catch { accounts = []; }
}

function getLoggedInUser() {
    const raw = localStorage.getItem('loggedInUser');
    return raw ? JSON.parse(raw) : null;
}

function setLoggedInUser(user) {
    localStorage.setItem('loggedInUser', JSON.stringify(user));
}

function clearLoggedInUser() {
    localStorage.removeItem('loggedInUser');
}

function getAccountByUsername(username) {
    return accounts.find(a => a.username === username) || null;
}

function getAccountById(id) {
    return accounts.find(a => a.id === id) || null;
}

function nextAccountId() {
    const key = 'accountIdCounter';
    const n = parseInt(localStorage.getItem(key) || '1000', 10);
    localStorage.setItem(key, String(n + 1));
    return `U${n}`;
}

// Web Crypto SHA-256
async function sha256(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Custom Message Box instead of alert/confirm
function showMessage(message, type = 'alert', onConfirm = null) {
    const messageBox = $('messageBox');
    const messageText = $('messageText');
    const messageButtons = $('messageButtons');
    
    messageText.textContent = message;
    messageButtons.innerHTML = '';
    
    if (type === 'confirm') {
        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        yesBtn.onclick = () => {
            if (onConfirm) onConfirm(true);
            messageBox.style.display = 'none';
        };
        const noBtn = document.createElement('button');
        noBtn.textContent = 'No';
        noBtn.onclick = () => {
            if (onConfirm) onConfirm(false);
            messageBox.style.display = 'none';
        };
        messageButtons.appendChild(yesBtn);
        messageButtons.appendChild(noBtn);
    } else {
        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            messageBox.style.display = 'none';
        };
        messageButtons.appendChild(okBtn);
    }
    
    messageBox.style.display = 'flex';
}

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadJobs();

    const jobTypeSelect = $('jobType');
    const estimatedValueInput = $('estimatedValue');
    const darkModeToggle = $('darkModeToggle');

    jobTypeSelect.addEventListener('change', () => {
        const selectedOption = jobTypeSelect.options[jobTypeSelect.selectedIndex];
        estimatedValueInput.value = selectedOption.getAttribute('data-value') || '';
    });

    darkModeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', darkModeToggle.checked);
    });

    const user = getLoggedInUser();
    if (user) $('loggedInUser').textContent = `Logged in as: ${user.username} (${user.name})`;

    renderJobs();
});

// ===== Jobs =====
function addJob() {
    const title = $('jobTitle').value.trim();
    const description = $('jobDescription').value.trim();
    const payerUsername = $('payer').value.trim();
    const jobType = $('jobType').value;
    const estimatedValue = $('estimatedValue').value;

    const user = getLoggedInUser();
    if (!user) { showMessage('You must be logged in to create a job.'); return; }

    if (!title || !description || !payerUsername || !jobType || !estimatedValue) {
        showMessage('Please fill in all fields.');
        return;
    }

    const recipient = getAccountByUsername(payerUsername);
    if (!recipient) { showMessage('Recipient username not found.'); return; }

    const job = {
        id: Date.now().toString(),
        title,
        description,
        type: jobType,
        estimatedValue: Number(estimatedValue),
        creatorId: user.id,
        creatorUsername: user.username,
        recipientUsername: recipient.username,
        status: 'pending', // New status field
        createdAt: new Date().toISOString()
    };

    jobs.push(job);
    saveJobs();
    clearJobFields();
    renderJobs();
}

function clearJobFields() {
    $('jobTitle').value = '';
    $('jobDescription').value = '';
    $('payer').value = '';
    $('payerSuggestions').innerHTML = '';
    $('jobType').selectedIndex = 0;
    $('estimatedValue').value = '';
}

function renderJobs() {
    const list = $('jobList');
    list.innerHTML = '';

    const user = getLoggedInUser();
    if (!user) {
        const msg = document.createElement('div');
        msg.className = 'job-item';
        msg.innerHTML = '<p>Please log in to see your jobs.</p>';
        list.appendChild(msg);
        return;
    }

    const visible = jobs.filter(j => j.creatorUsername === user.username || j.recipientUsername === user.username);

    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'job-item';
        empty.innerHTML = '<p>No jobs yet. Create one above or wait for offers.</p>';
        list.appendChild(empty);
        return;
    }

    visible.forEach(job => {
        const creator = getAccountById(job.creatorId);
        const recipient = getAccountByUsername(job.recipientUsername);
        const creatorLabel = creator ? `${creator.name} (@${creator.username})` : `@${job.creatorUsername}`;
        const recipientLabel = recipient ? `${recipient.name} (@${recipient.username})` : `@${job.recipientUsername}`;

        const item = document.createElement('div');
        item.className = 'job-item';
        item.innerHTML = `
            <h2>${job.title}</h2>
            <p><strong>Description:</strong> ${job.description}</p>
            <p><strong>Offered By:</strong> ${creatorLabel}</p>
            <p><strong>Offered To:</strong> ${recipientLabel}</p>
            <p><strong>Type:</strong> ${job.type}</p>
            <p><strong>Estimated Value:</strong> $${job.estimatedValue}</p>
            <p class="status-${job.status}"><strong>Status:</strong> ${job.status.charAt(0).toUpperCase() + job.status.slice(1)}</p>
            <div class="job-actions">
                ${user.id === job.creatorId && job.status === 'pending' ? `<button onclick="removeJob('${job.id}')" class="remove">Remove</button>` : ''}
                ${user.username === job.recipientUsername && job.status === 'pending' ? `
                    <button onclick="acceptJob('${job.id}')" class="accept">Accept</button>
                    <button onclick="rejectJob('${job.id}')" class="reject">Reject</button>
                ` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function acceptJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
        job.status = 'accepted';
        saveJobs();
        renderJobs();
        showMessage(`You have accepted the job: "${job.title}".`);
    }
}

function rejectJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
        showMessage(`Are you sure you want to reject the job: "${job.title}"?`, 'confirm', (confirmed) => {
            if (confirmed) {
                job.status = 'rejected';
                saveJobs();
                renderJobs();
                showMessage(`You have rejected the job: "${job.title}".`);
            }
        });
    }
}

function removeJob(jobId) {
    showMessage('Are you sure you want to clear this job?', 'confirm', (confirmed) => {
        if (confirmed) {
            const user = getLoggedInUser();
            const job = jobs.find(j => j.id === jobId);
            if (!job) return;
            if (!user || user.id !== job.creatorId) {
                showMessage('Only the job creator can remove this job.');
                return;
            }
            jobs = jobs.filter(j => j.id !== jobId);
            saveJobs();
            renderJobs();
        }
    });
}

// ===== Account Creation / Auth =====
async function createAccount() {
    const username = $('newUsername').value.trim();
    const password = $('newPassword').value;
    const confirmPassword = $('confirmPassword').value;
    const name = $('accountName').value.trim();
    const bust = $('bust').value;
    const waist = $('waist').value;
    const hips = $('hips').value;
    const braSize = $('braSize').value;
    const gender = $('gender').value;
    const age = $('age').value;

    if (!username || !password || !confirmPassword || !name || !bust || !waist || !hips || !braSize || !gender || !age) {
        showMessage('Please fill in all fields.');
        return;
    }
    if (password !== confirmPassword) {
        showMessage('Passwords do not match.');
        return;
    }
    if (getAccountByUsername(username)) {
        showMessage('Username is already taken.');
        return;
    }

    const passwordHash = await sha256(password);

    const account = {
        id: nextAccountId(),
        username,
        passwordHash,
        name,
        measurements: { bust, waist, hips },
        braSize,
        gender,
        age: Number(age)
    };

    accounts.push(account);
    saveAccounts();

    // Clear fields
    $('newUsername').value = '';
    $('newPassword').value = '';
    $('confirmPassword').value = '';
    $('accountName').value = '';
    $('bust').value = '';
    $('waist').value = '';
    $('hips').value = '';
    $('braSize').value = '';
    $('gender').value = '';
    $('age').value = '';

    showMessage('Account created. You can log in now.');
}

async function login() {
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const account = getAccountByUsername(username);

    if (!account) { showMessage('Invalid username or password.'); return; }

    const passwordHash = await sha256(password);
    if (passwordHash !== account.passwordHash) {
        showMessage('Invalid username or password.'); return;
    }

    setLoggedInUser({ id: account.id, username: account.username, name: account.name });
    $('loggedInUser').textContent = `Logged in as: ${account.username} (${account.name})`;
    $('loginUsername').value = '';
    $('loginPassword').value = '';
    renderJobs();
}

function logout() {
    clearLoggedInUser();
    $('loggedInUser').textContent = '';
    renderJobs();
}

// ===== Payer Search with measurements =====
function searchPayers() {
    const query = $('payer').value.toLowerCase();
    const suggestions = $('payerSuggestions');
    suggestions.innerHTML = '';
    if (!query) return;

    const results = accounts.filter(a =>
        a.username.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query)
    );

    if (results.length === 0) {
        const el = document.createElement('div');
        el.className = 'suggestion';
        el.textContent = 'No matches found';
        suggestions.appendChild(el);
        return;
    }

    results.forEach(a => {
        const { bust, waist, hips } = a.measurements || {};
        const el = document.createElement('div');
        el.className = 'suggestion';
        el.innerHTML = `@${a.username} — ${a.name} | Bust: ${bust || '-'}" Waist: ${waist || '-'}" Hips: ${hips || '-'}"`;
        el.onclick = () => {
            $('payer').value = a.username;
            suggestions.innerHTML = '';
        };
        suggestions.appendChild(el);
    });
}

// ===== Admin Tools =====
function clearJobs() {
    showMessage('Are you sure you want to clear ALL jobs?', 'confirm', (confirmed) => {
        if (confirmed) {
            jobs = [];
            saveJobs();
            renderJobs();
        }
    });
}

function clearAccounts() {
    showMessage('Are you sure you want to clear ALL accounts? This will also log you out.', 'confirm', (confirmed) => {
        if (confirmed) {
            accounts = [];
            saveAccounts();
            clearLoggedInUser();
            $('loggedInUser').textContent = '';
            renderJobs();
        }
    });
}