document.addEventListener('DOMContentLoaded', async () => {
	const authStatusEl = document.getElementById('auth-status');
	const logoutBtn = document.getElementById('logout-btn');

	const hasSupabase = typeof supabase !== 'undefined';
	const hasConfig = typeof CONFIG !== 'undefined' && CONFIG && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY;
	if (!hasSupabase || !hasConfig) {
		if (authStatusEl) authStatusEl.textContent = 'Auth unavailable';
		return;
	}

	const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

	function renderUser(user) {
		if (!authStatusEl || !logoutBtn) return;
		if (user) {
			authStatusEl.textContent = `Logged in: ${user.email || user.id}`;
			logoutBtn.style.display = 'inline-block';
		} else {
			authStatusEl.textContent = 'Not logged in';
			logoutBtn.style.display = 'none';
		}
	}

	try {
		const { data, error } = await supabaseClient.auth.getUser();
		if (error) {
			console.warn('Unable to fetch current user', error);
			renderUser(null);
		} else {
			renderUser(data.user);
		}
	} catch (err) {
		console.error('Auth status check failed', err);
		renderUser(null);
	}

	supabaseClient.auth.onAuthStateChange((_event, session) => {
		renderUser(session ? session.user : null);
	});

	logoutBtn?.addEventListener('click', async () => {
		const { error } = await supabaseClient.auth.signOut();
		if (error) {
			alert('Logout failed: ' + (error.message || JSON.stringify(error)));
			return;
		}
		window.location.href = '/login';
	});
});
