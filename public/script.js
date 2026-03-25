const API_URL = 'http://localhost:3000/api';

/* =========================================================================
   APPLICATION STATE & ROUTING
   ========================================================================= */
const app = {
    token: localStorage.getItem('gym_token'),
    role: localStorage.getItem('gym_role'),

    init() {
        this.updateNav();
        
        // Handle navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        });

        // Initialize Forms
        document.getElementById('login-form')?.addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('add-member-form')?.addEventListener('submit', this.handleAddMember.bind(this));
        document.getElementById('signup-form')?.addEventListener('submit', this.handleSignup.bind(this));
        document.getElementById('tracker-form')?.addEventListener('submit', this.handleAddTrackerLog.bind(this));

        // Mobile Navigation Logic
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const closeBtn = document.querySelector('.close-btn');
        const mobileNav = document.querySelector('.mobile-nav');
        
        if (mobileToggle) mobileToggle.addEventListener('click', () => mobileNav.classList.add('active'));
        if (closeBtn) closeBtn.addEventListener('click', () => mobileNav.classList.remove('active'));
        
        document.querySelectorAll('.mobile-btn, .mobile-join-btn').forEach(btn => {
            btn.addEventListener('click', () => mobileNav.classList.remove('active'));
        });

        this.showHome();
    },

    updateNav() {
        if (this.token) {
            document.getElementById('nav-login').style.display = 'none';
            document.getElementById('nav-dashboard').style.display = 'inline-block';
            document.getElementById('nav-logout').style.display = 'inline-block';
            
            document.getElementById('mobile-nav-login').style.display = 'none';
            document.getElementById('mobile-nav-dashboard').style.display = 'inline-block';
            document.getElementById('mobile-nav-logout').style.display = 'inline-block';
        } else {
            document.getElementById('nav-login').style.display = 'inline-block';
            document.getElementById('nav-dashboard').style.display = 'none';
            document.getElementById('nav-logout').style.display = 'none';

            document.getElementById('mobile-nav-login').style.display = 'inline-block';
            document.getElementById('mobile-nav-dashboard').style.display = 'none';
            document.getElementById('mobile-nav-logout').style.display = 'none';
        }
    },

    hideAllViews() {
        document.getElementById('view-home').style.display = 'none';
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-signup').style.display = 'none';
        document.getElementById('view-admin').style.display = 'none';
        document.getElementById('view-member').style.display = 'none';
    },

    showHome() {
        this.hideAllViews();
        document.getElementById('view-home').style.display = 'block';
    },

    showLogin() {
        if (this.token) {
            this.showDashboard();
            return;
        }
        this.hideAllViews();
        document.getElementById('view-login').style.display = 'block';
        document.getElementById('login-alert').style.display = 'none';
    },

    showSignup() {
        if (this.token) {
            this.showDashboard();
            return;
        }
        this.hideAllViews();
        document.getElementById('view-signup').style.display = 'block';
        document.getElementById('signup-alert').style.display = 'none';
    },

    showDashboard() {
        if (!this.token) {
            this.showLogin();
            return;
        }
        this.hideAllViews();
        if (this.role === 'admin') {
            document.getElementById('view-admin').style.display = 'block';
            this.loadAdminData();
        } else {
            document.getElementById('view-member').style.display = 'block';
            this.loadMemberData();
            this.loadTrackerLogs();
        }
    },

    logout() {
        this.token = null;
        this.role = null;
        localStorage.removeItem('gym_token');
        localStorage.removeItem('gym_role');
        this.updateNav();
        this.showHome();
    },

    /* =========================================================================
       API & LOGIC
       ========================================================================= */

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const alertBox = document.getElementById('login-alert');

        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            this.token = data.token;
            this.role = data.role;
            localStorage.setItem('gym_token', this.token);
            localStorage.setItem('gym_role', this.role);
            
            this.updateNav();
            this.showDashboard();
        } catch (err) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.textContent = err.message;
        }
    },

    async handleSignup(e) {
        e.preventDefault();
        const payload = {
            username: document.getElementById('signup-username').value,
            password: document.getElementById('signup-password').value,
            phone: document.getElementById('signup-phone').value,
            height: document.getElementById('signup-height').value,
            weight: document.getElementById('signup-weight').value
        };

        const alertBox = document.getElementById('signup-alert');

        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Signup failed');

            alertBox.style.display = 'block';
            alertBox.className = 'alert success';
            alertBox.textContent = "Signup successful! Logging you in...";
            
            // Automatically log them in
            document.getElementById('login-username').value = payload.username;
            document.getElementById('login-password').value = payload.password;
            setTimeout(() => {
                this.handleLogin(new Event('submit'));
            }, 1500);

        } catch (err) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.textContent = err.message;
        }
    },

    async loadAdminData() {
        try {
            const res = await fetch(`${API_URL}/admin/members`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) {
                if(res.status === 401 || res.status === 403) return this.logout();
                throw new Error("Failed to load members");
            }
            const members = await res.json();
            const tbody = document.getElementById('members-table-body');
            tbody.innerHTML = '';
            
            members.forEach(member => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${member.username}</td>
                    <td>${member.phone || 'N/A'}</td>
                    <td>${member.expiry || 'No plan assigned'}</td>
                    <td>
                        <button class="btn btn-outline btn-small" onclick="app.deleteMember(${member.id})">Remove</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    },

    async handleAddMember(e) {
        e.preventDefault();
        const payload = {
            username: document.getElementById('add-username').value,
            password: document.getElementById('add-password').value,
            phone: document.getElementById('add-phone').value,
            expiry: document.getElementById('add-expiry').value,
            height: document.getElementById('add-height').value,
            weight: document.getElementById('add-weight').value,
            monthly_price: document.getElementById('add-monthly').value,
            yearly_price: document.getElementById('add-yearly').value,
        };
        
        const alertBox = document.getElementById('admin-alert');

        try {
            const res = await fetch(`${API_URL}/admin/members`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            alertBox.style.display = 'block';
            alertBox.className = 'alert success';
            alertBox.textContent = data.message;
            document.getElementById('add-member-form').reset();
            this.loadAdminData(); // Refresh list
            
            setTimeout(() => { alertBox.style.display = 'none'; }, 3000);
        } catch (err) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert error';
            alertBox.textContent = err.message;
        }
    },

    async deleteMember(id) {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            const res = await fetch(`${API_URL}/admin/members/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (res.ok) this.loadAdminData();
            else alert("Failed to delete member");
        } catch (err) {
            console.error(err);
        }
    },

    async loadMemberData() {
        try {
            const res = await fetch(`${API_URL}/member/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) {
                if(res.status === 401 || res.status === 403) return this.logout();
                throw new Error("Failed to load generic member data");
            }
            const data = await res.json();
            
            document.getElementById('member-name').textContent = data.username.toUpperCase();
            document.getElementById('mem-weight').textContent = data.weight ? `${data.weight} kg` : '-- kg';
            document.getElementById('mem-height').textContent = data.height ? `${data.height} cm` : '-- cm';
            document.getElementById('mem-expiry').textContent = data.expiry || 'Pending assignment';
            document.getElementById('mem-phone').textContent = data.phone || 'N/A';
            document.getElementById('mem-monthly').textContent = `$${data.monthly_price || '--'}`;
            document.getElementById('mem-yearly').textContent = `$${data.yearly_price || '--'}`;

        } catch (err) {
            console.error(err);
        }
    },

    async loadTrackerLogs() {
        try {
            const res = await fetch(`${API_URL}/member/tracker`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!res.ok) throw new Error('Failed to load tracker logs');
            
            const data = await res.json();
            const tbody = document.getElementById('tracker-logs-body');
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--clr-text-muted);">No logs yet. Start working out!</td></tr>';
            } else {
                let currentMonthCount = 0;
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();

                data.forEach(log => {
                    const logDate = new Date(log.date);
                    if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
                        currentMonthCount++;
                    }
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="color: var(--clr-text-muted); font-size: 0.9rem;">${log.date}</td>
                        <td style="font-weight: 500;">${log.log_text}</td>
                    `;
                    tbody.appendChild(tr);
                });
                
                const progressSpan = document.getElementById('tracker-progress');
                if (progressSpan) progressSpan.textContent = `Workouts this month: ${currentMonthCount}`;
            }
        } catch (err) {
            console.error(err);
        }
    },

    async handleAddTrackerLog(e) {
        e.preventDefault();
        const inputField = document.getElementById('tracker-input');
        const dateField = document.getElementById('tracker-date');
        const weightField = document.getElementById('tracker-weight-update');

        try {
            const res = await fetch(`${API_URL}/member/tracker`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    log_text: inputField.value,
                    date: dateField.value,
                    weight: weightField.value || null
                })
            });

            if (!res.ok) throw new Error('Failed to add log');

            inputField.value = '';
            weightField.value = '';
            this.loadMemberData(); 
            this.loadTrackerLogs();
        } catch (err) {
            console.error(err);
        }
    },
    
    async enrollPlan() {
        const planType = document.getElementById('plan-select').value;
        try {
            const res = await fetch(`${API_URL}/member/enroll`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ planType })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || "Enrollment failed");
            alert(data.message);
            this.loadMemberData(); // refresh UI
        } catch(err) {
            alert(err.message);
        }
    }
};

// Start the APP immediately since script is at end of body
setTimeout(() => {
    app.init();
    const dateField = document.getElementById('tracker-date');
    if (dateField) dateField.value = new Date().toISOString().split('T')[0];
}, 100);
