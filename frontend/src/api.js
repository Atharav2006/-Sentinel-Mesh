const API = 'http://localhost:8000';

export async function scoreAddress(address) {
  const res = await fetch(`${API}/score/${address}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function flagAddress(address) {
  const res = await fetch(`${API}/flag/${address}`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function queryAddress(address) {
  const res = await fetch(`${API}/query/${address}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRegistry() {
  const res = await fetch(`${API}/registry`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getHealth() {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGraph() {
  const res = await fetch(`${API}/graph`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitAppeal(address, reason, evidenceUrls = []) {
  const res = await fetch(`${API}/appeal/${address}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, evidence_urls: evidenceUrls }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAppealStatus(address) {
  const res = await fetch(`${API}/appeal/${address}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function verifyAppeal(appealId, reason, salt) {
  const res = await fetch(`${API}/appeal/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appeal_id: appealId, reason, salt }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function banIdentity(address) {
  const res = await fetch(`${API}/kyc/ban/${address}`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
