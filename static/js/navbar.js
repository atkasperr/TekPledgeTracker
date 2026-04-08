document.addEventListener('DOMContentLoaded', async () => {
	const authStatusEl = document.getElementById('auth-status');
	const logoutBtn = document.getElementById('logout-btn');
	const loginLink = document.getElementById('login-link');
	const signupLink = document.getElementById('signup-link');

	const hasSupabase = typeof supabase !== 'undefined';
	const hasConfig = typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY;
	if (!hasSupabase || !hasConfig) {
		if (authStatusEl) authStatusEl.textContent = 'Auth unavailable';
		return;
	}

	const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);


	// Helper to fetch server session using HttpOnly cookie

	async function fetchServerSession() {
		try {
			const r = await fetch('/session', { credentials: 'include' });
			if (!r.ok) return null;
			const body = await r.json();
			return body.user || null;
		} catch (e) {
			console.warn('Could not fetch server session', e);
			return null;
		}
	}

	function renderUser(user) {
		if (!authStatusEl || !logoutBtn) return;
		if (user) {
			if (typeof user === 'object' && (user.email || user.id)) {
				authStatusEl.textContent = `Logged in: ${user.email || user.id}`;
			} else {
				authStatusEl.textContent = 'Logged in';
			}
			logoutBtn.style.display = 'inline-block';
			if (loginLink) loginLink.style.display = 'none';
			if (signupLink) signupLink.style.display = 'none';
		} else {
			// show nothing when not authenticated (and allow redirect to handle auth flow)
			authStatusEl.textContent = '';
			logoutBtn.style.display = 'none';
			if (loginLink) loginLink.style.display = 'inline';
			if (signupLink) signupLink.style.display = 'inline';
		}

		// If user is not authenticated and this is not a public auth page, redirect to /login
		(function handleRedirect(u) {
			try {
				const path = window.location.pathname;
				const allowed = ['/login', '/signup', '/reset-password', '/'];
				if (!u && !allowed.includes(path)) {
					window.location.href = '/login';
				}
			} catch (e) {
				console.warn('Redirect check failed', e);
			}
		})(user);
	}

	// Ask server for current session (uses HttpOnly cookie set by /session)
	const serverUser = await fetchServerSession();
	if (serverUser) {
		renderUser(serverUser);
	} else {
		// No server session — treat as unauthenticated. Avoid querying Supabase from the client.
		renderUser(null);
	}

	supabaseClient.auth.onAuthStateChange((_event, session) => {
		// When client auth state changes, inform server to set/clear HttpOnly cookie
		(async () => {
			try {
				if (session && session.access_token) {
					await fetch('/session', {
						method: 'POST',
						credentials: 'include',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ access_token: session.access_token })
					});
				} else {
					await fetch('/logout', { method: 'POST', credentials: 'include' });
				}
			} catch (e) {
				/* ignore */
			}
			renderUser(session ? session.user : null);
		})();
	});

	logoutBtn?.addEventListener('click', async () => {
		const shouldLogout = window.confirm('Are you sure you want to log out?');
		if (!shouldLogout) return;

		const { error } = await supabaseClient.auth.signOut();
		if (error) {
			alert('Logout failed: ' + (error.message || JSON.stringify(error)));
			return;
		}
		try {
			await fetch('/logout', { method: 'POST', credentials: 'include' });
		} catch (e) { /* ignore */ }
		window.location.href = '/login';
	});
});
