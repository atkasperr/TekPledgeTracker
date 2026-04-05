document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('coffee-chat-form');
	const chatsDoneEl = document.getElementById('chats-done');
	const chatsWeekEl = document.getElementById('chats-week');
	const chatsSemesterEl = document.getElementById('chats-semester');

	async function getCurrentPledgeUniq() {
		if (typeof supabase === 'undefined' || typeof CONFIG === 'undefined') return null;
		try {
			const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
			const { data: userData } = await supabaseClient.auth.getUser();
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

	function setBar(fillId, pctId, count, goal) {
		const pct = Math.min(100, Math.round((count / goal) * 100));
		const fill = document.getElementById(fillId);
		const label = document.getElementById(pctId);
		if (fill) fill.style.width = pct + '%';
		if (label) label.textContent = pct + '%';
		// legacy text elements
		const text35 = document.getElementById('progress-35-text');
		const text4 = document.getElementById('progress-4-text');
		if (text35 && goal === 35) text35.textContent = `${count} / 35`;
		if (text4 && goal === 4) text4.textContent = `${count} / 4`;
	}

	async function loadChats() {
		try {
			const res = await fetch('/api/coffee-chats');
			const data = await res.json();

			const currentUniq = await getCurrentPledgeUniq();
			const filtered = currentUniq ? data.filter(c => c.pledge_uniq === currentUniq) : [];

			const doneCount = filtered.length || 0;
			if (chatsDoneEl) chatsDoneEl.textContent = doneCount;

			setBar('progress-35-fill', 'progress-35-pct', doneCount, 35);

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

			if (chatsWeekEl) chatsWeekEl.textContent = weekCount;
			if (chatsSemesterEl) chatsSemesterEl.textContent = semCount;

			setBar('progress-4-fill', 'progress-4-pct', weekCount, 4);

			// render recent chats
			const recentListEl = document.getElementById('recent-chats-list');
			const recentCount = document.getElementById('recent-count');
			if (recentListEl) {
				const sorted = filtered.slice().sort((a, b) =>
					new Date(b.chat_date || b.date || b.chatDate) - new Date(a.chat_date || a.date || a.chatDate)
				);
				if (recentCount) recentCount.textContent = sorted.length;
				if (sorted.length === 0) {
					recentListEl.innerHTML = '<p class="cc-no-chats">No chats logged yet.</p>';
				} else {
					recentListEl.innerHTML = sorted.slice(0, 5).map(c => {
						const dateVal = c.chat_date || c.date || c.chatDate;
						const dateStr = dateVal ? new Date(dateVal).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
						const name = c.brother_fullname || c.brother || 'Unknown';
						const desc = c.description || '';
						return `
							<div class="cc-chat-item">
								<div class="cc-chat-left">
									<span class="cc-chat-check">✓ COMPLETED</span>
									<div>
										<div class="cc-chat-name">${name}</div>
										${desc ? `<div class="cc-chat-desc">${desc}</div>` : ''}
									</div>
								</div>
								<div class="cc-chat-date">${dateStr}</div>
							</div>
						`;
					}).join('');
				}
			}

		} catch (err) {
			console.error('Failed to load coffee chats', err);
		}
	}

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const formData = new FormData(form);
		const payload = {};
		for (const [k, v] of formData.entries()) payload[k] = v;

		if (!payload.pledge_uniq && typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined') {
			try {
				const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
				const { data: userData } = await supabaseClient.auth.getUser();
				const user = userData?.user;
				if (user && user.email) {
					const { data: pledgeData, error: pledgeErr } = await supabaseClient
						.from('pledges')
						.select('uniquename')
						.eq('email', user.email)
						.limit(1)
						.single();
					if (!pledgeErr && pledgeData?.uniquename) {
						payload.pledge_uniq = pledgeData.uniquename;
					}
				}
			} catch (err) {
				console.warn('Error deriving pledge_uniq', err);
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

	// Set today's date as default
	const dateInput = form.querySelector('input[name="chat_date"]');
	if (dateInput) dateInput.valueAsDate = new Date();

	loadChats();
});