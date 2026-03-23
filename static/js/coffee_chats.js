document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('coffee-chat-form');
	const chatsDoneEl = document.getElementById('chats-done');
	const chatsWeekEl = document.getElementById('chats-week');
	const chatsSemesterEl = document.getElementById('chats-semester');

	async function loadChats() {
		try {
			const res = await fetch('/api/coffee-chats');
			const data = await res.json();
			chatsDoneEl.textContent = data.length || 0;

			const now = new Date();
			const weekAgo = new Date(now);
			weekAgo.setDate(now.getDate() - 7);
			const semesterAgo = new Date(now);
			semesterAgo.setDate(now.getDate() - 120);

			const weekCount = data.filter(c => {
				const d = new Date(c.chat_date || c.date || c.chatDate);
				return d >= weekAgo && d <= now;
			}).length;
			const semCount = data.filter(c => {
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
