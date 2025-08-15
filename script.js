document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;
    const jobTypeSelect = document.getElementById('jobType');
    const estimatedValueSpan = document.getElementById('estimatedValue');

    darkModeToggle.addEventListener('change', () => {
        body.classList.toggle('dark-mode', darkModeToggle.checked);
    });

    jobTypeSelect.addEventListener('change', () => {
        const selectedOption = jobTypeSelect.options[jobTypeSelect.selectedIndex];
        estimatedValueSpan.textContent = selectedOption.getAttribute('data-value');
    });

    // Load logged-in user from local storage
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    if (loggedInUser) {
        document.getElementById('loggedInUser').textContent = `Logged in as: ${loggedInUser.name} (ID: ${loggedInUser.id})`;
    }
});

let jobs = [];

function addJob() {
    const jobTitle = document.getElementById('jobTitle').value;
    const jobDescription = document.getElementById('jobDescription').value;
    const payer = document.getElementById('payer').value;
    const jobType = document.getElementById('jobType').value;
    const estimatedValue = document.getElementById('estimatedValue').textContent;

    if (jobTitle && jobDescription && payer && jobType && estimatedValue) {
        const job = {
            title: jobTitle,
            description: jobDescription,
            payer: payer,
            type: jobType,
            estimatedValue: estimatedValue
        };
        jobs.push(job);
        renderJobs();
        document.getElementById('jobTitle').value = '';
        document.getElementById('jobDescription').value = '';
        document.getElementById('payer').value = '';
        document.getElementById('jobType').value = 'nudes';
        estimatedValueSpan.textContent = '0';
    }
}

function renderJobs() {
    const jobList = document.getElementById('jobList');
    jobList.innerHTML = '';

    jobs.forEach((job, index) => {
        const jobItem = document.createElement('div');
        jobItem.className = 'job-item';
        jobItem.innerHTML = `
            <h2>${job.title}</h2>
            <p><strong>Description:</strong> ${job.description}</p>
            <p><strong>Payer:</strong> ${job.payer}</p>
            <p><strong>Type:</strong> ${job.type}</p>
            <p><strong>Estimated Value:</strong> $${job.estimatedValue}</p>
            <button onclick="removeJob(${index})">Remove</button>
        `;
        jobList.appendChild(jobItem);
    });
}

function removeJob(index) {
    jobs.splice(index, 1);
    renderJobs();
}

let accounts = [];

function createAccount() {
    const accountId = document.getElementById('accountId').value;
    const accountName = document.getElementById('accountName').value;
    const bust = document.getElementById('bust').value;
    const waist = document.getElementById('waist').value;
    const hips = document.getElementById('hips').value;
    const braSize = document.getElementById('braSize').value;
    const gender = document.getElementById('gender').value;
    const age = document.getElementById('age').value;

    if (accountId && accountName && bust && waist && hips && braSize && gender && age) {
        const newAccount = {
            id: accountId,
            name: accountName,
            measurements: {
                bust: bust,
                waist: waist,
                hips: hips
            },
            braSize: braSize,
            gender: gender,
            age: age
        };
        accounts.push(newAccount);
        saveAccountsToFile();
        clearAccountFields();
    } else {
        alert('Please fill in all fields.');
    }
}

function saveAccountsToFile() {
    const options = {
        types: [
            {
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] },
            },
        ],
    };

    window.showSaveFilePicker(options).then(async (fileHandle) => {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(accounts, null, 2));
        await writable.close();
        alert('Accounts saved successfully');
    }).catch(err => {
        console.error('Error saving file:', err);
    });
}

function clearAccountFields() {
    document.getElementById('accountId').value = '';
    document.getElementById('accountName').value = '';
    document.getElementById('bust').value = '';
    document.getElementById('waist').value = '';
    document.getElementById('hips').value = '';
    document.getElementById('braSize').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('age').value = '';
}

function searchPayers() {
    const query = document.getElementById('payer').value.toLowerCase();
    const suggestions = document.getElementById('payerSuggestions');
    suggestions.innerHTML = '';

    const filteredAccounts = accounts.filter(account =>
        account.id.toLowerCase().includes(query) || account.name.toLowerCase().includes(query)
    );

    if (filteredAccounts.length > 0) {
        filteredAccounts.forEach(account => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion';
            suggestion.innerHTML = `${account.id} - ${account.name}`;
            suggestion.onclick = () => {
                document.getElementById('payer').value = account.id;
                suggestions.innerHTML = '';
            };
            suggestions.appendChild(suggestion);
        });
    } else {
        suggestions.innerHTML = '<div class="suggestion">No matches found</div>';
    }
}

function login() {
    const accountId = document.getElementById('loginId').value;
    const accountName = document.getElementById('loginName').value;

    const account = accounts.find(a => a.id === accountId && a.name === accountName);

    if (account) {
        localStorage.setItem('loggedInUser', JSON.stringify(account));
        document.getElementById('loggedInUser').textContent = `Logged in as: ${account.name} (ID: ${account.id})`;
        document.getElementById('loginId').value = '';
        document.getElementById('loginName').value = '';
    } else {
        alert('Invalid account ID or name.');
    }
}

function logout() {
    localStorage.removeItem('loggedInUser');
    document.getElementById('loggedInUser').textContent = '';
}