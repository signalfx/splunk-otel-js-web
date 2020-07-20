export function generateId(bits) {
  const xes = "x".repeat(bits/4);
  return xes.replace(/x/g, function () {
    return ((Math.random() * 16) | 0).toString(16);
  });
}