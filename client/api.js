export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(result.message || 'Não foi possível concluir a solicitação.');
  }

  return result;
}

export function postJSON(url, body, options = {}) {
  return apiRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...options
  });
}