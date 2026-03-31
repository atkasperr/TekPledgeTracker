document.addEventListener('DOMContentLoaded', () => {
	// initialize supabase client from config.js (included in template)
	const supabaseClient = typeof supabase !== 'undefined' && CONFIG ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;

	const form = document.getElementById('login-form');
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const email = fd.get('email');
		const password = fd.get('password');
		if (!email || !password) return alert('Email and password required');

		try {
			if (!supabaseClient) throw new Error('Supabase client not initialized (check config.js and CDN)');
			console.debug('Attempting signInWithPassword for', email);
			const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
			console.debug('signIn result', { data, error });
			if (error) {
				console.error('Sign in error', error);
				return alert('Login failed: ' + (error.message || JSON.stringify(error)));
			}
			// on success redirect
			window.location.href = '/';
		} catch (err) {
			console.error('Login network/error', err);
			alert('Login error: ' + (err.message || err));
		}
	});
});
