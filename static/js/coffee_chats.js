document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('coffee-chat-form');
	const chatsDoneEl = document.getElementById('chats-done');
	const chatsWeekEl = document.getElementById('chats-week');
	const chatsSemesterEl = document.getElementById('chats-semester');

	async function getCurrentPledgeUniq() {
		if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') return null;
		try {
			const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
			const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
			const user = userData?.user;
			if (!user || !user.email) return null;
			const { data: pledgeData, error: pledgeErr } = await supabaseClient
				.from('pledges')
				.select('uniquename')
				.eq('email', user.email)
				.limit(1)
				.single();
			if (pledgeErr || !pledgeData) return null;
			return pledgeData.uniquename || null;
		} catch (err) {
			console.warn('Error getting current pledge uniq', err);
			return null;
		}
	}

	async function loadChats() {
		try {
			const res = await fetch('/api/coffee-chats');
			const data = await res.json();

			const currentUniq = await getCurrentPledgeUniq();
			const filtered = currentUniq ? data.filter(c => c.pledge_uniq === currentUniq) : [];

			const doneCount = filtered.length || 0;
			chatsDoneEl.textContent = doneCount;

			// update progress bars
			const fill35 = document.getElementById('progress-35-fill');
			const text35 = document.getElementById('progress-35-text');
			const fill4 = document.getElementById('progress-4-fill');
			const text4 = document.getElementById('progress-4-text');
			if (fill35 && text35) {
				const pct35 = Math.min(100, Math.round((doneCount / 35) * 100));
				fill35.style.width = pct35 + '%';
				text35.textContent = `${doneCount} / 35`;
			}
			if (fill4 && text4) {
				const pct4 = Math.min(100, Math.round((doneCount / 4) * 100));
				fill4.style.width = pct4 + '%';
				text4.textContent = `${doneCount} / 4`;
			}

			// render recent 3 chats for current user
			const recentListEl = document.getElementById('recent-chats-list');
			if (recentListEl) {
				recentListEl.innerHTML = '';
				if (!filtered || filtered.length === 0) {
					const li = document.createElement('li');
					li.textContent = 'No recent chats';
					recentListEl.appendChild(li);
				} else {
					const sorted = filtered.slice().sort((a, b) => {
						return new Date(b.chat_date || b.date || b.chatDate) - new Date(a.chat_date || a.date || a.chatDate);
					});
					const top = sorted.slice(0, 3);
					for (const c of top) {
						const li = document.createElement('li');
						li.className = 'recent-chat-item';
						const header = document.createElement('div');
						header.className = 'recent-chat-header';
						const name = document.createElement('strong');
						name.textContent = c.brother_fullname || c.brother || 'Unknown';
						const dateSpan = document.createElement('span');
						dateSpan.className = 'chat-date';
						const dateVal = c.chat_date || c.date || c.chatDate;
						dateSpan.textContent = dateVal ? (' — ' + new Date(dateVal).toLocaleDateString()) : '';
						header.appendChild(name);
						header.appendChild(dateSpan);
						const desc = document.createElement('div');
						desc.className = 'chat-desc';
						desc.textContent = c.description || '';
						li.appendChild(header);
						li.appendChild(desc);
						recentListEl.appendChild(li);
					}
				}
			}

			const now = new Date();
			const weekAgo = new Date(now);
			weekAgo.setDate(now.getDate() - 7);
			const semesterAgo = new Date(now);
			semesterAgo.setDate(now.getDate() - 120);

			const weekCount = filtered.filter(c => {
				const d = new Date(c.chat_date || c.date || c.chatDate);
				return d >= weekAgo && d <= now;
			}).length;
			const semCount = filtered.filter(c => {
				const d = new Date(c.chat_date || c.date || c.chatDate);
				return d >= semesterAgo && d <= now;
			}).length;

			chatsWeekEl.textContent = weekCount;
			chatsSemesterEl.textContent = semCount;
		} catch (err) {
			console.error('Failed to load coffee chats', err);
		}
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const formData = new FormData(form);
		const payload = {};
		for (const [k, v] of formData.entries()) payload[k] = v;
		// If pledge_uniq is not provided in the form, derive it from the logged-in user.
		if (!payload.pledge_uniq && typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined') {
			try {
				const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
				const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
				const user = userData?.user;
				if (user && user.email) {
					const { data: pledgeData, error: pledgeErr } = await supabaseClient
						.from('pledges')
						.select('uniquename')
						.eq('email', user.email)
						.limit(1)
						.single();
					if (pledgeErr) {
						console.warn('Unable to lookup pledge for user', pledgeErr);
					} else if (pledgeData && pledgeData.uniquename) {
						payload.pledge_uniq = pledgeData.uniquename;
					}
				}
			} catch (err) {
				console.warn('Error deriving pledge_uniq from current user', err);
			}
		}

		try {
			const res = await fetch('/api/coffee-chats', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok) {
				form.reset();
				await loadChats();
			} else {
				const msg = body.message || JSON.stringify(body) || 'Failed to submit chat';
				alert('Error: ' + msg);
				console.error('Failed to submit chat', msg);
			}
		} catch (err) {
			alert('Error submitting chat');
			console.error('Error submitting chat', err);
		}
	});

	loadChats();
});
