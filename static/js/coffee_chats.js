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

			// build leaderboard across all pledges (counts by pledge_uniq)
			const leaderboardBody = document.getElementById('leaderboard-body');
			// create or locate tooltip element (one global)
			let tooltip = document.getElementById('leaderboard-tooltip');
			if (!tooltip) {
				tooltip = document.createElement('div');
				tooltip.id = 'leaderboard-tooltip';
				tooltip.className = 'leaderboard-tooltip';
				document.body.appendChild(tooltip);
			}
			if (leaderboardBody) {
				leaderboardBody.innerHTML = '';
				const counts = {};
				const byPledge = {};
				for (const c of data) {
					const key = c.pledge_uniq;
					if (!key) continue;
					counts[key] = (counts[key] || 0) + 1;
					byPledge[key] = byPledge[key] || [];
					byPledge[key].push(c);
				}
				const rows = Object.keys(counts).map(k => ({ pledge: k, count: counts[k] }));
				rows.sort((a, b) => b.count - a.count || a.pledge.localeCompare(b.pledge));
				let rank = 1;
				for (const r of rows) {
					const tr = document.createElement('tr');
					tr.tabIndex = 0;
					const tdRank = document.createElement('td');
					tdRank.textContent = rank++;
					const tdPledge = document.createElement('td');
					tdPledge.textContent = r.pledge;
					const tdCount = document.createElement('td');
					tdCount.className = 'leaderboard-count';
					tdCount.textContent = r.count;
					tr.appendChild(tdRank);
					tr.appendChild(tdPledge);
					tr.appendChild(tdCount);

					// hover/focus handlers show tooltip with that pledge's chats
					const showTooltip = (clientX, clientY, pledgeKey) => {
						const chats = (byPledge[pledgeKey] || []).slice().sort((a, b) => new Date(b.chat_date || b.date || b.chatDate) - new Date(a.chat_date || a.date || a.chatDate));
						let html = '';
						if (chats.length === 0) {
							html = '<div>No chats</div>';
						} else {
							html = '<h4>Recent chats</h4><ul>';
							for (const c of chats.slice(0, 10)) {
								const d = c.chat_date || c.date || c.chatDate;
								const dateText = d ? (' <span class="chat-date">' + new Date(d).toLocaleDateString() + '</span>') : '';
								const who = (c.brother_fullname || c.brother || 'Unknown').replace(/</g, '&lt;').replace(/>/g, '&gt;');
								const desc = (c.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
								html += '<li><strong>' + who + '</strong>' + dateText + '<div>' + desc + '</div></li>';
							}
							html += '</ul>';
						}
						tooltip.innerHTML = html;
						tooltip.style.display = 'block';
						// position near cursor, but keep inside viewport
						const pad = 12;
						requestAnimationFrame(() => {
							const rectW = tooltip.offsetWidth;
							const rectH = tooltip.offsetHeight;
							let x = clientX + pad;
							let y = clientY + pad;
							const maxX = window.pageXOffset + window.innerWidth - rectW - 8;
							const maxY = window.pageYOffset + window.innerHeight - rectH - 8;
							if (x > maxX) x = Math.max(window.pageXOffset + 8, maxX);
							if (y > maxY) y = Math.max(window.pageYOffset + 8, maxY);
							tooltip.style.left = x + 'px';
							tooltip.style.top = y + 'px';
						});
					};

					const hideTooltip = () => { tooltip.style.display = 'none'; };

					tr.addEventListener('mouseenter', (ev) => showTooltip(ev.pageX, ev.pageY, r.pledge));
					tr.addEventListener('mousemove', (ev) => showTooltip(ev.pageX, ev.pageY, r.pledge));
					tr.addEventListener('mouseleave', hideTooltip);
					tr.addEventListener('focus', (ev) => showTooltip(ev.pageX || window.pageXOffset + 80, ev.pageY || window.pageYOffset + 80, r.pledge));
					tr.addEventListener('blur', hideTooltip);

					leaderboardBody.appendChild(tr);
				}
				if (rows.length === 0) {
					const tr = document.createElement('tr');
					const td = document.createElement('td');
					td.setAttribute('colspan', '3');
					td.textContent = 'No coffee chats yet';
					tr.appendChild(td);
					leaderboardBody.appendChild(tr);
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
