async function main() {
  const m: Map<string, string> = new Map();
  console.log(
    JSON.stringify(m, (key, value) =>
      value instanceof Map ? Object.fromEntries(value) : value
    )
  );
}
main();
