// ===== State =====
let jobs = [];
let accounts = [];
let messageBoxCallback = null;
let selectedRecipients = [];

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

    renderSelectedRecipients();
    renderJobs();
    renderNotifications(); // Initial render

    // Add gender change logic
    $('gender').addEventListener('change', handleGenderChange);

    handleGenderChange(); // Initial call in case default is set
});

function handleGenderChange() {
    const gender = $('gender').value;
    const isMale = gender === 'male';

    // Bust, waist, hips, bra size fields
    $('bust').disabled = isMale;
    $('waist').disabled = isMale;
    $('hips').disabled = isMale;
    $('braSize').disabled = isMale;

    // Optionally clear values if disabled
    if (isMale) {
        $('bust').value = '';
        $('waist').value = '';
        $('hips').value = '';
        $('braSize').value = '';
    }
}

// ===== Multiple Recipients Logic =====
function addRecipient(username) {
    if (!selectedRecipients.includes(username)) {
        selectedRecipients.push(username);
        renderSelectedRecipients();
    }
    $('payerInput').value = '';
    $('payerSuggestions').innerHTML = '';
}

function removeRecipient(username) {
    selectedRecipients = selectedRecipients.filter(u => u !== username);
    renderSelectedRecipients();
}

function renderSelectedRecipients() {
    const container = $('selectedPayers');
    container.innerHTML = '';
    selectedRecipients.forEach(username => {
        const el = document.createElement('span');
        el.textContent = `@${username}`;
        el.style.marginRight = '8px';
        el.style.padding = '2px 6px';
        el.style.background = '#eee';
        el.style.borderRadius = '4px';
        el.style.cursor = 'pointer';
        el.title = 'Remove';
        el.onclick = () => removeRecipient(username);
        container.appendChild(el);
    });
}

// ===== Jobs =====
function addJob() {
    const title = $('jobTitle').value.trim();
    const description = $('jobDescription').value.trim();
    const jobType = $('jobType').value;
    const estimatedValue = $('estimatedValue').value;

    const user = getLoggedInUser();
    if (!user) { showMessage('You must be logged in to create a job.'); return; }

    if (!title || !description || selectedRecipients.length === 0 || !jobType || !estimatedValue) {
        showMessage('Please fill in all fields and add at least one recipient.');
        return;
    }

    // Validate recipients
    for (const username of selectedRecipients) {
        if (!getAccountByUsername(username)) {
            showMessage(`Recipient username not found: ${username}`); return;
        }
    }

    // Status per recipient
    const status = {};
    selectedRecipients.forEach(u => status[u] = 'pending');

    const job = {
        id: Date.now().toString(),
        title,
        description,
        type: jobType,
        estimatedValue: Number(estimatedValue),
        creatorId: user.id,
        creatorUsername: user.username,
        recipientUsernames: [...selectedRecipients],
        status,
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
    selectedRecipients = [];
    renderSelectedRecipients();
    $('payerInput').value = '';
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

    const visible = jobs.filter(j =>
        j.creatorUsername === user.username ||
        (j.recipientUsernames && j.recipientUsernames.includes(user.username))
    );

    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'job-item';
        empty.innerHTML = '<p>No jobs yet. Create one above or wait for offers.</p>';
        list.appendChild(empty);
        return;
    }

    visible.forEach(job => {
        const creator = getAccountById(job.creatorId);
        const creatorLabel = creator
            ? `<span style="cursor:pointer;color:#2196F3;" onclick="viewProfile('${creator.username}')">${creator.name} (@${creator.username})</span>`
            : `@${job.creatorUsername}`;

        const recipientLabels = job.recipientUsernames.map(u => {
            const acc = getAccountByUsername(u);
            return acc
                ? `<span style="cursor:pointer;color:#2196F3;" onclick="viewProfile('${acc.username}')">${acc.name} (@${acc.username})</span>`
                : `@${u}`;
        }).join(', ');

        // Status for current user
        let userStatus = '';
        if (user.username !== job.creatorUsername) {
            userStatus = job.status[user.username] || 'pending';
        }

        const item = document.createElement('div');
        item.className = 'job-item';
        item.innerHTML = `
            <h2>${job.title}</h2>
            <p><strong>Description:</strong> ${job.description}</p>
            <p><strong>Offered By:</strong> ${creatorLabel}</p>
            <p><strong>Offered To:</strong> ${recipientLabels}</p>
            <p><strong>Type:</strong> ${job.type}</p>
            <p><strong>Estimated Value:</strong> $${job.estimatedValue}</p>
            ${user.username !== job.creatorUsername ? `<p class="status-${userStatus}"><strong>Status:</strong> ${userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}</p>` : ''}
            <div class="job-actions">
                ${user.id === job.creatorId ? `<button onclick="removeJob('${job.id}')" class="remove">Remove</button>` : ''}
                ${(job.recipientUsernames.includes(user.username) && job.status[user.username] === 'pending') ? `
                    <button onclick="acceptJob('${job.id}')" class="accept">Accept</button>
                    <button onclick="rejectJob('${job.id}')" class="reject">Reject</button>
                ` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function acceptJob(jobId) {
    const user = getLoggedInUser();
    const job = jobs.find(j => j.id === jobId);
    if (job && user && job.recipientUsernames.includes(user.username)) {
        job.status[user.username] = 'accepted';
        saveJobs();
        renderJobs();
        renderNotifications();
        showMessage(`You have accepted the job: "${job.title}".`);
        // Play sound
        const audio = $('acceptSound');
        if (audio) audio.play();

        // Notify job offerer
        const offererUsername = job.creatorUsername;
        const notifications = getNotifications(offererUsername);
        notifications.push({
            type: 'jobAccepted',
            jobTitle: job.title,
            recipient: user.username,
            time: new Date().toISOString()
        });
        saveNotifications(offererUsername, notifications);
    }
}

function rejectJob(jobId) {
    const user = getLoggedInUser();
    const job = jobs.find(j => j.id === jobId);
    if (job && user && job.recipientUsernames.includes(user.username)) {
        showMessage(`Are you sure you want to reject the job: "${job.title}"?`, 'confirm', (confirmed) => {
            if (confirmed) {
                job.status[user.username] = 'rejected';
                saveJobs();
                renderJobs();
                renderNotifications(); // Update notifications
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

    // Only require female fields if not male
    if (!username || !password || !confirmPassword || !name || !gender || !age ||
        (gender !== 'male' && (!bust || !waist || !hips || !braSize))) {
        showMessage('Please fill in all required fields.');
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
        measurements: gender === 'male' ? {} : { bust, waist, hips },
        braSize: gender === 'male' ? '' : braSize,
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
    renderNotifications();
}

function logout() {
    clearLoggedInUser();
    $('loggedInUser').textContent = '';
    renderJobs();
    renderNotifications();
}

// ===== Payer Search with measurements =====
function searchPayers() {
    const query = $('payerInput').value.toLowerCase();
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
        el.onclick = () => addRecipient(a.username);
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

function viewProfile(username) {
    let user;
    if (username) {
        user = getAccountByUsername(username);
    } else {
        const logged = getLoggedInUser();
        user = logged ? getAccountByUsername(logged.username) : null;
    }
    if (!user) {
        showMessage('User not found.');
        return;
    }

    // Count jobs taken (accepted)
    const jobsTaken = jobs.filter(j =>
        j.recipientUsernames &&
        j.recipientUsernames.includes(user.username) &&
        j.status &&
        j.status[user.username] === 'accepted'
    ).length;

    // Measurements
    const m = user.measurements || {};
    const infoHtml = `
        <p><strong>Username:</strong> @${user.username}</p>
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Gender:</strong> ${user.gender}</p>
        <p><strong>Age:</strong> ${user.age}</p>
        ${user.gender !== 'male' ? `
            <p><strong>Bust:</strong> ${m.bust || '-'}"</p>
            <p><strong>Waist:</strong> ${m.waist || '-'}"</p>
            <p><strong>Hips:</strong> ${m.hips || '-'}"</p>
            <p><strong>Bra Size:</strong> ${user.braSize || '-'}</p>
        ` : ''}
        <p><strong>Jobs Taken:</strong> ${jobsTaken}</p>
    `;

    $('profileTitle').textContent = `${user.name}'s Profile`;
    $('profileInfo').innerHTML = infoHtml;
    $('profileModal').style.display = 'flex';
}

function closeProfile() {
    $('profileModal').style.display = 'none';
}

function getNotifications(username) {
    return JSON.parse(localStorage.getItem('notifications_' + username) || '[]');
}
function saveNotifications(username, notifications) {
    localStorage.setItem('notifications_' + username, JSON.stringify(notifications));
}

function renderNotifications() {
    const user = getLoggedInUser();
    const area = $('notificationArea');
    if (!user) {
        area.innerHTML = '';
        return;
    }
    const notifications = getNotifications(user.username);
    if (!notifications.length) {
        area.innerHTML = '';
        return;
    }
    area.innerHTML = `
        <div style="background:#e3f2fd;border-radius:6px;padding:10px;">
            <strong>Notifications:</strong>
            <ul style="margin:8px 0 0 0;padding:0;list-style:none;">
                ${notifications.map(n => `<li>${n.recipient} accepted your job: <b>${n.jobTitle}</b></li>`).join('')}
            </ul>
            <button onclick="clearNotifications()" style="margin-top:8px;">Clear</button>
        </div>
    `;
}

function clearNotifications() {
    const user = getLoggedInUser();
    if (!user) return;
    saveNotifications(user.username, []);
    renderNotifications();
}