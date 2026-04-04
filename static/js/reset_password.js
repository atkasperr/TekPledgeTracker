document.addEventListener('DOMContentLoaded', () => {
	const supabaseClient = typeof supabase !== 'undefined' && CONFIG ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
	const form = document.getElementById('reset-password-form');
	const gateMsg = document.getElementById('reset-gate-msg');
	const submitBtn = document.getElementById('reset-submit');

	function showGate(message, isError) {
		gateMsg.textContent = message;
		gateMsg.style.display = 'block';
		gateMsg.style.color = isError ? '#b91c1c' : '#334155';
	}

	async function waitForRecoverySession(client) {
		const readSession = async () => (await client.auth.getSession()).data.session;
		let session = await readSession();
		if (session) return session;
		await new Promise((r) => setTimeout(r, 250));
		session = await readSession();
		if (session) return session;

		return new Promise((resolve) => {
			let timer;
			const { data: { subscription } } = client.auth.onAuthStateChange((event, sess) => {
				if (event === 'PASSWORD_RECOVERY' && sess) {
					if (timer) clearTimeout(timer);
					subscription.unsubscribe();
					resolve(sess);
				}
			});
			timer = setTimeout(() => {
				subscription.unsubscribe();
				resolve(null);
			}, 4000);
		});
	}

	(async () => {
		if (!supabaseClient) {
			showGate('Supabase is not configured on this page.', true);
			submitBtn.disabled = true;
			return;
		}
		const session = await waitForRecoverySession(supabaseClient);
		if (!session) {
			showGate('This reset link is invalid or expired. Use “Forgot password?” on the login page to request a new email.', true);
			submitBtn.disabled = true;
			form.querySelectorAll('input').forEach((el) => {
				el.disabled = true;
			});
		}
	})();

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const password = fd.get('password');
		const confirm = fd.get('confirm');
		if (!password || !confirm) return alert('Please fill in both password fields.');
		if (password !== confirm) return alert('Passwords do not match.');

		try {
			if (!supabaseClient) throw new Error('Supabase client not initialized');
			const { error } = await supabaseClient.auth.updateUser({ password });
			if (error) {
				console.error('updateUser error', error);
				return alert('Could not update password: ' + (error.message || JSON.stringify(error)));
			}
			alert('Your password has been updated. You can log in now.');
			window.location.href = '/login';
		} catch (err) {
			console.error('Reset password error', err);
			alert('Error: ' + (err.message || err));
		}
	});
});
