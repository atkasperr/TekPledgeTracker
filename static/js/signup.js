document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('signup-form');
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const payload = {};
		for (const [k, v] of fd.entries()) payload[k] = v;

		// Remove password before sending to server (not storing auth here)
		delete payload.password;

		try {
			const res = await fetch('/api/pledges', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok) {
				alert('Sign up successful');
				form.reset();
				window.location.href = '/';
			} else {
				const msg = body.message || JSON.stringify(body) || 'Sign up failed';
				alert('Error: ' + msg);
				console.error('Sign up error', msg);
			}
		} catch (err) {
			alert('Network error during sign up');
			console.error('Sign up network error', err);
		}
	});
});
