export async function readJsonOrText(resp: Response) {
  const text = await resp.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { code: resp.status, message: text.slice(0, 400), data: null };
  }
}

