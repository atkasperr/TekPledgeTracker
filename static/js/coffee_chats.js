document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('coffee-chat-form');
	const chatsDoneEl = document.getElementById('chats-done');
	const chatsWeekEl = document.getElementById('chats-week');
	const chatsSemesterEl = document.getElementById('chats-semester');

	async function getCurrentPledgeUniq() {
		try {
			const r = await fetch('/api/my-pledge', { credentials: 'include' });
			if (!r.ok) return null;
			const body = await r.json().catch(() => ({}));
			const pledge = body.pledge;
			if (!pledge) return null;
			return pledge.uniquename || pledge.uniquename || null;
		} catch (e) {
			console.warn('Error getting current pledge uniq', e);
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

		if (!payload.pledge_uniq) {
			try {
				const r = await fetch('/api/my-pledge', { credentials: 'include' });
				if (r.ok) {
					const body = await r.json().catch(() => ({}));
					if (body.pledge && body.pledge.uniquename) payload.pledge_uniq = body.pledge.uniquename;
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