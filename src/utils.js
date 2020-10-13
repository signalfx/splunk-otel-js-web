export function generateId(bits) {
  const xes = 'x'.repeat(bits/4);
  return xes.replace(/x/g, function () {
    return (Math.random() * 16 | 0).toString(16);
  });
}

export function findCookieValue(cookieName) {
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookies = decodedCookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i].trim();
    if (c.indexOf(cookieName + '=') === 0) {
      return c.substring((cookieName + '=').length, c.length);
    }
  }
  return undefined;
}

const ELLIPSIS = '...';
export function limitLen(value, lengthLimit) {
  if (typeof lengthLimit === 'number' && lengthLimit >= 0 && value.length > lengthLimit) {
    if (lengthLimit > ELLIPSIS.length) {
      return value.substring(0, lengthLimit - ELLIPSIS.length) + ELLIPSIS;
    }
    return value.substring(0, lengthLimit);
  }
    
  return value;
}
