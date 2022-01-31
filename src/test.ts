async function main() {
  const m: Map<string, string> = new Map();
  m.set("alo", "gwagawgaw");
  console.log(
    JSON.stringify(m, (key, value) =>
      value instanceof Map ? Object.fromEntries(value) : value
    )
  );
}
main();
