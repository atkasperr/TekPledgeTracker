document.addEventListener('DOMContentLoaded', () => {
	// initialize supabase client from config.js (included in template)
	const supabaseClient = typeof supabase !== 'undefined' && CONFIG ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;

	const form = document.getElementById('login-form');
	const forgotBtn = document.getElementById('forgot-password-btn');
	const emailInput = document.getElementById('login-email');

	forgotBtn.addEventListener('click', async () => {
		const email = (emailInput.value || '').trim();
		if (!email) {
			alert('Enter your email address above, then click Forgot password again.');
			emailInput.focus();
			return;
		}
		try {
			if (!supabaseClient) throw new Error('Supabase client not initialized (check config.js and CDN)');
			const redirectTo = `${window.location.origin}/reset-password`;
			const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
			if (error) {
				console.error('Password reset request error', error);
				return alert('Could not send reset email: ' + (error.message || JSON.stringify(error)));
			}
			alert('If an account exists for that email, you will receive password reset instructions shortly.');
		} catch (err) {
			console.error('Forgot password error', err);
			alert('Error: ' + (err.message || err));
		}
	});

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
			window.location.href = '/home';
		} catch (err) {
			console.error('Login network/error', err);
			alert('Login error: ' + (err.message || err));
		}
	});
});
