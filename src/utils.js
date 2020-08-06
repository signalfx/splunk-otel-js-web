export function generateId(bits) {
  const xes = 'x'.repeat(bits/4);
  return xes.replace(/x/g, function () {
    return ((Math.random() * 16) | 0).toString(16);
  });
}

export function findCookieValue(cookieName) {
  var decodedCookie = decodeURIComponent(document.cookie);
  var cookies = decodedCookie.split(';');
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.indexOf(cookieName + '=') === 0) {
      return c.substring((cookieName + '=').length, c.length);
    }
  }
  return undefined;
}
