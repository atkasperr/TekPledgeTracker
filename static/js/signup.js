document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('signup-form');

	// initialize supabase client from config.js
	const supabaseClient = typeof supabase !== 'undefined' && CONFIG ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const payload = {};
		for (const [k, v] of fd.entries()) payload[k] = v;


		// use Supabase Auth to create the user, then create profile server-side
		try {
			if (!supabaseClient) throw new Error('Supabase client not initialized (check config.js and CDN)');

			const email = payload.email;
			const password = payload.password;
			if (!email || !password) return alert('Email and password are required for signup');

			// sign up with Supabase Auth
			console.debug('Attempting supabase.auth.signUp for', email);
			const { data: authData, error: authErr } = await supabaseClient.auth.signUp({ email, password });
			console.debug('signUp result', { authData, authErr });
			if (authErr) {
				console.error('Auth signUp error', authErr);
				return alert('Sign up failed: ' + (authErr.message || authErr.error_description || JSON.stringify(authErr)));
			}

			// remove password before sending profile to server
			delete payload.password;
			// `role` is only used to pick the endpoint; the DB tables typically don't have a `role` column.
			const role = payload.role;
			delete payload.role;

			// choose endpoint based on selected role
			const endpoint = role === 'brother' ? '/api/brothers' : '/api/pledges';
			console.debug('Posting profile to', endpoint, payload);
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			let body;
			try {
				body = await res.json();
			} catch (e) {
				body = await res.text().catch(() => ({}));
			}
			console.debug('Profile POST response', { status: res.status, body });
			if (res.ok) {
				alert('Sign up successful — check your email to confirm account if required');
				form.reset();
				window.location.href = '/home';
			} else {
				const msg = (body && body.message) || JSON.stringify(body) || 'Profile creation failed';
				alert('Error creating profile: ' + msg + ' (see console)');
				console.error('Profile creation error', res.status, body);
			}
		} catch (err) {
			alert('Error during sign up: ' + (err.message || err));
			console.error('Sign up error', err);
		}
	});
});
